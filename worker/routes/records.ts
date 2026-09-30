import type { Hono } from 'hono';
import { itemInput, itemPatch, logInput, logPatch } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, itemPhotoKey, listLists, listLogs, logPhotoKey, requireItem, requireList, requireLog } from '../data';
import { readJson } from '../http';

export function registerRecordRoutes(api: Hono<AppEnv>): void {
  api.post('/lists/:listId/items', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'This list holds activity logs');
    const input = await readJson(c.req.raw, itemInput);
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare(`INSERT INTO items
      (id, list_id, owner_id, title, type, note, started_on, ended_on, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, list.id, c.get('ownerId'), input.title, input.type,
      input.note, input.startedOn, input.endedOn, now, now).run();
    await c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?')
      .bind(now, list.id, c.get('ownerId')).run();
    return c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), id) }, 201);
  });

  api.get('/items/:itemId', async (c) => c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId')) }));

  api.patch('/items/:itemId', async (c) => {
    const item = await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId'));
    const patch = await readJson(c.req.raw, itemPatch);
    const merged = itemInput.safeParse({
      title: patch.title ?? item.title,
      type: patch.type ?? item.type,
      note: patch.note ?? item.note,
      startedOn: patch.startedOn === undefined ? item.startedOn : patch.startedOn,
      endedOn: patch.endedOn === undefined ? item.endedOn : patch.endedOn,
    });
    if (!merged.success) throw new ApiError(400, 'INVALID_INPUT', merged.error.issues[0]?.message ?? 'Invalid item');
    const value = merged.data;
    await c.env.DB.prepare(`UPDATE items SET title = ?, type = ?, note = ?, started_on = ?, ended_on = ?,
      updated_at = ? WHERE id = ? AND owner_id = ?`).bind(value.title, value.type, value.note,
      value.startedOn, value.endedOn, Date.now(), item.id, c.get('ownerId')).run();
    return c.json({ item: await requireItem(c.env.DB, c.get('ownerId'), item.id) });
  });

  api.delete('/items/:itemId', async (c) => {
    const item = await requireItem(c.env.DB, c.get('ownerId'), c.req.param('itemId'));
    const { results } = await c.env.DB.prepare('SELECT photo_key FROM logs WHERE item_id = ? AND photo_key IS NOT NULL')
      .bind(item.id).all<{ photo_key: string }>();
    const photoKey = await itemPhotoKey(c.env.DB, c.get('ownerId'), item.id);
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM items WHERE id = ? AND owner_id = ?').bind(item.id, c.get('ownerId')),
      c.env.DB.prepare(`UPDATE lists SET ranked_ids = (
        SELECT COALESCE(json_group_array(value), '[]') FROM (
          SELECT value FROM json_each(lists.ranked_ids) WHERE value <> ? ORDER BY CAST(key AS INTEGER)
        )
      ), rank_revision = rank_revision + 1, updated_at = ?
      WHERE id = ? AND owner_id = ? AND EXISTS (SELECT 1 FROM json_each(lists.ranked_ids) WHERE value = ?)`)
        .bind(item.id, Date.now(), item.listId, c.get('ownerId'), item.id),
    ]);
    const keys = [...results.map((row) => row.photo_key), ...(photoKey ? [photoKey] : [])];
    if (keys.length) c.executionCtx.waitUntil(c.env.PHOTOS.delete(keys).catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'photo_cleanup_failed', message: String(error) }));
    }));
    return c.body(null, 204);
  });

  api.get('/lists/:listId/logs', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    return c.json({ logs: await listLogs(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.post('/lists/:listId/logs', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    const input = await readJson(c.req.raw, logInput);
    await validateLogTarget(c.env.DB, c.get('ownerId'), list.id, list.kind, input.itemId, input.title);
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare(`INSERT INTO logs
      (id, list_id, item_id, owner_id, title, happened_on, note, amount, unit, sets, reps, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, list.id, input.itemId, c.get('ownerId'),
      input.title, input.happenedOn, input.note, input.amount, input.unit, input.sets, input.reps, now, now).run();
    await c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?')
      .bind(now, list.id, c.get('ownerId')).run();
    return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), id) }, 201);
  });

  api.patch('/logs/:logId', async (c) => {
    const log = await requireLog(c.env.DB, c.get('ownerId'), c.req.param('logId'));
    const list = await requireList(c.env.DB, c.get('ownerId'), log.listId);
    const patch = await readJson(c.req.raw, logPatch);
    const merged = logInput.safeParse({
      itemId: patch.itemId === undefined ? log.itemId : patch.itemId,
      title: patch.title ?? log.title,
      happenedOn: patch.happenedOn ?? log.happenedOn,
      note: patch.note ?? log.note,
      amount: patch.amount === undefined ? log.amount : patch.amount,
      unit: patch.unit ?? log.unit,
      sets: patch.sets === undefined ? log.sets : patch.sets,
      reps: patch.reps === undefined ? log.reps : patch.reps,
    });
    if (!merged.success) throw new ApiError(400, 'INVALID_INPUT', merged.error.issues[0]?.message ?? 'Invalid log');
    const value = merged.data;
    await validateLogTarget(c.env.DB, c.get('ownerId'), list.id, list.kind, value.itemId, value.title);
    await c.env.DB.prepare(`UPDATE logs SET item_id = ?, title = ?, happened_on = ?, note = ?, amount = ?,
      unit = ?, sets = ?, reps = ?, updated_at = ? WHERE id = ? AND owner_id = ?`).bind(value.itemId,
      value.title, value.happenedOn, value.note, value.amount, value.unit, value.sets, value.reps, Date.now(),
      log.id, c.get('ownerId')).run();
    return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), log.id) });
  });

  api.delete('/logs/:logId', async (c) => {
    const log = await requireLog(c.env.DB, c.get('ownerId'), c.req.param('logId'));
    const photoKey = await logPhotoKey(c.env.DB, c.get('ownerId'), log.id);
    await c.env.DB.prepare('DELETE FROM logs WHERE id = ? AND owner_id = ?').bind(log.id, c.get('ownerId')).run();
    if (photoKey) c.executionCtx.waitUntil(c.env.PHOTOS.delete(photoKey).catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'photo_cleanup_failed', message: String(error) }));
    }));
    return c.body(null, 204);
  });

  api.get('/overview', async (c) => {
    const ownerId = c.get('ownerId');
    const lists = await listLists(c.env.DB, ownerId);
    const { results: recent } = await c.env.DB.prepare(`SELECT g.id, g.list_id, l.name AS list_name, l.kind,
      COALESCE(i.title, g.title) AS title, g.happened_on, g.amount, g.unit, g.sets, g.reps
      FROM logs g JOIN lists l ON l.id = g.list_id LEFT JOIN items i ON i.id = g.item_id
      WHERE g.owner_id = ? ORDER BY g.happened_on DESC, g.created_at DESC LIMIT 12`)
      .bind(ownerId).all<{
        id: string; list_id: string; list_name: string; kind: 'collection' | 'activity'; title: string;
        happened_on: string; amount: number | null; unit: string; sets: number | null; reps: number | null;
      }>();
    const { results: lastTimes } = await c.env.DB.prepare(`SELECT title, MAX(happened_on) AS happened_on
      FROM logs WHERE owner_id = ? AND item_id IS NULL GROUP BY title ORDER BY happened_on DESC LIMIT 4`)
      .bind(ownerId).all<{ title: string; happened_on: string }>();
    const highlight = await c.env.DB.prepare(`SELECT id, list_id, title, started_on FROM items
      WHERE owner_id = ? AND photo_key IS NOT NULL ORDER BY updated_at DESC LIMIT 1`)
      .bind(ownerId).first<{ id: string; list_id: string; title: string; started_on: string | null }>();
    return c.json({
      lists,
      recent: recent.map((row) => ({
        id: row.id, listId: row.list_id, listName: row.list_name, kind: row.kind, title: row.title,
        happenedOn: row.happened_on, amount: row.amount, unit: row.unit, sets: row.sets, reps: row.reps,
      })),
      lastTimes: lastTimes.map((row) => ({ title: row.title, happenedOn: row.happened_on })),
      highlight: highlight ? { id: highlight.id, listId: highlight.list_id, title: highlight.title,
        startedOn: highlight.started_on } : null,
    });
  });

  api.get('/search', async (c) => {
    const term = (c.req.query('q') ?? '').trim();
    if (term.length < 2 || term.length > 80) throw new ApiError(400, 'INVALID_QUERY', 'Search with 2 to 80 characters');
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const ownerId = c.get('ownerId');
    const { results: items } = await c.env.DB.prepare(`SELECT i.id, i.list_id, l.name AS list_name,
      i.title, i.type AS detail FROM items i JOIN lists l ON l.id = i.list_id
      WHERE i.owner_id = ? AND (i.title LIKE ? ESCAPE '\\' OR i.type LIKE ? ESCAPE '\\')
      ORDER BY i.updated_at DESC LIMIT 40`).bind(ownerId, pattern, pattern)
      .all<{ id: string; list_id: string; list_name: string; title: string; detail: string }>();
    const { results: logs } = await c.env.DB.prepare(`SELECT g.id, g.list_id, l.name AS list_name,
      g.title, g.happened_on AS detail FROM logs g JOIN lists l ON l.id = g.list_id
      WHERE g.owner_id = ? AND g.item_id IS NULL AND g.title LIKE ? ESCAPE '\\'
      ORDER BY g.happened_on DESC LIMIT 40`).bind(ownerId, pattern)
      .all<{ id: string; list_id: string; list_name: string; title: string; detail: string }>();
    return c.json({ results: [
      ...items.map((row) => ({ id: row.id, listId: row.list_id, listName: row.list_name,
        title: row.title, detail: row.detail, kind: 'item' as const })),
      ...logs.map((row) => ({ id: row.id, listId: row.list_id, listName: row.list_name,
        title: row.title, detail: row.detail, kind: 'log' as const })),
    ] });
  });
}

async function validateLogTarget(db: D1Database, ownerId: string, listId: string,
  kind: 'collection' | 'activity', itemId: string | null, title: string): Promise<void> {
  if (kind === 'activity') {
    if (itemId !== null || !title) throw new ApiError(400, 'INVALID_LOG', 'An activity needs a title and no item');
    return;
  }
  if (!itemId) throw new ApiError(400, 'INVALID_LOG', 'Choose an item for this log');
  const item = await requireItem(db, ownerId, itemId);
  if (item.listId !== listId) throw new ApiError(400, 'INVALID_LOG', 'The item belongs to another list');
}
