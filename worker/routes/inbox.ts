import { writeAnalytics } from '../../analytics/worker';
import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireItem, requireList } from '../data';
import { readJson } from '../http';
import { fingerprint, operationId } from '../operations';
import { inboxCreate, inboxEdit, inboxFile, inboxLimit, inboxPayload } from '../../src/shared/inbox';
import { visitContext } from '../../src/shared/visit-context';
import { registerInboxPhotos } from './inbox-photos';
import {
  inboxChanged,
  inboxGuard,
  previousInboxOperation,
  readInbox,
  requireInbox,
  type InboxResult,
} from '../inbox';

export function registerInboxRoutes(api: Hono<AppEnv>) {
  registerInboxPhotos(api);
  api.get('/inbox', async (c) => c.json({ entries: await readInbox(c.env.DB, c.get('ownerId')) }));
  api.get('/inbox/:id', async (c) =>
    c.json({ entry: await requireInbox(c.env.DB, c.get('ownerId'), c.req.param('id')) }),
  );
  api.post('/inbox', async (c) => {
    const owner = c.get('ownerId'),
      key = operationId(c.req.header('Idempotency-Key'));
    const input = await readJson(c.req.raw, inboxCreate, 32 * 1024),
      hash = await fingerprint(input);
    const reply = async (saved: InboxResult) => {
      try {
        return c.json({ entry: await requireInbox(c.env.DB, owner, saved.entryId) }, 201);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404)
          throw new ApiError(
            409,
            'INBOX_ENTRY_CHANGED',
            'This find was saved, then filed or moved to Trash. Check the Inbox and collections before starting again.',
          );
        throw error;
      }
    };
    const prior = await previousInboxOperation(c.env.DB, owner, key, 'create', hash);
    if (prior) return reply(prior);
    const id = crypto.randomUUID(),
      now = Date.now();
    const result = { entryId: id, itemId: null, listId: null };
    try {
      await c.env.DB.batch([
        inboxGuard(
          c.env.DB,
          'SELECT COUNT(*) < ? FROM inbox_entries WHERE owner_id = ? AND trashed_at IS NULL',
          [inboxLimit, owner],
        ),
        c.env.DB.prepare(
          'INSERT INTO inbox_operations (id, owner_id, kind, fingerprint, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(key, owner, 'create', hash, JSON.stringify(result), now),
        c.env.DB.prepare(
          'INSERT INTO inbox_entries (id, owner_id, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ).bind(id, owner, JSON.stringify(input.item), now, now),
      ]);
    } catch (error) {
      const saved = await previousInboxOperation(c.env.DB, owner, key, 'create', hash);
      if (saved) return reply(saved);
      inboxChanged(error);
    }
    writeAnalytics(c.env, { name: 'inbox_saved' });
    return reply(result);
  });
  api.put('/inbox/:id', async (c) => {
    const owner = c.get('ownerId'),
      id = c.req.param('id');
    const entry = await requireInbox(c.env.DB, owner, id);
    const { item: received, expectedRevision } = await readJson(c.req.raw, inboxEdit, 32 * 1024);
    // Older installed clients cannot edit a memory they do not know about.
    const item = received.memory === undefined ? { ...received, memory: entry.memory } : received;
    const payload = JSON.stringify(item);
    if (entry.revision !== expectedRevision) {
      if (JSON.stringify(inboxPayload.parse(entry)) === payload) return c.json({ entry });
      throw new ApiError(
        409,
        'INBOX_CHANGED',
        'This Inbox find changed elsewhere. Your draft is still here. Reload before saving.',
      );
    }
    const updated = await c.env.DB.prepare(
      'UPDATE inbox_entries SET payload_json = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ? AND trashed_at IS NULL',
    )
      .bind(payload, Math.max(Date.now(), entry.updatedAt + 1), id, owner, expectedRevision)
      .run();
    if (!updated.meta.changes)
      throw new ApiError(409, 'INBOX_CHANGED', 'This Inbox find changed elsewhere. Reload before saving.');
    return c.json({ entry: await requireInbox(c.env.DB, owner, id) });
  });
  api.delete('/inbox/:id', async (c) => {
    const owner = c.get('ownerId'),
      id = c.req.param('id');
    await requireInbox(c.env.DB, owner, id);
    const removed = await c.env.DB.prepare(
      'UPDATE inbox_entries SET trashed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND trashed_at IS NULL',
    )
      .bind(Date.now(), Date.now(), id, owner)
      .run();
    if (!removed.meta.changes)
      throw new ApiError(
        409,
        'INBOX_CHANGED',
        'This find was filed or removed elsewhere. Refresh the Inbox.',
      );
    return c.body(null, 204);
  });
  api.post('/inbox/:id/file', async (c) => {
    const owner = c.get('ownerId'),
      key = operationId(c.req.header('Idempotency-Key')),
      entryId = c.req.param('id');
    const input = await readJson(c.req.raw, inboxFile),
      hash = await fingerprint({ entryId, ...input });
    const reply = async (result: InboxResult) => {
      try {
        const item = await requireItem(c.env.DB, owner, result.itemId!);
        if (item.listId !== result.listId)
          throw new ApiError(
            409,
            'INBOX_FILED_CHANGED',
            'This find was already filed, then moved. Check your collections.',
          );
        return c.json({ item, logId: result.logId ?? null }, 201);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404)
          throw new ApiError(
            409,
            'INBOX_FILED_CHANGED',
            'This find was already filed, then changed or moved to Trash. Check your collections and Trash.',
          );
        throw error;
      }
    };
    const prior = await previousInboxOperation(c.env.DB, owner, key, 'file', hash);
    if (prior) return reply(prior);
    const entry = await requireInbox(c.env.DB, owner, entryId);
    const target = await requireList(c.env.DB, owner, input.targetListId);
    if (target.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'File this find in a collection.');
    const now = Date.now(),
      itemId = crypto.randomUUID(),
      logId = entry.memory ? crypto.randomUUID() : null,
      result = { entryId, itemId, listId: target.id, logId };
    const photoRecord = logId ?? itemId,
      photoField = logId ? 'log_id' : 'item_id',
      photoCache = logId ? 'log_photos' : 'item_photos',
      parent = logId ? 'logs' : 'items';
    try {
      await c.env.DB.batch([
        inboxGuard(
          c.env.DB,
          'SELECT EXISTS(SELECT 1 FROM inbox_entries WHERE id = ? AND owner_id = ? AND revision = ? AND trashed_at IS NULL) AND EXISTS(SELECT 1 FROM active_lists WHERE id = ? AND owner_id = ? AND kind = ?)',
          [entryId, owner, input.expectedRevision, target.id, owner, 'collection'],
        ),
        c.env.DB.prepare(
          'INSERT INTO inbox_operations (id, owner_id, kind, fingerprint, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(key, owner, 'file', hash, JSON.stringify(result), now),
        c.env.DB.prepare(
          `INSERT INTO items (id, list_id, owner_id, title, type, note, decision, revisit_queued, want_to_try, context_json, started_on, ended_on, created_at, updated_at)
          SELECT ?, ?, owner_id, json_extract(payload_json,'$.title'), json_extract(payload_json,'$.type'), json_extract(payload_json,'$.note'), json_extract(payload_json,'$.decision'), json_extract(payload_json,'$.revisitQueued'), json_extract(payload_json,'$.wantToTry'), json_extract(payload_json,'$.context'), json_extract(payload_json,'$.startedOn'), json_extract(payload_json,'$.endedOn'), created_at, ? FROM inbox_entries WHERE id = ? AND owner_id = ?`,
        ).bind(itemId, target.id, now, entryId, owner),
        ...(entry.memory
          ? [
              c.env.DB.prepare(
                'INSERT INTO logs(id,list_id,item_id,owner_id,title,happened_on,note,context_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
              ).bind(
                logId,
                target.id,
                itemId,
                owner,
                entry.title,
                entry.memory.happenedOn,
                entry.note,
                JSON.stringify(
                  visitContext.parse({ reaction: entry.memory.reaction, location: entry.context.location }),
                ),
                entry.createdAt,
                now,
              ),
            ]
          : []),
        c.env.DB.prepare(
          `INSERT INTO photo_assets(id,owner_id,${photoField},content_type,data,fingerprint,created_at)
          SELECT id,owner_id,?,content_type,data,fingerprint,created_at FROM inbox_photos
          WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL`,
        ).bind(photoRecord, entryId, owner),
        c.env.DB.prepare(
          `INSERT INTO ${photoCache}(${photoField},owner_id,content_type,data,updated_at)
          SELECT ?,owner_id,content_type,data,? FROM inbox_photos WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL AND data IS NOT NULL`,
        ).bind(photoRecord, now, entryId, owner),
        c.env.DB.prepare(
          `UPDATE ${parent} SET cover_photo_id=(SELECT id FROM inbox_photos WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL),
          gallery_json=COALESCE((SELECT json_array(json_object('id',id,'caption','','arrows',json('[]'))) FROM inbox_photos WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL),'[]') WHERE id=? AND owner_id=?`,
        ).bind(entryId, owner, entryId, owner, photoRecord, owner),
        c.env.DB.prepare('DELETE FROM inbox_entries WHERE id = ? AND owner_id = ?').bind(entryId, owner),
        c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
          now,
          target.id,
          owner,
        ),
      ]);
    } catch (error) {
      const saved = await previousInboxOperation(c.env.DB, owner, key, 'file', hash);
      if (saved) return reply(saved);
      inboxChanged(error);
    }
    return reply(result);
  });
}
