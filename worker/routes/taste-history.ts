import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireList } from '../data';
import { readJson } from '../http';
import { historyNote } from '../../src/shared/taste-history';
import { historyQuery, mapHistory, type HistoryRow } from '../taste-history';
export function registerTasteHistoryRoutes(api: Hono<AppEnv>) {
  api.get('/lists/:listId/history', async (c) => {
    const owner = c.get('ownerId'),
      list = await requireList(c.env.DB, owner, c.req.param('listId'));
    const cursor = c.req.query('cursor') ?? '';
    const until = Number(c.req.query('until') ?? 8640000000000000);
    if (!Number.isSafeInteger(until) || Math.abs(until) > 8640000000000000)
      throw new ApiError(400, 'INVALID_DATE', 'Choose a valid history boundary');
    if (cursor && !/^\d{1,16}:[a-f0-9]{32}$/.test(cursor))
      throw new ApiError(400, 'INVALID_CURSOR', 'Choose another history page');
    const [time, id] = cursor.split(':');
    const rows = await c.env.DB.prepare(
      `${historyQuery} AND (h.list_id = ? OR h.item_id IN (SELECT id FROM record_items WHERE list_id = ? AND owner_id = ?)) AND h.created_at < ? AND (? = '' OR h.created_at < ? OR (h.created_at = ? AND h.id < ?)) ORDER BY h.created_at DESC, h.id DESC LIMIT 51`,
    )
      .bind(owner, list.id, list.id, owner, until, cursor, Number(time ?? 0), Number(time ?? 0), id ?? '')
      .all<HistoryRow>();
    const events = rows.results.slice(0, 50),
      last = events.at(-1);
    // Linked visits may have moved or entered Trash since the note was saved.
    const logs = await c.env.DB.prepare('SELECT id FROM active_logs WHERE owner_id = ? AND list_id = ?')
      .bind(owner, list.id)
      .all<{ id: string }>();
    const items = await c.env.DB.prepare('SELECT id FROM record_items WHERE owner_id = ?')
      .bind(owner)
      .all<{ id: string }>();
    const itemIds = new Set(items.results.map((i) => i.id));
    const logIds = new Set(logs.results.map((g) => g.id));
    return c.json({
      events: events.map((row) => mapHistory(row, itemIds, logIds)),
      next: rows.results.length > 50 && last ? `${last.created_at}:${last.id}` : null,
    });
  });
  api.get('/history/:id', async (c) => {
    const owner = c.get('ownerId');
    const row = await c.env.DB.prepare(`${historyQuery} AND h.id = ?`)
      .bind(owner, c.req.param('id'))
      .first<HistoryRow>();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'History not found');
    const items = await c.env.DB.prepare('SELECT id FROM record_items WHERE owner_id = ?')
      .bind(owner)
      .all<{ id: string }>();
    return c.json({ event: mapHistory(row, new Set(items.results.map((i) => i.id))) });
  });
  api.put('/history/:id/note', async (c) => {
    const owner = c.get('ownerId'),
      input = await readJson(c.req.raw, historyNote);
    const event = await c.env.DB.prepare(`${historyQuery} AND h.id = ?`)
      .bind(owner, c.req.param('id'))
      .first<HistoryRow>();
    if (!event) throw new ApiError(404, 'NOT_FOUND', 'History not found');
    if (event.kind === 'rank' && input.logId)
      throw new ApiError(400, 'INVALID_VISIT', 'Visits can be linked to opinion changes');
    const result = await c.env.DB.prepare(
      `UPDATE taste_history SET reason = ?, log_id = ?, revision = revision + 1
   WHERE id = ? AND owner_id = ? AND revision = ? AND
   ((kind = 'rank' AND list_id IN (SELECT id FROM active_lists WHERE owner_id = ?)) OR
   (kind = 'opinion' AND item_id IN (SELECT id FROM record_items WHERE owner_id = ?))) AND
   (? IS NULL OR EXISTS(SELECT 1 FROM active_logs g JOIN record_items i ON i.id = taste_history.item_id AND i.owner_id = g.owner_id AND i.list_id = g.list_id
     WHERE g.id = ? AND g.owner_id = ? AND (g.item_id = i.id OR g.item_id = i.merged_into_id OR g.item_id IN (SELECT id FROM record_items WHERE merged_into_id = i.id))))`,
    )
      .bind(
        input.reason,
        input.logId,
        event.id,
        owner,
        input.expectedRevision,
        owner,
        owner,
        input.logId,
        input.logId,
        owner,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        'HISTORY_CHANGED',
        'History or its visit changed. Keep your draft and reload the saved details.',
      );
    const saved = await c.env.DB.prepare(`${historyQuery} AND h.id = ?`)
      .bind(owner, event.id)
      .first<HistoryRow>();
    if (!saved) throw new ApiError(409, 'HISTORY_CHANGED', 'This history is no longer available');
    return c.json({ event: mapHistory(saved) });
  });
}
