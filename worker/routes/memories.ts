import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireList } from '../data';
import { memoryFilter, type MemoryRecord, type PreferenceGroup } from '../../src/shared/memories';

export function registerMemoryRoutes(api: Hono<AppEnv>) {
  api.get('/memories', async (c) => {
    const parsed = memoryFilter.safeParse(c.req.query());
    if (!parsed.success)
      throw new ApiError(400, 'INVALID_FILTER', 'Choose real dates and a valid memory filter.');
    const f = parsed.data,
      owner = c.get('ownerId');
    if (f.list && f.list !== 'inbox') await requireList(c.env.DB, owner, f.list);
    const source =
      f.mode === 'saved'
        ? `SELECT i.id,i.id AS itemId,i.list_id AS listId,l.name AS listName,i.title,i.note,date(i.created_at/1000,'unixepoch') AS date,'saved' AS kind,json_extract(i.context_json,'$.location') AS location,'' AS "order",i.decision AS reaction,EXISTS(SELECT 1 FROM item_photos p WHERE p.item_id=i.id) AS hasPhoto,i.type,i.context_json,i.created_at AS sortTime FROM active_items i JOIN active_lists l ON l.id=i.list_id AND l.owner_id=i.owner_id WHERE i.owner_id=? AND (?='1' OR l.archived=0)
          UNION ALL SELECT e.id,NULL AS itemId,NULL AS listId,'Unfiled' AS listName,json_extract(e.payload_json,'$.title') AS title,COALESCE(json_extract(e.payload_json,'$.note'),'') AS note,date(e.created_at/1000,'unixepoch') AS date,'unfiled' AS kind,json_extract(e.payload_json,'$.context.location') AS location,'' AS "order",json_extract(e.payload_json,'$.decision') AS reaction,EXISTS(SELECT 1 FROM inbox_photos p WHERE p.inbox_id=e.id AND p.owner_id=e.owner_id AND p.removed_at IS NULL AND p.data IS NOT NULL) AS hasPhoto,COALESCE(json_extract(e.payload_json,'$.type'),'') AS type,COALESCE(json_extract(e.payload_json,'$.context'),'{}') AS context_json,e.created_at AS sortTime FROM inbox_entries e WHERE e.owner_id=? AND e.trashed_at IS NULL`
        : `SELECT g.id,i.id AS itemId,g.list_id AS listId,l.name AS listName,COALESCE(i.title,NULLIF(g.title,''),'Untitled visit') AS title,g.note,g.happened_on AS date,CASE WHEN l.kind='collection' THEN 'visit' ELSE 'activity' END AS kind,json_extract(g.context_json,'$.location') AS location,json_extract(g.context_json,'$.order') AS "order",json_extract(g.context_json,'$.reaction') AS reaction,EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id=g.id) AS hasPhoto,COALESCE(i.type,'') AS type,COALESCE(i.context_json,'{}') AS context_json,g.created_at AS sortTime FROM active_logs g JOIN active_lists l ON l.id=g.list_id AND l.owner_id=g.owner_id LEFT JOIN record_items original ON original.id=g.item_id AND original.owner_id=g.owner_id LEFT JOIN active_items i ON i.id=COALESCE(original.merged_into_id,original.id) AND i.owner_id=g.owner_id AND i.list_id=g.list_id WHERE g.owner_id=? AND (?='1' OR l.archived=0)
          UNION ALL SELECT e.id,NULL AS itemId,NULL AS listId,'Unfiled' AS listName,json_extract(e.payload_json,'$.title') AS title,COALESCE(json_extract(e.payload_json,'$.note'),'') AS note,json_extract(e.payload_json,'$.memory.happenedOn') AS date,'unfiled-visit' AS kind,json_extract(e.payload_json,'$.context.location') AS location,'' AS "order",json_extract(e.payload_json,'$.memory.reaction') AS reaction,EXISTS(SELECT 1 FROM inbox_photos p WHERE p.inbox_id=e.id AND p.owner_id=e.owner_id AND p.removed_at IS NULL AND p.data IS NOT NULL) AS hasPhoto,COALESCE(json_extract(e.payload_json,'$.type'),'') AS type,COALESCE(json_extract(e.payload_json,'$.context'),'{}') AS context_json,e.created_at AS sortTime FROM inbox_entries e WHERE e.owner_id=? AND e.trashed_at IS NULL AND json_extract(e.payload_json,'$.memory.happenedOn') IS NOT NULL`;
    const pattern = `%${f.q.replace(/[\\%_]/g, '\\$&')}%`;
    const sql = `WITH memories AS (${source}) SELECT * FROM memories WHERE (?='' OR listId=? OR (?='inbox' AND kind IN ('unfiled','unfiled-visit'))) AND (?='' OR date>=?) AND (?='' OR date<=?) AND (?='' OR type=?) AND (?='' OR EXISTS(SELECT 1 FROM json_each(context_json,'$.labels') WHERE value=?)) AND (?='' OR title LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR "order" LIKE ? ESCAPE '\\')`;
    const args = [
      owner,
      f.archived,
      owner,
      f.list,
      f.list,
      f.list,
      f.from,
      f.from,
      f.to,
      f.to,
      f.type,
      f.type,
      f.label,
      f.label,
      f.q,
      pattern,
      pattern,
      pattern,
      pattern,
    ];
    const [count, rows] = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT COUNT(*) AS total FROM (${sql})`).bind(...args),
      c.env.DB.prepare(`${sql} ORDER BY date DESC,sortTime DESC,id DESC LIMIT 50 OFFSET ?`).bind(
        ...args,
        f.offset,
      ),
    ]);
    const total = (count.results[0] as { total: number }).total;
    return c.json({
      total,
      nextOffset: f.offset + rows.results.length < total ? f.offset + rows.results.length : null,
      records: (rows.results as (Omit<MemoryRecord, 'hasPhoto'> & { hasPhoto: number })[]).map(
        (row) =>
          ({
            id: row.id,
            itemId: row.itemId,
            listId: row.listId,
            listName: row.listName,
            title: row.title,
            note: row.note,
            date: row.date,
            kind: row.kind,
            location: row.location ?? '',
            order: row.order ?? '',
            reaction: row.reaction ?? null,
            hasPhoto: !!row.hasPhoto,
          }) as MemoryRecord,
      ),
    });
  });

  api.get('/preferences', async (c) => {
    const owner = c.get('ownerId');
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const [groups, returns, rediscover] = await c.env.DB.batch([
      c.env.DB.prepare(
        `WITH records AS (
          SELECT i.id,i.list_id,i.owner_id,i.type,i.context_json,i.decision,l.name AS listName FROM active_items i JOIN active_lists l ON l.id=i.list_id AND l.owner_id=i.owner_id WHERE i.owner_id=? AND l.archived=0
          UNION ALL SELECT e.id,'inbox' AS list_id,e.owner_id,COALESCE(json_extract(e.payload_json,'$.type'),''),COALESCE(json_extract(e.payload_json,'$.context'),'{}'),json_extract(e.payload_json,'$.decision'),'Unfiled' AS listName FROM inbox_entries e WHERE e.owner_id=? AND e.trashed_at IS NULL
        ), facts AS (
          SELECT list_id,listName,type,context_json,'records' AS basis,decision FROM records
          UNION ALL SELECT i.list_id,i.listName,i.type,i.context_json,'visits',json_extract(g.context_json,'$.reaction') FROM records i JOIN record_items original ON COALESCE(original.merged_into_id,original.id)=i.id AND original.owner_id=i.owner_id JOIN active_logs g ON g.item_id=original.id AND g.owner_id=i.owner_id AND g.list_id=i.list_id
        UNION ALL SELECT 'inbox','Unfiled',COALESCE(json_extract(e.payload_json,'$.type'),''),COALESCE(json_extract(e.payload_json,'$.context'),'{}'),'visits',json_extract(e.payload_json,'$.memory.reaction') FROM inbox_entries e WHERE e.owner_id=? AND e.trashed_at IS NULL AND json_extract(e.payload_json,'$.memory.happenedOn') IS NOT NULL
        ), groups AS (
          SELECT list_id AS listId,listName,'collection' AS kind,basis,listName AS name,decision FROM facts
          UNION ALL SELECT list_id,listName,'type',basis,type,decision FROM facts WHERE type<>''
          UNION ALL SELECT i.list_id,i.listName,'label',i.basis,label.value,i.decision FROM facts i JOIN json_each(i.context_json,'$.labels') label WHERE label.type='text' AND label.value<>''
        ) SELECT listId,listName,kind,basis,name,SUM(decision='favorite') AS favorite,SUM(decision='meh') AS meh,SUM(decision='would_not_again') AS notAgain,SUM(decision IS NULL) AS unrated FROM groups GROUP BY listId,listName,kind,basis,name HAVING COUNT(decision)>0 ORDER BY COUNT(decision) DESC,listName,kind,basis,name LIMIT 12`,
      ).bind(owner, owner, owner),
      c.env.DB.prepare(
        `SELECT i.id AS itemId,i.list_id AS listId,i.title,COUNT(*) AS visits,COALESCE(SUM(json_extract(g.context_json,'$.reaction')='favorite'),0) AS favorites,MAX(g.happened_on) AS lastDate FROM active_logs g JOIN record_items original ON original.id=g.item_id AND original.owner_id=g.owner_id JOIN active_items i ON i.id=COALESCE(original.merged_into_id,original.id) AND i.owner_id=g.owner_id AND i.list_id=g.list_id JOIN active_lists l ON l.id=g.list_id AND l.owner_id=g.owner_id WHERE g.owner_id=? AND l.archived=0 GROUP BY i.id HAVING COUNT(*)>=2 ORDER BY COUNT(*) DESC,lastDate DESC,i.id LIMIT 6`,
      ).bind(owner),
      c.env.DB.prepare(
        `SELECT i.id AS itemId,i.list_id AS listId,i.title,MAX(g.happened_on) AS lastDate FROM active_items i JOIN active_lists l ON l.id=i.list_id AND l.owner_id=i.owner_id JOIN record_items original ON COALESCE(original.merged_into_id,original.id)=i.id AND original.owner_id=i.owner_id JOIN active_logs g ON g.item_id=original.id AND g.owner_id=i.owner_id AND g.list_id=i.list_id WHERE i.owner_id=? AND l.archived=0 AND i.decision='favorite' GROUP BY i.id HAVING MAX(g.happened_on)<? ORDER BY lastDate DESC,i.id LIMIT 3`,
      ).bind(owner, cutoff),
    ]);
    return c.json({
      groups: (groups.results as PreferenceGroup[]).map((row) => ({
        ...row,
        favorite: row.favorite ?? 0,
        meh: row.meh ?? 0,
        notAgain: row.notAgain ?? 0,
      })),
      returns: returns.results,
      rediscover: rediscover.results,
    });
  });
}
