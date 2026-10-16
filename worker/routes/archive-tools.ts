import type { Hono } from 'hono';
import { z } from 'zod';
import { archiveActionInput } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listItems, requireItem, requireList } from '../data';
import { readJson } from '../http';
import { fingerprint, operationId } from '../operations';

const retention = 30 * 86400000;
const restoreInput = z.object({
  entries: z
    .array(z.object({ kind: z.enum(['list', 'item', 'log']), id: z.string().uuid() }))
    .min(1)
    .max(100),
});
const tableFor = { list: 'lists', item: 'items', log: 'logs' } as const;

// A batch is one D1 transaction. A failed guard aborts every write, including the
// receipt, so a stale selection cannot silently move or merge only some records.
function guard(db: D1Database, sql: string, bindings: (string | number)[]) {
  return db
    .prepare(`SELECT json(CASE WHEN (${sql}) THEN 'null' ELSE 'stale archive state' END)`)
    .bind(...bindings);
}

export function registerArchiveTools(api: Hono<AppEnv>) {
  api.get('/trash', async (c) => {
    const owner = c.get('ownerId');
    const cutoff = Date.now() - retention;
    await c.env.DB.batch([
      ...['logs', 'items', 'lists'].map((table) =>
        c.env.DB.prepare(`DELETE FROM ${table} WHERE owner_id = ? AND trashed_at <= ?`).bind(owner, cutoff),
      ),
      c.env.DB.prepare('DELETE FROM archive_operations WHERE owner_id = ? AND created_at <= ?').bind(
        owner,
        cutoff,
      ),
    ]);
    const { results } = await c.env.DB.prepare(
      `
      SELECT id, 'list' AS kind, name AS title, id AS list_id, name AS list_name, trashed_at FROM lists WHERE owner_id = ? AND trashed_at IS NOT NULL
      UNION ALL
      SELECT i.id, 'item', i.title, l.id, l.name, i.trashed_at FROM items i JOIN active_lists l ON l.id = i.list_id AND l.owner_id = i.owner_id WHERE i.owner_id = ? AND i.trashed_at IS NOT NULL AND i.merged_into_id IS NULL
      UNION ALL
      SELECT g.id, 'log', COALESCE(i.title, NULLIF(g.title, ''), 'Log'), l.id, l.name, g.trashed_at FROM logs g JOIN active_lists l ON l.id = g.list_id AND l.owner_id = g.owner_id LEFT JOIN record_items i ON i.id = g.item_id WHERE g.owner_id = ? AND g.trashed_at IS NOT NULL AND (g.item_id IS NULL OR i.id IS NOT NULL)
      ORDER BY trashed_at DESC, id
    `,
    )
      .bind(owner, owner, owner)
      .all<{
        id: string;
        kind: string;
        title: string;
        list_id: string;
        list_name: string;
        trashed_at: number;
      }>();
    return c.json({
      entries: results.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        listId: r.list_id,
        listName: r.list_name,
        trashedAt: r.trashed_at,
        expiresAt: r.trashed_at + retention,
      })),
    });
  });

  api.post('/trash/restore', async (c) => {
    const { entries } = await readJson(c.req.raw, restoreInput);
    const owner = c.get('ownerId');
    const now = Date.now();
    const unique = [...new Map(entries.map((e) => [`${e.kind}:${e.id}`, e])).values()];
    const selection = JSON.stringify(unique);
    const selected = (kind: string) =>
      `SELECT json_extract(value, '$.id') FROM json_each(?) WHERE json_extract(value, '$.kind') = '${kind}'`;
    const read = `SELECT id, trashed_at, 1 AS parent_ok FROM lists WHERE owner_id = ? AND id IN (${selected('list')})
      UNION ALL SELECT id, trashed_at, EXISTS(SELECT 1 FROM active_lists l WHERE l.id = items.list_id AND l.owner_id = items.owner_id) FROM items WHERE owner_id = ? AND id IN (${selected('item')}) AND merged_into_id IS NULL
      UNION ALL SELECT id, trashed_at, EXISTS(SELECT 1 FROM active_lists l WHERE l.id = logs.list_id AND l.owner_id = logs.owner_id) AND (item_id IS NULL OR EXISTS(SELECT 1 FROM record_items i WHERE i.id = logs.item_id AND i.owner_id = logs.owner_id)) FROM logs WHERE owner_id = ? AND id IN (${selected('log')})`;
    const bindings = [owner, selection, owner, selection, owner, selection];
    const rows = await c.env.DB.prepare(read)
      .bind(...bindings)
      .all<{ id: string; trashed_at: number | null; parent_ok: number }>();
    if (rows.results.length !== unique.length)
      throw new ApiError(404, 'NOT_FOUND', 'A selected record is no longer in Trash');
    if (rows.results.some((r) => !r.parent_ok))
      throw new ApiError(409, 'PARENT_TRASHED', 'Restore the containing list or item first');
    if (rows.results.some((r) => r.trashed_at !== null && r.trashed_at <= now - retention))
      throw new ApiError(410, 'TRASH_EXPIRED', 'The 30-day recovery period has ended');
    const statements: D1PreparedStatement[] = [
      guard(
        c.env.DB,
        `SELECT COUNT(*) = ? FROM (${read}) WHERE parent_ok AND (trashed_at IS NULL OR trashed_at > ?)`,
        [unique.length, ...bindings, now - retention],
      ),
    ];
    // JSON selections keep 100-record Undo within D1 query and parameter limits.
    for (const kind of ['list', 'item', 'log'] as const) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE ${tableFor[kind]} SET trashed_at = NULL, updated_at = ? WHERE owner_id = ? AND trashed_at IS NOT NULL AND id IN (${selected(kind)})`,
        ).bind(now, owner, selection),
      );
    }
    statements.push(
      c.env.DB.prepare(
        `UPDATE lists SET updated_at = ? WHERE owner_id = ? AND id IN (SELECT list_id FROM items WHERE id IN (${selected('item')}) UNION SELECT list_id FROM logs WHERE id IN (${selected('log')}))`,
      ).bind(now, owner, selection, selection),
    );
    try {
      await c.env.DB.batch(statements);
    } catch (e) {
      changed(e);
    }
    return c.json({ restored: unique.length });
  });

  api.get('/items/:itemId/merged', async (c) => {
    const item = await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId'));
    const originals = (await listItems(c.env.DB, c.get('ownerId'), item.listId, true)).filter(
      (source) => source.mergedIntoId === item.id,
    );
    return c.json({ items: originals });
  });

  api.post('/items/:itemId/separate/:sourceId', async (c) => {
    const owner = c.get('ownerId');
    const item = await requireItem(c.env.DB, owner, c.req.param('itemId'));
    const source = await requireItem(c.env.DB, owner, c.req.param('sourceId'), true);
    if (source.mergedIntoId === null && source.listId === item.listId) return c.json({ item: source });
    if (source.mergedIntoId !== item.id)
      throw new ApiError(409, 'MERGE_CHANGED', 'This original is no longer part of this item');
    await c.env.DB.batch([
      guard(
        c.env.DB,
        'SELECT EXISTS(SELECT 1 FROM record_items WHERE id = ? AND merged_into_id = ? AND owner_id = ?)',
        [source.id, item.id, owner],
      ),
      c.env.DB.prepare(
        'UPDATE items SET merged_into_id = NULL, updated_at = ? WHERE id = ? AND owner_id = ?',
      ).bind(Date.now(), source.id, owner),
    ]).catch(changed);
    return c.json({ item: await requireItem(c.env.DB, owner, source.id) });
  });

  api.post('/lists/:listId/actions', async (c) => {
    const input = await readJson(c.req.raw, archiveActionInput);
    const ids = [...new Set(input.itemIds)];
    if (ids.length !== input.itemIds.length)
      throw new ApiError(400, 'INVALID_SELECTION', 'Select each item only once');
    const owner = c.get('ownerId');
    const key = operationId(c.req.header('Idempotency-Key'));
    const hash = await fingerprint({ listId: c.req.param('listId'), ...input, itemIds: ids });
    const saved = async () => {
      const row = await c.env.DB.prepare(
        'SELECT owner_id, fingerprint, result_json FROM archive_operations WHERE id = ?',
      )
        .bind(key)
        .first<{ owner_id: string; fingerprint: string; result_json: string }>();
      if (!row) return null;
      if (row.owner_id !== owner || row.fingerprint !== hash)
        throw new ApiError(
          409,
          'OPERATION_CHANGED',
          'This retry differs from the saved action. Start a new selection.',
        );
      return JSON.parse(row.result_json) as { count: number; action: string };
    };
    const previous = await saved();
    if (previous) return c.json(previous);
    const list = await requireList(c.env.DB, owner, c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'Choose collection items');
    const selection = JSON.stringify(ids);
    const selected = await c.env.DB.prepare(
      'SELECT COUNT(*) AS count FROM active_items WHERE owner_id = ? AND list_id = ? AND id IN (SELECT value FROM json_each(?))',
    )
      .bind(owner, list.id, selection)
      .first<{ count: number }>();
    if (selected?.count !== ids.length)
      throw new ApiError(404, 'INVALID_SELECTION', 'Some selected items are no longer in this collection');
    const now = Date.now();
    const result = { count: ids.length, action: input.action };
    const statements = [
      c.env.DB.prepare(
        'INSERT INTO archive_operations (id, owner_id, fingerprint, result_json, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(key, owner, hash, JSON.stringify(result), now),
      guard(
        c.env.DB,
        'SELECT COUNT(*) = ? FROM active_items WHERE owner_id = ? AND list_id = ? AND id IN (SELECT value FROM json_each(?))',
        [ids.length, owner, list.id, selection],
      ),
    ];
    const members =
      '(id IN (SELECT value FROM json_each(?)) OR merged_into_id IN (SELECT value FROM json_each(?)))';
    if (input.action === 'move') {
      const destination = await requireList(c.env.DB, owner, input.destinationId);
      if (destination.kind !== 'collection' || destination.id === list.id)
        throw new ApiError(400, 'INVALID_DESTINATION', 'Choose a different collection');
      statements.push(
        guard(
          c.env.DB,
          "SELECT EXISTS(SELECT 1 FROM active_lists WHERE id = ? AND owner_id = ? AND kind = 'collection')",
          [destination.id, owner],
        ),
      );
      statements.push(
        c.env.DB.prepare(
          `UPDATE logs SET list_id = ? WHERE owner_id = ? AND item_id IN (SELECT id FROM items WHERE owner_id = ? AND ${members})`,
        ).bind(destination.id, owner, owner, selection, selection),
      );
      statements.push(
        c.env.DB.prepare(
          `UPDATE items SET list_id = ?, updated_at = ? WHERE owner_id = ? AND ${members}`,
        ).bind(destination.id, now, owner, selection, selection),
      );
      statements.push(
        c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
          now,
          destination.id,
          owner,
        ),
      );
    } else if (input.action === 'merge') {
      if (!ids.includes(input.targetId))
        throw new ApiError(400, 'INVALID_MERGE', 'Keep one of the selected items');
      // Keep original fields, photos and log ownership intact. A merged item is a
      // reversible group, rather than a destructive overwrite of either record.
      statements.push(
        c.env.DB.prepare(
          `UPDATE items SET merged_into_id = ?, updated_at = ? WHERE owner_id = ? AND id <> ? AND ${members}`,
        ).bind(input.targetId, now, owner, input.targetId, selection, selection),
      );
    } else if (input.action === 'trash') {
      statements.push(
        c.env.DB.prepare(
          'UPDATE items SET trashed_at = ?, updated_at = ? WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))',
        ).bind(now, now, owner, selection),
      );
    } else {
      const column =
        input.action === 'queue' ? 'revisit_queued' : input.action === 'want' ? 'want_to_try' : 'type';
      const value = typeof input.value === 'boolean' ? Number(input.value) : input.value;
      statements.push(
        c.env.DB.prepare(
          `UPDATE items SET ${column} = ?, updated_at = ? WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?))`,
        ).bind(value, now, owner, selection),
      );
    }
    if (['move', 'merge', 'trash'].includes(input.action)) {
      const removed =
        input.action === 'merge' ? JSON.stringify(ids.filter((id) => id !== input.targetId)) : selection;
      statements.push(
        c.env.DB.prepare(
          `UPDATE lists SET ranked_ids = (SELECT COALESCE(json_group_array(value), '[]') FROM (SELECT value FROM json_each(lists.ranked_ids) WHERE value NOT IN (SELECT value FROM json_each(?)) ORDER BY CAST(key AS INTEGER))), rank_revision = rank_revision + 1 WHERE id = ? AND owner_id = ?`,
        ).bind(removed, list.id, owner),
      );
    }
    statements.push(
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        list.id,
        owner,
      ),
    );
    try {
      await c.env.DB.batch(statements);
    } catch (e) {
      const receipt = await saved();
      if (receipt) return c.json(receipt);
      changed(e);
    }
    return c.json(result);
  });
}

function changed(error: unknown): never {
  if (error instanceof Error && error.message.includes('malformed JSON'))
    throw new ApiError(409, 'ARCHIVE_CHANGED', 'These records changed elsewhere. Refresh and try again.');
  throw error;
}
