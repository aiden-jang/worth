import type { Hono } from 'hono';
import {
  calendarFilter,
  type ActivityCalendar,
  type CalendarEntry,
} from '../../src/shared/activity-calendar';
import type { AppEnv } from '../context';
import { ApiError } from '../data';

type Row = {
  id: string;
  kind: CalendarEntry['kind'];
  day: string;
  original_day: string | null;
  title: string;
  list_id: string | null;
  list_name: string;
  archived: number;
  key: string;
};
export function registerCalendarRoutes(api: Hono<AppEnv>) {
  api.get('/calendar', async (c) => {
    const parsed = calendarFilter.safeParse({
      month: c.req.query('month'),
      day: c.req.query('day'),
      includeArchived: c.req.query('archived') === '1',
    });
    const cursor = c.req.query('after') ?? '';
    if (
      !parsed.success ||
      !['0', '1'].includes(c.req.query('archived') ?? '') ||
      (cursor && !/^(revisit|inbox|visit|activity):[0-9a-f-]{36}$/.test(cursor))
    )
      throw new ApiError(400, 'INVALID_CALENDAR', 'Choose a real month and a day within it.');
    const filter = parsed.data,
      owner = c.get('ownerId');
    // Calendar days are literal entered dates, not timestamps converted into an inferred visit.
    const events = `WITH events AS (
      SELECT i.id, 'revisit' AS kind, COALESCE(json_extract(i.context_json, '$.revisit.snoozedUntil'), json_extract(i.context_json, '$.revisit.on')) AS day,
        json_extract(i.context_json, '$.revisit.on') AS original_day, i.title, i.list_id, l.name AS list_name, l.archived
      FROM active_items i JOIN active_lists l ON l.id = i.list_id AND l.owner_id = i.owner_id
      WHERE i.owner_id = ? AND l.kind = 'collection' AND (? = 1 OR l.archived = 0) AND json_extract(i.context_json, '$.revisit.on') IS NOT NULL
      UNION ALL
      SELECT e.id, 'inbox' AS kind, COALESCE(json_extract(e.payload_json, '$.context.revisit.snoozedUntil'), json_extract(e.payload_json, '$.context.revisit.on')) AS day,
        json_extract(e.payload_json, '$.context.revisit.on') AS original_day, json_extract(e.payload_json, '$.title') AS title, NULL AS list_id, 'Inbox' AS list_name, 0 AS archived
      FROM inbox_entries e WHERE e.owner_id = ? AND e.trashed_at IS NULL AND json_extract(e.payload_json, '$.context.revisit.on') IS NOT NULL
      UNION ALL
      SELECT g.id, CASE WHEN l.kind = 'activity' THEN 'activity' ELSE 'visit' END AS kind, g.happened_on AS day,
        NULL AS original_day, COALESCE(i.title, NULLIF(g.title, ''), 'Untitled visit') AS title, g.list_id, l.name AS list_name, l.archived
      FROM active_logs g JOIN active_lists l ON l.id = g.list_id AND l.owner_id = g.owner_id
      LEFT JOIN record_items original ON original.id = g.item_id AND original.owner_id = g.owner_id AND original.list_id = g.list_id
      LEFT JOIN active_items i ON i.id = COALESCE(original.merged_into_id, original.id) AND i.owner_id = g.owner_id AND i.list_id = g.list_id
      WHERE g.owner_id = ? AND (? = 1 OR l.archived = 0)
    ), month_events AS (SELECT *, kind || ':' || id AS key FROM events WHERE substr(day, 1, 7) = ?)`;
    const query = (sql: string, values: (string | number)[] = []) =>
      c.env.DB.prepare(events + sql).bind(
        owner,
        filter.includeArchived ? 1 : 0,
        owner,
        owner,
        filter.includeArchived ? 1 : 0,
        filter.month,
        ...values,
      );
    const [counts, entries] = await c.env.DB.batch([
      query(
        "SELECT day, SUM(kind IN ('revisit','inbox')) AS planned, SUM(kind = 'visit') AS visits, SUM(kind = 'activity') AS activities FROM month_events GROUP BY day ORDER BY day",
      ),
      query('SELECT * FROM month_events WHERE day = ? AND key > ? ORDER BY key LIMIT 51', [
        filter.day,
        cursor,
      ]),
    ]);
    const rows = entries.results as Row[];
    const result: ActivityCalendar = {
      filter,
      days: counts.results as ActivityCalendar['days'],
      entries: rows.slice(0, 50).map((row) => ({
        id: row.id,
        kind: row.kind,
        day: row.day,
        originalDay: row.original_day,
        title: row.title,
        listId: row.list_id,
        listName: row.list_name,
        archived: !!row.archived,
      })),
      next: rows.length > 50 ? rows[49].key : null,
    };
    return c.json(result);
  });
}
