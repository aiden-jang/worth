import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, listItems, requireList } from '../data';
import { readJson } from '../http';
import { fingerprint, operationId, previousOperation } from '../operations';
import { reviewedItemsInput } from '../../src/shared/reviewed-capture';

export function registerReviewedCaptureRoutes(api: Hono<AppEnv>) {
  api.post('/lists/:listId/items/import', async (c) => {
    const owner = c.get('ownerId');
    const list = await requireList(c.env.DB, owner, c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'Choose a collection.');
    const input = await readJson(c.req.raw, reviewedItemsInput, 512 * 1024);
    const key = operationId(c.req.header('Idempotency-Key'));
    const hash = await fingerprint({ listId: list.id, format: 'reviewed-items', items: input.items });
    const reply = async (ids: string[]) => {
      const saved = await listItems(c.env.DB, owner, list.id, false, ids);
      const byId = new Map(saved.map((item) => [item.id, item]));
      if (ids.some((id) => !byId.has(id)))
        throw new ApiError(
          409,
          'CAPTURE_RECORDS_CHANGED',
          'This capture was saved, but some records have since moved, merged or gone to Trash. Check the collection before starting over.',
        );
      return c.json({ items: ids.map((id) => byId.get(id)!) }, 201);
    };
    const prior = await previousOperation(c.env.DB, key, owner, 'batch', hash);
    if (prior) return reply(prior.ids);
    const now = Date.now();
    const rows = input.items.map((item) => ({ ...item, id: crypto.randomUUID() }));
    try {
      const saved = await c.env.DB.batch([
        c.env.DB.prepare(
          'INSERT INTO capture_operations (id,owner_id,list_id,kind,fingerprint,result_json,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM active_lists WHERE id = ? AND owner_id = ?)',
        ).bind(
          key,
          owner,
          list.id,
          'batch',
          hash,
          JSON.stringify({ ids: rows.map((row) => row.id) }),
          now,
          list.id,
          owner,
        ),
        c.env.DB.prepare(
          `INSERT INTO items (id,list_id,owner_id,title,type,note,decision,revisit_queued,want_to_try,context_json,started_on,ended_on,created_at,updated_at)
          SELECT json_extract(value,'$.id'), ?, ?, json_extract(value,'$.title'), json_extract(value,'$.type'), json_extract(value,'$.note'), json_extract(value,'$.decision'), json_extract(value,'$.revisitQueued'), json_extract(value,'$.wantToTry'), json_extract(value,'$.context'), json_extract(value,'$.startedOn'), json_extract(value,'$.endedOn'), ?, ? FROM json_each(?) WHERE EXISTS (SELECT 1 FROM capture_operations WHERE id = ? AND owner_id = ?)`,
        ).bind(list.id, owner, now, now, JSON.stringify(rows), key, owner),
        c.env.DB.prepare(
          'UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ? AND EXISTS (SELECT 1 FROM capture_operations WHERE id = ? AND owner_id = ?)',
        ).bind(now, list.id, owner, key, owner),
      ]);
      if (!saved[0].meta.changes)
        throw new ApiError(
          409,
          'COLLECTION_CHANGED',
          'This collection changed. Refresh it before saving again.',
        );
    } catch (failure) {
      const saved = await previousOperation(c.env.DB, key, owner, 'batch', hash);
      if (saved) return reply(saved.ids);
      throw failure;
    }
    return reply(rows.map((row) => row.id));
  });
}
