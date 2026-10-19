import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError } from '../data';

export function registerSearchRoutes(api: Hono<AppEnv>): void {
  api.get('/search', async (c) => {
    const term = (c.req.query('q') ?? '').trim();
    if (term.length < 2 || term.length > 40)
      throw new ApiError(400, 'INVALID_QUERY', 'Search with 2 to 40 characters');
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    if (new TextEncoder().encode(pattern).length > 50)
      throw new ApiError(400, 'INVALID_QUERY', 'Search with a shorter phrase');
    const ownerId = c.get('ownerId');
    const { results: lists } = await c.env.DB.prepare(
      `SELECT id, name, kind, description, archived FROM active_lists
      WHERE owner_id = ? AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
      ORDER BY updated_at DESC LIMIT 20`,
    )
      .bind(ownerId, pattern, pattern)
      .all<{
        id: string;
        name: string;
        kind: 'collection' | 'activity';
        description: string;
        archived: number;
      }>();
    const { results: items } = await c.env.DB.prepare(
      `SELECT i.id, i.list_id, l.name AS list_name, l.archived,
      i.title, CASE WHEN original.note LIKE ? ESCAPE '\\' THEN substr(original.note, 1, 180) ELSE COALESCE((SELECT substr(atom, 1, 180) FROM json_tree(original.context_json) WHERE type = 'text' AND atom NOT IN ('', 'none', 'unspecified') AND atom LIKE ? ESCAPE '\\' LIMIT 1), original.type) END AS detail FROM record_items original JOIN active_items i ON i.id = COALESCE(original.merged_into_id, original.id) JOIN active_lists l ON l.id = i.list_id
      WHERE i.owner_id = ? AND (
        original.title LIKE ? ESCAPE '\\' OR original.type LIKE ? ESCAPE '\\' OR original.note LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_tree(original.context_json) WHERE type = 'text' AND atom NOT IN ('', 'none', 'unspecified') AND atom LIKE ? ESCAPE '\\')
      )
      ORDER BY i.updated_at DESC LIMIT 40`,
    )
      .bind(pattern, pattern, ownerId, pattern, pattern, pattern, pattern)
      .all<{
        id: string;
        list_id: string;
        list_name: string;
        archived: number;
        title: string;
        detail: string;
      }>();
    const { results: logs } = await c.env.DB.prepare(
      `SELECT g.id, g.list_id, COALESCE(i.id, g.item_id) AS item_id, l.name AS list_name, l.archived,
      COALESCE(i.title, g.title) AS title, CASE WHEN g.note LIKE ? ESCAPE '\\' THEN g.happened_on || ' · ' || substr(g.note, 1, 180) ELSE COALESCE((SELECT g.happened_on || ' · ' || substr(atom, 1, 180) FROM json_tree(g.context_json) WHERE type = 'text' AND atom != '' AND atom LIKE ? ESCAPE '\\' LIMIT 1), g.happened_on) END AS detail, json_array_length(g.exercise_sets) > 0 AS exercise
      FROM active_logs g
      JOIN active_lists l ON l.id = g.list_id
      LEFT JOIN record_items original ON original.id = g.item_id
        LEFT JOIN active_items i ON i.id = COALESCE(original.merged_into_id, original.id) AND i.owner_id = g.owner_id
      WHERE g.owner_id = ? AND (
        g.title LIKE ? ESCAPE '\\' OR g.note LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM json_tree(g.context_json) WHERE type = 'text' AND atom != '' AND atom LIKE ? ESCAPE '\\')
      )
      ORDER BY g.happened_on DESC LIMIT 40`,
    )
      .bind(pattern, pattern, ownerId, pattern, pattern, pattern)
      .all<{
        exercise: number;
        id: string;
        list_id: string;
        item_id: string | null;
        list_name: string;
        archived: number;
        title: string;
        detail: string;
      }>();
    const { results: inbox } = await c.env.DB.prepare(
      `SELECT id, json_extract(payload_json,'$.title') AS title,
      CASE WHEN json_extract(payload_json,'$.note') LIKE ? ESCAPE '\\' THEN substr(json_extract(payload_json,'$.note'),1,180)
      ELSE COALESCE((SELECT substr(atom,1,180) FROM json_tree(json_extract(payload_json,'$.context')) WHERE type = 'text' AND atom NOT IN ('','none','unspecified') AND atom LIKE ? ESCAPE '\\' LIMIT 1), json_extract(payload_json,'$.type')) END AS detail
      FROM inbox_entries WHERE owner_id = ? AND trashed_at IS NULL AND (
        json_extract(payload_json,'$.title') LIKE ? ESCAPE '\\' OR json_extract(payload_json,'$.type') LIKE ? ESCAPE '\\' OR json_extract(payload_json,'$.note') LIKE ? ESCAPE '\\'
        OR EXISTS(SELECT 1 FROM json_tree(json_extract(payload_json,'$.context')) WHERE type = 'text' AND atom NOT IN ('','none','unspecified') AND atom LIKE ? ESCAPE '\\'))
      ORDER BY updated_at DESC LIMIT 40`,
    )
      .bind(pattern, pattern, ownerId, pattern, pattern, pattern, pattern)
      .all<{ id: string; title: string; detail: string }>();
    return c.json({
      results: [
        ...inbox.map((entry) => ({
          ...entry,
          listId: '',
          listName: 'Inbox',
          kind: 'inbox' as const,
          itemId: null,
        })),
        ...lists.map((row) => ({
          id: row.id,
          listId: row.id,
          listName: row.name,
          listArchived: Boolean(row.archived),
          title: row.name,
          detail: row.description || row.kind,
          kind: 'list' as const,
          itemId: null,
        })),
        ...[...new Map(items.map((row) => [row.id, row])).values()].map((row) => ({
          id: row.id,
          listId: row.list_id,
          listName: row.list_name,
          listArchived: Boolean(row.archived),
          title: row.title,
          detail: row.detail,
          kind: 'item' as const,
          itemId: null,
        })),
        ...logs.map((row) => ({
          id: row.id,
          listId: row.list_id,
          listName: row.list_name,
          listArchived: Boolean(row.archived),
          title: row.title,
          detail: row.detail,
          kind: 'log' as const,
          exercise: Boolean(row.exercise),
          itemId: row.item_id,
        })),
      ],
    });
  });
}
