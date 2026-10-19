import { writeAnalytics } from '../../analytics/worker';
import type { Hono } from 'hono';
import { listCreate, listPatch, rankInput } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listItems, listLists, requireList } from '../data';
import { readJson } from '../http';

export function registerListRoutes(api: Hono<AppEnv>): void {
  api.get('/lists', async (c) => {
    const archived = c.req.query('archived');
    if (archived !== undefined && archived !== '0' && archived !== '1')
      throw new ApiError(400, 'INVALID_QUERY', 'Choose current or archived collections');
    return c.json({
      lists: await listLists(c.env.DB, c.get('ownerId'), archived === '1' ? 'archived' : 'current'),
    });
  });

  api.post('/lists', async (c) => {
    const input = await readJson(c.req.raw, listCreate);
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO lists (id, owner_id, name, kind, description, artwork, workspace_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        c.get('ownerId'),
        input.name,
        input.kind,
        input.description,
        input.artwork ? JSON.stringify(input.artwork) : null,
        JSON.stringify({
          rankings: [],
          views: [],
          ...(input.detailFields.length ? { detailFields: input.detailFields } : {}),
        }),
        now,
        now,
      )
      .run();
    writeAnalytics(c.env, { name: 'list_created' });
    return c.json({ list: await requireList(c.env.DB, c.get('ownerId'), id) }, 201);
  });

  api.get('/lists/:listId', async (c) =>
    c.json({ list: await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId')) }),
  );

  api.patch('/lists/:listId', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    const patch = await readJson(c.req.raw, listPatch);
    if (patch.archived !== undefined && list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can be archived');
    // Update only supplied fields: archiving must not overwrite a concurrent rename or artwork edit.
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (patch.name !== undefined) {
      fields.push('name = ?');
      values.push(patch.name);
    }
    if (patch.description !== undefined) {
      fields.push('description = ?');
      values.push(patch.description);
    }
    if (patch.artwork !== undefined) {
      fields.push('artwork = ?');
      values.push(patch.artwork ? JSON.stringify(patch.artwork) : null);
    }
    if (patch.archived !== undefined) {
      fields.push('archived = ?');
      values.push(patch.archived ? 1 : 0);
    }
    await c.env.DB.prepare(
      `UPDATE lists SET ${fields.join(', ')}, updated_at = ? WHERE id = ? AND owner_id = ? AND trashed_at IS NULL`,
    )
      .bind(...values, Date.now(), list.id, c.get('ownerId'))
      .run();
    return c.json({ list: await requireList(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.delete('/lists/:listId', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE lists SET trashed_at = ? WHERE id = ? AND owner_id = ?').bind(
        Date.now(),
        list.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare(
        'UPDATE shares SET revoked_at = ? WHERE list_id = ? AND owner_id = ? AND revoked_at IS NULL',
      ).bind(Date.now(), list.id, c.get('ownerId')),
    ]);
    return c.body(null, 204);
  });

  api.get('/lists/:listId/items', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'This list holds activity logs');
    return c.json({ items: await listItems(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.put('/lists/:listId/rank', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can be ranked');
    const input = await readJson(c.req.raw, rankInput);
    const items = await listItems(c.env.DB, c.get('ownerId'), list.id);
    const validIds = new Set(items.map((item) => item.id));
    if (input.itemIds.some((id) => !validIds.has(id))) {
      throw new ApiError(400, 'INVALID_RANK', 'The ranking includes an item outside this list');
    }
    const result = await c.env.DB.prepare(
      `UPDATE lists SET ranked_ids = ?, rank_revision = rank_revision + 1,
      updated_at = ? WHERE id = ? AND owner_id = ? AND rank_revision = ? AND trashed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM json_each(?) j WHERE NOT EXISTS
       (SELECT 1 FROM active_items i WHERE i.id = j.value AND i.list_id = lists.id AND i.owner_id = lists.owner_id))`,
    )
      .bind(
        JSON.stringify(input.itemIds),
        Date.now(),
        list.id,
        c.get('ownerId'),
        input.expectedRevision,
        JSON.stringify(input.itemIds),
      )
      .run();
    if (result.meta.changes === 0)
      throw new ApiError(409, 'RANK_CHANGED', 'This ranking changed elsewhere. Refresh and try again.');
    return c.json({ list: await requireList(c.env.DB, c.get('ownerId'), list.id) });
  });
}
