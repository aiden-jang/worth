import type { Hono } from 'hono';
import { itemInput, itemPatch, itemsBatchInput, logInput, logPatch } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listLists, listLogs, requireItem, requireList, requireLog } from '../data';
import { readJson } from '../http';

export function registerRecordRoutes(api: Hono<AppEnv>): void {
  api.post('/lists/:listId/items', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'This list holds activity logs');
    const input = await readJson(c.req.raw, itemInput);
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO items
      (id, list_id, owner_id, title, type, note, decision, started_on, ended_on, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        list.id,
        c.get('ownerId'),
        input.title,
        input.type,
        input.note,
        input.decision,
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
    const now = Date.now();
    const items = input.titles.map((title) => ({ id: crypto.randomUUID(), title }));
    await c.env.DB.batch([
      ...items.map((item) =>
        c.env.DB.prepare(
          `INSERT INTO items
            (id, list_id, owner_id, title, type, note, decision, started_on, ended_on, created_at, updated_at)
            VALUES (?, ?, ?, ?, '', '', NULL, NULL, NULL, ?, ?)`,
        ).bind(item.id, list.id, c.get('ownerId'), item.title, now, now),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        list.id,
        c.get('ownerId'),
      ),
    ]);
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
      startedOn: patch.startedOn === undefined ? item.startedOn : patch.startedOn,
      endedOn: patch.endedOn === undefined ? item.endedOn : patch.endedOn,
    });
    if (!merged.success)
      throw new ApiError(400, 'INVALID_INPUT', merged.error.issues[0]?.message ?? 'Invalid item');
    const value = merged.data;
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE items SET title = ?, type = ?, note = ?, decision = ?, started_on = ?, ended_on = ?,
          updated_at = ? WHERE id = ? AND owner_id = ?`,
      ).bind(
        value.title,
        value.type,
        value.note,
        value.decision,
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
      c.env.DB.prepare('DELETE FROM items WHERE id = ? AND owner_id = ?').bind(item.id, c.get('ownerId')),
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
    await c.env.DB.prepare(
      `INSERT INTO logs
      (id, list_id, item_id, owner_id, title, happened_on, note, amount, unit, sets, reps, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        list.id,
        input.itemId,
        c.get('ownerId'),
        input.title,
        input.happenedOn,
        input.note,
        input.amount,
        input.unit,
        input.sets,
        input.reps,
        now,
        now,
      )
      .run();
    await c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?')
      .bind(now, list.id, c.get('ownerId'))
      .run();
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
    if (!merged.success)
      throw new ApiError(400, 'INVALID_INPUT', merged.error.issues[0]?.message ?? 'Invalid log');
    const value = merged.data;
    await validateLogTarget(c.env.DB, c.get('ownerId'), list.id, list.kind, value.itemId, value.title);
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE logs SET item_id = ?, title = ?, happened_on = ?, note = ?, amount = ?,
          unit = ?, sets = ?, reps = ?, updated_at = ? WHERE id = ? AND owner_id = ?`,
      ).bind(
        value.itemId,
        value.title,
        value.happenedOn,
        value.note,
        value.amount,
        value.unit,
        value.sets,
        value.reps,
        now,
        log.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        list.id,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), log.id) });
  });

  api.delete('/logs/:logId', async (c) => {
    const log = await requireLog(c.env.DB, c.get('ownerId'), c.req.param('logId'));
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM logs WHERE id = ? AND owner_id = ?').bind(log.id, c.get('ownerId')),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        log.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });

  api.get('/overview', async (c) => {
    const ownerId = c.get('ownerId');
    const lists = await listLists(c.env.DB, ownerId);
    const { results: recent } = await c.env.DB.prepare(
      `SELECT g.id, g.list_id, g.item_id, l.name AS list_name, l.kind,
      COALESCE(i.title, g.title) AS title, g.happened_on, g.amount, g.unit, g.sets, g.reps
      FROM logs g JOIN lists l ON l.id = g.list_id LEFT JOIN items i ON i.id = g.item_id
      WHERE g.owner_id = ? ORDER BY g.happened_on DESC, g.created_at DESC LIMIT 12`,
    )
      .bind(ownerId)
      .all<{
        id: string;
        list_id: string;
        item_id: string | null;
        list_name: string;
        kind: 'collection' | 'activity';
        title: string;
        happened_on: string;
        amount: number | null;
        unit: string;
        sets: number | null;
        reps: number | null;
      }>();
    const decisionPickQuery = `SELECT l.id AS list_id, l.name AS list_name, i.id AS item_id, i.title, i.type, i.decision
      FROM items i
      JOIN lists l ON l.id = i.list_id AND l.owner_id = i.owner_id
      WHERE i.owner_id = ? AND i.decision = ?
      ORDER BY l.updated_at DESC, i.updated_at DESC LIMIT 5`;
    const rankedPickQuery = `SELECT l.id AS list_id, l.name AS list_name, i.id AS item_id, i.title, i.type,
        CAST(r.key AS INTEGER) + 1 AS rank
      FROM lists l
      JOIN json_each(l.ranked_ids) r
      JOIN items i ON i.id = r.value AND i.owner_id = l.owner_id
      WHERE l.owner_id = ? AND l.kind = 'collection'
      ORDER BY CAST(r.key AS INTEGER) ASC, l.updated_at DESC, i.updated_at DESC
      LIMIT 5`;
    const [rankedQuery, favoritesQuery, notAgainQuery] = await Promise.all([
      c.env.DB.prepare(rankedPickQuery).bind(ownerId).all<{
        list_id: string;
        list_name: string;
        item_id: string;
        title: string;
        type: string;
        rank: number;
      }>(),
      c.env.DB.prepare(decisionPickQuery).bind(ownerId, 'favorite').all<{
        list_id: string;
        list_name: string;
        item_id: string;
        title: string;
        type: string;
        decision: 'favorite';
      }>(),
      c.env.DB.prepare(decisionPickQuery).bind(ownerId, 'would_not_again').all<{
        list_id: string;
        list_name: string;
        item_id: string;
        title: string;
        type: string;
        decision: 'would_not_again';
      }>(),
    ]);
    const { results: lastTimes } = await c.env.DB.prepare(
      `WITH latest_activity AS (
        SELECT g.id, g.list_id, g.title, g.happened_on,
        ROW_NUMBER() OVER (
          PARTITION BY g.list_id, g.title
          ORDER BY g.happened_on DESC, g.created_at DESC
        ) AS position
        FROM logs g
        WHERE g.owner_id = ? AND g.item_id IS NULL
      )
      SELECT a.id, a.list_id, l.name AS list_name, a.title, a.happened_on
      FROM latest_activity a
      JOIN lists l ON l.id = a.list_id AND l.owner_id = ?
      WHERE a.position = 1
      ORDER BY a.happened_on DESC
      LIMIT 4`,
    )
      .bind(ownerId, ownerId)
      .all<{ id: string; list_id: string; list_name: string; title: string; happened_on: string }>();
    return c.json({
      lists,
      recent: recent.map((row) => ({
        id: row.id,
        listId: row.list_id,
        listName: row.list_name,
        kind: row.kind,
        itemId: row.item_id,
        title: row.title,
        happenedOn: row.happened_on,
        amount: row.amount,
        unit: row.unit,
        sets: row.sets,
        reps: row.reps,
      })),
      ranked: rankedQuery.results.map((row) => ({
        listId: row.list_id,
        listName: row.list_name,
        itemId: row.item_id,
        title: row.title,
        type: row.type,
        rank: row.rank,
      })),
      favorites: favoritesQuery.results.map((row) => ({
        listId: row.list_id,
        listName: row.list_name,
        itemId: row.item_id,
        title: row.title,
        type: row.type,
        decision: row.decision,
      })),
      notAgain: notAgainQuery.results.map((row) => ({
        listId: row.list_id,
        listName: row.list_name,
        itemId: row.item_id,
        title: row.title,
        type: row.type,
        decision: row.decision,
      })),
      lastTimes: lastTimes.map((row) => ({
        id: row.id,
        listId: row.list_id,
        listName: row.list_name,
        title: row.title,
        happenedOn: row.happened_on,
      })),
    });
  });

  api.get('/patterns', async (c) => {
    const ownerId = c.get('ownerId');
    const [summary, mostReturned, lastTouchedCollection, newestCollection, mostKeptCollection] =
      await Promise.all([
        c.env.DB.prepare(
          `SELECT
          (SELECT COUNT(*) FROM items WHERE owner_id = ?) + (SELECT COUNT(*) FROM logs WHERE owner_id = ?) AS total_records,
          (SELECT COUNT(*) FROM lists WHERE owner_id = ? AND kind = 'collection') AS total_collections,
          (SELECT COUNT(*) FROM lists WHERE owner_id = ? AND kind = 'activity') AS total_activities,
          (SELECT COALESCE(SUM(json_array_length(ranked_ids)), 0) FROM lists
            WHERE owner_id = ? AND kind = 'collection') AS ranked_item_count,
          (SELECT COUNT(*) FROM logs WHERE owner_id = ? AND item_id IS NOT NULL) AS revisit_count,
          (SELECT COUNT(*) FROM items WHERE owner_id = ? AND decision = 'favorite') AS favorite_count,
          (SELECT COUNT(*) FROM items WHERE owner_id = ? AND decision = 'would_not_again') AS not_again_count`,
        )
          .bind(ownerId, ownerId, ownerId, ownerId, ownerId, ownerId, ownerId, ownerId)
          .first<{
            total_records: number;
            total_collections: number;
            total_activities: number;
            ranked_item_count: number;
            revisit_count: number;
            favorite_count: number;
            not_again_count: number;
          }>(),
        c.env.DB.prepare(
          `SELECT l.id AS list_id, i.id AS item_id, l.name AS list_name, i.title, COUNT(*) AS revisit_count
        FROM logs g
        JOIN items i ON i.id = g.item_id AND i.owner_id = g.owner_id
        JOIN lists l ON l.id = i.list_id AND l.owner_id = i.owner_id
        WHERE g.owner_id = ? AND g.item_id IS NOT NULL
        GROUP BY i.id
        ORDER BY revisit_count DESC, MAX(g.happened_on) DESC, i.title ASC
        LIMIT 1`,
        )
          .bind(ownerId)
          .first<{
            list_id: string;
            item_id: string;
            list_name: string;
            title: string;
            revisit_count: number;
          }>(),
        c.env.DB.prepare(
          `SELECT l.id, l.name, COUNT(i.id) AS item_count
        FROM lists l
        LEFT JOIN items i ON i.list_id = l.id AND i.owner_id = l.owner_id
        WHERE l.owner_id = ? AND l.kind = 'collection'
        GROUP BY l.id
        ORDER BY l.updated_at DESC
        LIMIT 1`,
        )
          .bind(ownerId)
          .first<{ id: string; name: string; item_count: number }>(),
        c.env.DB.prepare(
          `SELECT l.id, l.name, COUNT(i.id) AS item_count
        FROM lists l
        LEFT JOIN items i ON i.list_id = l.id
        WHERE l.owner_id = ? AND l.kind = 'collection'
        GROUP BY l.id
        ORDER BY l.created_at DESC
        LIMIT 1`,
        )
          .bind(ownerId)
          .first<{ id: string; name: string; item_count: number }>(),
        c.env.DB.prepare(
          `SELECT l.id, l.name, COUNT(i.id) AS item_count
        FROM lists l
        JOIN items i ON i.list_id = l.id AND i.owner_id = l.owner_id
        WHERE l.owner_id = ? AND l.kind = 'collection'
        GROUP BY l.id
        ORDER BY item_count DESC, l.updated_at DESC, l.name ASC
        LIMIT 1`,
        )
          .bind(ownerId)
          .first<{ id: string; name: string; item_count: number }>(),
      ]);
    return c.json({
      totalRecords: summary?.total_records ?? 0,
      totalCollections: summary?.total_collections ?? 0,
      totalActivities: summary?.total_activities ?? 0,
      rankedItemCount: summary?.ranked_item_count ?? 0,
      revisitCount: summary?.revisit_count ?? 0,
      favoriteCount: summary?.favorite_count ?? 0,
      notAgainCount: summary?.not_again_count ?? 0,
      mostReturned: mostReturned
        ? {
            listId: mostReturned.list_id,
            itemId: mostReturned.item_id,
            listName: mostReturned.list_name,
            title: mostReturned.title,
            count: mostReturned.revisit_count,
          }
        : null,
      newestCollection: newestCollection
        ? { id: newestCollection.id, name: newestCollection.name, itemCount: newestCollection.item_count }
        : null,
      lastTouchedCollection: lastTouchedCollection
        ? {
            id: lastTouchedCollection.id,
            name: lastTouchedCollection.name,
            itemCount: lastTouchedCollection.item_count,
          }
        : null,
      mostKeptCollection: mostKeptCollection
        ? {
            id: mostKeptCollection.id,
            name: mostKeptCollection.name,
            itemCount: mostKeptCollection.item_count,
          }
        : null,
    });
  });

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
      i.title, i.type AS detail FROM items i JOIN lists l ON l.id = i.list_id
      WHERE i.owner_id = ? AND (
        i.title LIKE ? ESCAPE '\\' OR i.type LIKE ? ESCAPE '\\' OR i.note LIKE ? ESCAPE '\\'
      )
      ORDER BY i.updated_at DESC LIMIT 40`,
    )
      .bind(ownerId, pattern, pattern, pattern)
      .all<{ id: string; list_id: string; list_name: string; title: string; detail: string }>();
    const { results: logs } = await c.env.DB.prepare(
      `SELECT g.id, g.list_id, g.item_id, l.name AS list_name,
      COALESCE(i.title, g.title) AS title, g.happened_on AS detail
      FROM logs g
      JOIN lists l ON l.id = g.list_id
      LEFT JOIN items i ON i.id = g.item_id AND i.owner_id = g.owner_id
      WHERE g.owner_id = ? AND (
        g.title LIKE ? ESCAPE '\\' OR g.note LIKE ? ESCAPE '\\'
      )
      ORDER BY g.happened_on DESC LIMIT 40`,
    )
      .bind(ownerId, pattern, pattern)
      .all<{
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
          itemId: row.item_id,
        })),
      ],
    });
  });
}

async function validateLogTarget(
  db: D1Database,
  ownerId: string,
  listId: string,
  kind: 'collection' | 'activity',
  itemId: string | null,
  title: string,
): Promise<void> {
  if (kind === 'activity') {
    if (itemId !== null || !title)
      throw new ApiError(400, 'INVALID_LOG', 'An activity needs a title and no item');
    return;
  }
  if (!itemId) throw new ApiError(400, 'INVALID_LOG', 'Choose an item for this log');
  const item = await requireItem(db, ownerId, itemId);
  if (item.listId !== listId) throw new ApiError(400, 'INVALID_LOG', 'The item belongs to another list');
}
