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
      `SELECT id, name, kind, description FROM lists
      WHERE owner_id = ? AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')
      ORDER BY updated_at DESC LIMIT 20`,
    )
      .bind(ownerId, pattern, pattern)
      .all<{ id: string; name: string; kind: 'collection' | 'activity'; description: string }>();
    const { results: items } = await c.env.DB.prepare(
      `SELECT i.id, i.list_id, l.name AS list_name,
      i.title, CASE WHEN i.note LIKE ? ESCAPE '\\' THEN substr(i.note, 1, 180) ELSE i.type END AS detail FROM items i JOIN lists l ON l.id = i.list_id
      WHERE i.owner_id = ? AND (
        i.title LIKE ? ESCAPE '\\' OR i.type LIKE ? ESCAPE '\\' OR i.note LIKE ? ESCAPE '\\'
      )
      ORDER BY i.updated_at DESC LIMIT 40`,
    )
      .bind(pattern, ownerId, pattern, pattern, pattern)
      .all<{ id: string; list_id: string; list_name: string; title: string; detail: string }>();
    const { results: logs } = await c.env.DB.prepare(
      `SELECT g.id, g.list_id, g.item_id, l.name AS list_name,
      COALESCE(i.title, g.title) AS title, CASE WHEN g.note LIKE ? ESCAPE '\\' THEN g.happened_on || ' · ' || substr(g.note, 1, 180) ELSE g.happened_on END AS detail, json_array_length(g.exercise_sets) > 0 AS exercise
      FROM logs g
      JOIN lists l ON l.id = g.list_id
      LEFT JOIN items i ON i.id = g.item_id AND i.owner_id = g.owner_id
      WHERE g.owner_id = ? AND (
        g.title LIKE ? ESCAPE '\\' OR g.note LIKE ? ESCAPE '\\'
      )
      ORDER BY g.happened_on DESC LIMIT 40`,
    )
      .bind(pattern, ownerId, pattern, pattern)
      .all<{
        exercise: number;
        id: string;
        list_id: string;
        item_id: string | null;
        list_name: string;
        title: string;
        detail: string;
      }>();
    return c.json({
      results: [
        ...lists.map((row) => ({
          id: row.id,
          listId: row.id,
          listName: row.name,
          title: row.name,
          detail: row.description || row.kind,
          kind: 'list' as const,
          itemId: null,
        })),
        ...items.map((row) => ({
          id: row.id,
          listId: row.list_id,
          listName: row.list_name,
          title: row.title,
          detail: row.detail,
          kind: 'item' as const,
          itemId: null,
        })),
        ...logs.map((row) => ({
          id: row.id,
          listId: row.list_id,
          listName: row.list_name,
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
