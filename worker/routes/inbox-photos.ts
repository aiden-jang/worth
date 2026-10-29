import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError } from '../data';
import { inboxChanged, inboxGuard, requireInbox } from '../inbox';
import { photoContentType, readBytes } from '../http';
import { operationId } from '../operations';
import { photoFingerprint } from '../photo-gallery';
import { recordIdentityGuard } from '../record-identity';

function expectedRevision(raw: string | undefined) {
  if (!raw || !/^\d{1,15}$/.test(raw))
    throw new ApiError(400, 'INVALID_VERSION', 'Reload this find before changing its photo.');
  return Number(raw);
}
export function registerInboxPhotos(api: Hono<AppEnv>) {
  const path = '/inbox/:id/photo';
  api.get(path, async (c) => {
    const owner = c.get('ownerId'),
      id = c.req.param('id');
    await requireInbox(c.env.DB, owner, id);
    const photo = await c.env.DB.prepare(
      'SELECT content_type,data FROM inbox_photos WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL AND data IS NOT NULL',
    )
      .bind(id, owner)
      .first<{ content_type: string; data: number[] }>();
    if (!photo) throw new ApiError(404, 'NOT_FOUND', 'This photo is unavailable.');
    return new Response(new Uint8Array(photo.data), {
      headers: { 'Content-Type': photo.content_type, 'Cache-Control': 'private, no-store' },
    });
  });
  api.put(path, async (c) => {
    const owner = c.get('ownerId'),
      id = c.req.param('id'),
      db = c.env.DB;
    const entry = await requireInbox(db, owner, id),
      revision = expectedRevision(c.req.header('X-Worth-Inbox-Revision'));
    const key = operationId(c.req.header('Idempotency-Key'));
    const bytes = await readBytes(c.req.raw, 900000),
      contentType = photoContentType(bytes),
      hash = await photoFingerprint(bytes);
    if (c.req.header('content-type')?.split(';')[0]?.toLowerCase() !== contentType)
      throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file.');
    async function prior() {
      const saved = await db
        .prepare('SELECT owner_id,inbox_id,fingerprint,removed_at FROM inbox_photos WHERE id=?')
        .bind(key)
        .first<{ owner_id: string; inbox_id: string; fingerprint: string; removed_at: number | null }>();
      if (!saved) return false;
      if (saved.owner_id !== owner || saved.inbox_id !== id || saved.fingerprint !== hash)
        throw new ApiError(
          409,
          'PHOTO_REQUEST_CHANGED',
          'This retry differs from the saved photo. Review the find before starting another upload.',
        );
      if (saved.removed_at !== null)
        throw new ApiError(
          410,
          'PHOTO_REMOVED',
          'This upload was removed or replaced. Choose a new photo to start another upload.',
        );
      return true;
    }
    if (await prior()) return c.json({ entry: await requireInbox(db, owner, id) });
    if (entry.revision !== revision)
      throw new ApiError(
        409,
        'INBOX_CHANGED',
        'This find changed elsewhere. Reload its saved details before changing the photo.',
      );
    const now = Math.max(Date.now(), entry.updatedAt + 1);
    try {
      await db.batch([
        inboxGuard(
          db,
          'EXISTS(SELECT 1 FROM inbox_entries WHERE id=? AND owner_id=? AND revision=? AND trashed_at IS NULL)',
          [id, owner, revision],
        ),
        recordIdentityGuard(db, [key]),
        db
          .prepare(
            'UPDATE inbox_photos SET data=NULL,removed_at=? WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL',
          )
          .bind(now, id, owner),
        db
          .prepare(
            'INSERT INTO inbox_photos(id,inbox_id,owner_id,content_type,data,fingerprint,created_at) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(key, id, owner, contentType, bytes, hash, now),
        db
          .prepare('UPDATE inbox_entries SET revision=revision+1,updated_at=? WHERE id=? AND owner_id=?')
          .bind(now, id, owner),
      ]);
    } catch (error) {
      if (!(await prior())) inboxChanged(error);
    }
    return c.json({ entry: await requireInbox(db, owner, id) });
  });
  api.delete(path, async (c) => {
    const owner = c.get('ownerId'),
      id = c.req.param('id'),
      db = c.env.DB;
    const entry = await requireInbox(db, owner, id),
      revision = expectedRevision(c.req.header('X-Worth-Inbox-Revision'));
    if (entry.photo && entry.photo.id !== c.req.header('X-Worth-Photo-Id'))
      throw new ApiError(
        409,
        'INBOX_CHANGED',
        'This photo changed elsewhere. Reload the find before removing it.',
      );
    if (entry.revision !== revision)
      throw new ApiError(
        409,
        'INBOX_CHANGED',
        'This find changed elsewhere. Reload its saved details before removing the photo.',
      );
    if (!entry.photo) return c.json({ entry });
    const now = Math.max(Date.now(), entry.updatedAt + 1);
    try {
      await db.batch([
        inboxGuard(
          db,
          'EXISTS(SELECT 1 FROM inbox_entries WHERE id=? AND owner_id=? AND revision=? AND trashed_at IS NULL)',
          [id, owner, revision],
        ),
        db
          .prepare(
            'UPDATE inbox_photos SET data=NULL,removed_at=? WHERE inbox_id=? AND owner_id=? AND removed_at IS NULL',
          )
          .bind(now, id, owner),
        db
          .prepare('UPDATE inbox_entries SET revision=revision+1,updated_at=? WHERE id=? AND owner_id=?')
          .bind(now, id, owner),
      ]);
    } catch (error) {
      inboxChanged(error);
    }
    return c.json({ entry: await requireInbox(db, owner, id) });
  });
}
