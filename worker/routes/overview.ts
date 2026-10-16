import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { listLists } from '../data';

export function registerOverviewRoutes(api: Hono<AppEnv>): void {
  api.get('/overview', async (c) => {
    const ownerId = c.get('ownerId');
    const lists = await listLists(c.env.DB, ownerId);
    const { results: recent } = await c.env.DB.prepare(
      `WITH recent_records AS (
        SELECT g.id, g.list_id, COALESCE(i.id, g.item_id) AS item_id, l.name AS list_name, l.kind, 'log' AS record_kind,
          COALESCE(i.title, g.title) AS title, g.happened_on,
          CAST(strftime('%s', g.happened_on) AS INTEGER) * 1000 AS recorded_at,
          g.amount, g.unit, g.sets, g.reps, NULL AS decision
        FROM active_logs g
        JOIN active_lists l ON l.id = g.list_id
        LEFT JOIN record_items original ON original.id = g.item_id
        LEFT JOIN active_items i ON i.id = COALESCE(original.merged_into_id, original.id)
        WHERE g.owner_id = ? AND l.archived = 0
        UNION ALL
        SELECT i.id, i.list_id, i.id AS item_id, l.name AS list_name, l.kind, 'item' AS record_kind,
          i.title, NULL AS happened_on, i.updated_at AS recorded_at,
          NULL AS amount, '' AS unit, NULL AS sets, NULL AS reps, i.decision
        FROM active_items i
        JOIN active_lists l ON l.id = i.list_id
        WHERE i.owner_id = ? AND l.archived = 0
      )
      SELECT * FROM recent_records
      ORDER BY recorded_at DESC, id DESC
      LIMIT 12`,
    )
      .bind(ownerId, ownerId)
      .all<{
        id: string;
        list_id: string;
        item_id: string | null;
        list_name: string;
        kind: 'collection' | 'activity';
        record_kind: 'item' | 'log';
        decision: 'favorite' | 'meh' | 'would_not_again' | null;
        title: string;
        happened_on: string | null;
        recorded_at: number;
        amount: number | null;
        unit: string;
        sets: number | null;
        reps: number | null;
      }>();
    const decisionPickQuery = `SELECT l.id AS list_id, l.name AS list_name, i.id AS item_id, i.title, i.type, i.decision
      FROM active_items i
      JOIN active_lists l ON l.id = i.list_id AND l.owner_id = i.owner_id
      WHERE i.owner_id = ? AND l.archived = 0 AND i.decision = ?
      ORDER BY l.updated_at DESC, i.updated_at DESC LIMIT 5`;
    const rankedPickQuery = `SELECT l.id AS list_id, l.name AS list_name, i.id AS item_id, i.title, i.type,
        CAST(r.key AS INTEGER) + 1 AS rank
      FROM active_lists l
      JOIN json_each(l.ranked_ids) r
      JOIN active_items i ON i.id = r.value AND i.owner_id = l.owner_id
      WHERE l.owner_id = ? AND l.kind = 'collection' AND l.archived = 0
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
        FROM active_logs g
        WHERE g.owner_id = ? AND g.item_id IS NULL
      )
      SELECT a.id, a.list_id, l.name AS list_name, a.title, a.happened_on
      FROM latest_activity a
      JOIN active_lists l ON l.id = a.list_id AND l.owner_id = ?
      WHERE a.position = 1 AND l.archived = 0
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
        recordKind: row.record_kind,
        decision: row.decision,
        itemId: row.item_id,
        title: row.title,
        happenedOn: row.happened_on,
        recordedAt: row.recorded_at,
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
          (SELECT COUNT(*) FROM active_items WHERE owner_id = ?) + (SELECT COUNT(*) FROM active_logs WHERE owner_id = ?) AS total_records,
          (SELECT COUNT(*) FROM active_lists WHERE owner_id = ? AND kind = 'collection') AS total_collections,
          (SELECT COUNT(*) FROM active_lists WHERE owner_id = ? AND kind = 'activity') AS total_activities,
          (SELECT COALESCE(SUM(json_array_length(ranked_ids)), 0) FROM active_lists
            WHERE owner_id = ? AND kind = 'collection') AS ranked_item_count,
          (SELECT COUNT(*) FROM active_logs WHERE owner_id = ? AND item_id IS NOT NULL) AS revisit_count,
          (SELECT COUNT(*) FROM active_items WHERE owner_id = ? AND decision = 'favorite') AS favorite_count,
          (SELECT COUNT(*) FROM active_items WHERE owner_id = ? AND decision = 'would_not_again') AS not_again_count,
          (SELECT COUNT(*) FROM active_items WHERE owner_id = ? AND decision = 'meh') AS meh_count`,
        )
          .bind(ownerId, ownerId, ownerId, ownerId, ownerId, ownerId, ownerId, ownerId, ownerId)
          .first<{
            total_records: number;
            total_collections: number;
            total_activities: number;
            ranked_item_count: number;
            revisit_count: number;
            favorite_count: number;
            not_again_count: number;
            meh_count: number;
          }>(),
        c.env.DB.prepare(
          `SELECT l.id AS list_id, i.id AS item_id, l.name AS list_name, i.title, COUNT(*) AS revisit_count
        FROM active_logs g
        JOIN record_items original ON original.id = g.item_id AND original.owner_id = g.owner_id
        JOIN active_items i ON i.id = COALESCE(original.merged_into_id, original.id) AND i.owner_id = g.owner_id
        JOIN active_lists l ON l.id = i.list_id AND l.owner_id = i.owner_id
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
        FROM active_lists l
        LEFT JOIN active_items i ON i.list_id = l.id AND i.owner_id = l.owner_id
        WHERE l.owner_id = ? AND l.kind = 'collection'
        GROUP BY l.id
        ORDER BY l.updated_at DESC
        LIMIT 1`,
        )
          .bind(ownerId)
          .first<{ id: string; name: string; item_count: number }>(),
        c.env.DB.prepare(
          `SELECT l.id, l.name, COUNT(i.id) AS item_count
        FROM active_lists l
        LEFT JOIN active_items i ON i.list_id = l.id
        WHERE l.owner_id = ? AND l.kind = 'collection'
        GROUP BY l.id
        ORDER BY l.created_at DESC
        LIMIT 1`,
        )
          .bind(ownerId)
          .first<{ id: string; name: string; item_count: number }>(),
        c.env.DB.prepare(
          `SELECT l.id, l.name, COUNT(i.id) AS item_count
        FROM active_lists l
        JOIN active_items i ON i.list_id = l.id AND i.owner_id = l.owner_id
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
      mehCount: summary?.meh_count ?? 0,
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
}
