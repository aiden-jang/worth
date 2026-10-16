import type { Hono } from 'hono';
import { itemInput, itemPatch, itemsBatchInput } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, requireItem, requireList } from '../data';
import { readJson } from '../http';
import { creationId, fingerprint, operationId, previousOperation } from '../operations';

export function registerItemRoutes(api: Hono<AppEnv>): void {
  api.post('/lists/:listId/items', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'This list holds activity logs');
    const input = await readJson(c.req.raw, itemInput);
    const id = creationId(c.req.header('Idempotency-Key'));
    const existing = await c.env.DB.prepare('SELECT owner_id, list_id FROM items WHERE id = ?')
      .bind(id)
      .first<{ owner_id: string; list_id: string }>();
    if (existing) {
      if (existing.owner_id !== c.get('ownerId') || existing.list_id !== list.id)
        throw new ApiError(409, 'ID_CONFLICT', 'Please start a fresh capture');
      return c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), id) }, 201);
    }
    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO items
      (id, list_id, owner_id, title, type, note, decision, revisit_queued, want_to_try, started_on, ended_on, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        list.id,
        c.get('ownerId'),
        input.title,
        input.type,
        input.note,
        input.decision,
        input.revisitQueued ? 1 : 0,
        input.wantToTry ? 1 : 0,
        input.startedOn,
        input.endedOn,
        now,
        now,
      )
      .run();
    await c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?')
      .bind(now, list.id, c.get('ownerId'))
      .run();
    return c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), id) }, 201);
  });

  api.post('/lists/:listId/items/batch', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'This list holds activity logs');
    const input = await readJson(c.req.raw, itemsBatchInput);
    const key = c.req.header('Idempotency-Key')
      ? operationId(c.req.header('Idempotency-Key'))
      : crypto.randomUUID();
    const hash = await fingerprint({ listId: list.id, titles: input.titles, wantToTry: input.wantToTry });
    const previous = await previousOperation(c.env.DB, key, c.get('ownerId'), 'batch', hash);
    if (previous)
      return c.json(
        { items: await Promise.all(previous.ids.map((id) => requireItem(c.env.DB, c.get('ownerId'), id))) },
        201,
      );
    const now = Date.now();
    const items = input.titles.map((title) => ({ id: crypto.randomUUID(), title }));
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          'INSERT INTO capture_operations (id, owner_id, list_id, kind, fingerprint, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(
          key,
          c.get('ownerId'),
          list.id,
          'batch',
          hash,
          JSON.stringify({ ids: items.map((i) => i.id) }),
          now,
        ),
        ...items.map((item) =>
          c.env.DB.prepare(
            `INSERT INTO items
            (id, list_id, owner_id, title, type, note, decision, want_to_try, started_on, ended_on, created_at, updated_at)
            VALUES (?, ?, ?, ?, '', '', NULL, ?, NULL, NULL, ?, ?)`,
          ).bind(item.id, list.id, c.get('ownerId'), item.title, input.wantToTry ? 1 : 0, now, now),
        ),
        c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
          now,
          list.id,
          c.get('ownerId'),
        ),
      ]);
    } catch (error) {
      const saved = await previousOperation(c.env.DB, key, c.get('ownerId'), 'batch', hash);
      if (saved)
        return c.json(
          { items: await Promise.all(saved.ids.map((id) => requireItem(c.env.DB, c.get('ownerId'), id))) },
          201,
        );
      throw error;
    }
    return c.json(
      { items: await Promise.all(items.map((item) => requireItem(c.env.DB, c.get('ownerId'), item.id))) },
      201,
    );
  });

  api.get('/items/:itemId', async (c) =>
    c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId')) }),
  );

  api.patch('/items/:itemId', async (c) => {
    const item = await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId'));
    const patch = await readJson(c.req.raw, itemPatch);
    const merged = itemInput.safeParse({
      title: patch.title ?? item.title,
      type: patch.type ?? item.type,
      note: patch.note ?? item.note,
      decision: patch.decision === undefined ? item.decision : patch.decision,
      revisitQueued: patch.revisitQueued ?? item.revisitQueued ?? false,
      wantToTry: patch.wantToTry ?? item.wantToTry ?? false,
      startedOn: patch.startedOn === undefined ? item.startedOn : patch.startedOn,
      endedOn: patch.endedOn === undefined ? item.endedOn : patch.endedOn,
    });
    if (!merged.success)
      throw new ApiError(400, 'INVALID_INPUT', merged.error.issues[0]?.message ?? 'Invalid item');
    const value = merged.data;
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE items SET title = ?, type = ?, note = ?, decision = ?, revisit_queued = ?, want_to_try = ?, started_on = ?, ended_on = ?,
          updated_at = ? WHERE id = ? AND owner_id = ?`,
      ).bind(
        value.title,
        value.type,
        value.note,
        value.decision,
        value.revisitQueued ? 1 : 0,
        value.wantToTry ? 1 : 0,
        value.startedOn,
        value.endedOn,
        now,
        item.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        item.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), item.id) });
  });

  api.delete('/items/:itemId', async (c) => {
    const item = await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId'));
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE items SET trashed_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        item.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare(
        `UPDATE lists SET ranked_ids = (
        SELECT COALESCE(json_group_array(value), '[]') FROM (
          SELECT value FROM json_each(lists.ranked_ids) WHERE value <> ? ORDER BY CAST(key AS INTEGER)
        )
      ), rank_revision = rank_revision + 1, updated_at = ?
      WHERE id = ? AND owner_id = ? AND EXISTS (SELECT 1 FROM json_each(lists.ranked_ids) WHERE value = ?)`,
      ).bind(item.id, now, item.listId, c.get('ownerId'), item.id),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        item.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}
