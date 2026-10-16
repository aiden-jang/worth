import type { Hono } from 'hono';
import {
  retrospectiveBounds,
  retrospectiveFilter,
  type RetrospectiveRecord,
} from '../../src/shared/retrospective';
import type { AppEnv } from '../context';
import { ApiError, requireList } from '../data';

type Row = {
  id: string;
  list_id: string | null;
  list_name: string;
  archived: number;
  kind: RetrospectiveRecord['kind'];
  title: string;
  note: string;
  created_at: number;
  happened_on: string | null;
};
const record = (row: Row): RetrospectiveRecord => ({
  id: row.id,
  listId: row.list_id,
  listName: row.list_name,
  archived: !!row.archived,
  kind: row.kind,
  title: row.title,
  note: row.note,
  createdAt: row.created_at,
  happenedOn: row.happened_on,
});

export function registerRetrospectiveRoutes(api: Hono<AppEnv>) {
  api.get('/retrospective', async (c) => {
    const parsed = retrospectiveFilter.safeParse({
      from: c.req.query('from'),
      to: c.req.query('to'),
      listId: c.req.query('list') ?? '',
      includeArchived: c.req.query('archived') === '1',
      startOffset: Number(c.req.query('startOffset')),
      endOffset: Number(c.req.query('endOffset')),
    });
    if (!parsed.success || !['0', '1'].includes(c.req.query('archived') ?? ''))
      throw new ApiError(400, 'INVALID_PERIOD', 'Choose real start/end dates within 366 days.');
    const filter = parsed.data,
      owner = c.get('ownerId'),
      { start, end } = retrospectiveBounds(filter);
    const selected = filter.listId ? await requireList(c.env.DB, owner, filter.listId) : null;
    if (selected?.archived && !filter.includeArchived)
      throw new ApiError(400, 'ARCHIVED_SCOPE', 'Include archived collections to review this collection.');
    const kept = `WITH kept AS (
      SELECT i.id, i.list_id, l.name AS list_name, l.archived, 'item' AS kind, i.title, i.note, i.created_at, NULL AS happened_on
      FROM active_items i JOIN active_lists l ON l.id = i.list_id AND l.owner_id = i.owner_id
      WHERE i.owner_id = ? AND i.created_at >= ? AND i.created_at < ? AND (? = 1 OR l.archived = 0) AND (? = '' OR i.list_id = ?)
      UNION ALL
      SELECT e.id, NULL AS list_id, 'Inbox' AS list_name, 0 AS archived, 'inbox' AS kind, json_extract(e.payload_json, '$.title') AS title, json_extract(e.payload_json, '$.note') AS note, e.created_at, NULL AS happened_on
      FROM inbox_entries e WHERE e.owner_id = ? AND e.trashed_at IS NULL AND e.created_at >= ? AND e.created_at < ? AND ? = ''
    )`;
    const visits = `WITH visits AS (
      SELECT g.id, g.list_id, l.name AS list_name, l.archived, CASE WHEN l.kind = 'activity' THEN 'activity' ELSE 'visit' END AS kind,
      COALESCE(i.title, NULLIF(g.title, ''), 'Untitled visit') AS title, g.note, g.created_at, g.happened_on
      FROM active_logs g JOIN active_lists l ON l.id = g.list_id AND l.owner_id = g.owner_id
      LEFT JOIN record_items original ON original.id = g.item_id AND original.owner_id = g.owner_id AND original.list_id = g.list_id
      LEFT JOIN active_items i ON i.id = COALESCE(original.merged_into_id, original.id) AND i.owner_id = g.owner_id AND i.list_id = g.list_id
      WHERE g.owner_id = ? AND g.happened_on >= ? AND g.happened_on <= ? AND (? = 1 OR l.archived = 0) AND (? = '' OR g.list_id = ?)
    )`;
    const keptQuery = (sql: string) =>
      c.env.DB.prepare(kept + sql).bind(
        owner,
        start,
        end,
        filter.includeArchived ? 1 : 0,
        filter.listId,
        filter.listId,
        owner,
        start,
        end,
        filter.listId,
      );
    const logQuery = (sql: string) =>
      c.env.DB.prepare(visits + sql).bind(
        owner,
        filter.from,
        filter.to,
        filter.includeArchived ? 1 : 0,
        filter.listId,
        filter.listId,
      );
    // Counts and both source groups share a snapshot, including concurrent Inbox filing.
    const [keptCount, logCounts, keptRows, logRows] = await c.env.DB.batch([
      keptQuery('SELECT COUNT(*) AS total FROM kept'),
      logQuery(
        "SELECT COALESCE(SUM(kind = 'visit'), 0) AS revisits, COALESCE(SUM(kind = 'activity'), 0) AS activity FROM visits",
      ),
      keptQuery('SELECT * FROM kept ORDER BY created_at DESC, kind, id DESC LIMIT 50'),
      logQuery('SELECT * FROM visits ORDER BY happened_on DESC, created_at DESC, id DESC LIMIT 50'),
    ]);
    const counts = logCounts.results[0] as { revisits: number; activity: number };
    return c.json({
      period: filter,
      scopeName: selected?.name ?? 'All lists and Inbox',
      readAt: new Date().toISOString(),
      counts: { kept: (keptCount.results[0] as { total: number }).total, ...counts },
      kept: (keptRows.results as Row[]).map(record),
      logs: (logRows.results as Row[]).map(record),
    });
  });
}
