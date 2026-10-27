import { writeAnalytics } from '../../analytics/worker';
import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireItem, requireList, requireLog } from '../data';
import { readJson } from '../http';
import { experienceInput } from '../../src/shared/memories';
import { fingerprint, operationId } from '../operations';

export function registerExperienceRoutes(api: Hono<AppEnv>) {
  api.post('/lists/:listId/experiences', async (c) => {
    const owner = c.get('ownerId'),
      db = c.env.DB;
    const list = await requireList(db, owner, c.req.param('listId'));
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Choose a collection for this experience.');
    const input = await readJson(c.req.raw, experienceInput, 32 * 1024);
    const key = operationId(c.req.header('Idempotency-Key'));
    const hash = await fingerprint({ kind: 'experience', listId: list.id, input });
    async function previous() {
      const row = await db
        .prepare('SELECT owner_id, fingerprint, result_json FROM archive_operations WHERE id=?')
        .bind(key)
        .first<{ owner_id: string; fingerprint: string; result_json: string }>();
      if (!row) return null;
      if (row.owner_id !== owner || row.fingerprint !== hash)
        throw new ApiError(
          409,
          'OPERATION_CHANGED',
          'This retry differs from the saved experience. Review your collection before starting another.',
        );
      const result = JSON.parse(row.result_json) as { itemId: string; logId: string };
      return {
        item: await requireItem(db, owner, result.itemId),
        log: await requireLog(db, owner, result.logId),
      };
    }
    const saved = await previous();
    if (saved) return c.json(saved, 201);
    if (input.itemId) {
      const item = await requireItem(db, owner, input.itemId);
      if (item.listId !== list.id)
        throw new ApiError(400, 'INVALID_LOG', 'Choose a record from this collection.');
    }
    const itemId = input.itemId ?? crypto.randomUUID(),
      logId = crypto.randomUUID(),
      now = Date.now();
    try {
      // One D1 transaction records both the new name and its visit, including the retry receipt.
      await db.batch([
        db
          .prepare(
            `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM active_lists WHERE id=? AND owner_id=?) AND (? IS NULL OR EXISTS(SELECT 1 FROM active_items WHERE id=? AND owner_id=? AND list_id=?)) THEN 'null' ELSE 'experience target changed' END)`,
          )
          .bind(list.id, owner, input.itemId, input.itemId, owner, list.id),
        db
          .prepare(
            'INSERT INTO archive_operations(id,owner_id,fingerprint,result_json,created_at) VALUES(?,?,?,?,?)',
          )
          .bind(key, owner, hash, JSON.stringify({ itemId, logId }), now),
        ...(!input.itemId
          ? [
              db
                .prepare(
                  'INSERT INTO items(id,list_id,owner_id,title,type,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
                )
                .bind(itemId, list.id, owner, input.title, input.type, now, now),
            ]
          : []),
        db
          .prepare(
            'INSERT INTO logs(id,list_id,item_id,owner_id,title,happened_on,note,context_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            logId,
            list.id,
            itemId,
            owner,
            input.title,
            input.happenedOn,
            input.note,
            JSON.stringify(input.context),
            now,
            now,
          ),
        db.prepare('UPDATE lists SET updated_at=? WHERE id=? AND owner_id=?').bind(now, list.id, owner),
      ]);
    } catch (error) {
      const result = await previous();
      if (result) return c.json(result, 201);
      if (error instanceof Error && error.message.includes('malformed JSON'))
        throw new ApiError(
          409,
          'LOG_CHANGED',
          'The collection changed. Keep your draft and reload before trying again.',
        );
      throw error;
    }
    if (!input.itemId) writeAnalytics(c.env, { name: 'item_created' });
    return c.json(
      { item: await requireItem(db, owner, itemId), log: await requireLog(db, owner, logId) },
      201,
    );
  });
}
