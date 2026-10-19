import { addGalleryPhoto, readGallery, removeGalleryPhoto } from '../photo-gallery';
import { creationId } from '../operations';
import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireItem, requireList, requireLog } from '../data';
import { photoContentType, readBytes } from '../http';

const MAX_PHOTO_BYTES = 900_000;

export function registerPhotoRoutes(api: Hono<AppEnv>): void {
  registerListCover(api);
  registerPhotoOwner(api, 'items', 'item_photos', 'item_id');
  registerPhotoOwner(api, 'logs', 'log_photos', 'log_id');
}

function coverVersion(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined; // Older installed web clients remain compatible.
  if (!/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw)))
    throw new ApiError(400, 'INVALID_VERSION', 'Reload the collection before changing its cover.');
  return Number(raw);
}
function coverChanged(): never {
  throw new ApiError(
    409,
    'COVER_CHANGED',
    'This collection changed elsewhere. Review its current cover before trying again.',
  );
}
function coverGuard(db: D1Database, owner: string, id: string, version: number) {
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS (
    SELECT 1 FROM active_lists WHERE id=? AND owner_id=? AND kind='collection' AND cover_revision=?
  ) THEN 'null' ELSE 'cover changed' END)`,
    )
    .bind(id, owner, version);
}
async function writeCover(db: D1Database, statements: D1PreparedStatement[]) {
  try {
    await db.batch(statements);
  } catch (failure) {
    if (failure instanceof Error && failure.message.includes('malformed JSON')) coverChanged();
    throw failure;
  }
}
function registerListCover(api: Hono<AppEnv>): void {
  const path = '/lists/:id/cover';
  api.get(path, async (c) => {
    const id = c.req.param('id') ?? '',
      owner = c.get('ownerId');
    await requireList(c.env.DB, owner, id);
    const version = coverVersion(c.req.header('X-Worth-Cover-Revision'));
    const photo = await c.env.DB.prepare(
      `SELECT p.content_type, p.data FROM list_photos p
      JOIN active_lists l ON l.id=p.list_id AND l.owner_id=p.owner_id
      WHERE p.list_id=? AND p.owner_id=? AND (? IS NULL OR l.cover_revision=?)`,
    )
      .bind(id, owner, version ?? null, version ?? null)
      .first<{ content_type: string; data: number[] }>();
    if (!photo) throw new ApiError(404, 'NOT_FOUND', 'Cover photo unavailable. Reload the collection.');
    return new Response(new Uint8Array(photo.data), {
      headers: { 'Content-Type': photo.content_type, 'Cache-Control': 'private, no-store' },
    });
  });
  api.put(path, async (c) => {
    const id = c.req.param('id') ?? '',
      owner = c.get('ownerId'),
      db = c.env.DB;
    const list = await requireList(db, owner, id);
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can have a cover');
    const expected = coverVersion(c.req.header('X-Worth-Cover-Revision'));
    const bytes = await readBytes(c.req.raw, MAX_PHOTO_BYTES),
      contentType = photoContentType(bytes);
    if (c.req.header('content-type')?.split(';')[0]?.toLowerCase() !== contentType)
      throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file');
    // An exact retry can confirm an existing cover, but cannot recreate a removed one.
    if (expected !== undefined && expected !== (list.coverRevision ?? 0)) {
      const same = await db
        .prepare(
          `SELECT l.cover_revision FROM active_lists l JOIN list_photos p
        ON p.list_id=l.id AND p.owner_id=l.owner_id WHERE l.id=? AND l.owner_id=?
        AND p.content_type=? AND p.data=?`,
        )
        .bind(id, owner, contentType, bytes)
        .first<{ cover_revision: number }>();
      if (same) return c.json({ hasCoverPhoto: true, revision: same.cover_revision });
      coverChanged();
    }
    const now = Math.min(8640000000000000, Math.max(Date.now(), list.updatedAt + 1));
    await writeCover(db, [
      coverGuard(db, owner, id, list.coverRevision ?? 0),
      db
        .prepare(
          `INSERT INTO list_photos (list_id, owner_id, content_type, data, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(list_id) DO UPDATE SET
        content_type=excluded.content_type,data=excluded.data,updated_at=excluded.updated_at`,
        )
        .bind(id, owner, contentType, bytes, now),
      db
        .prepare(
          'UPDATE lists SET updated_at=MIN(8640000000000000,MAX(updated_at+1,?)), cover_revision=cover_revision+1 WHERE id=? AND owner_id=?',
        )
        .bind(now, id, owner),
    ]);
    return c.json({ hasCoverPhoto: true, revision: (list.coverRevision ?? 0) + 1 });
  });
  api.delete(path, async (c) => {
    const id = c.req.param('id') ?? '',
      owner = c.get('ownerId'),
      db = c.env.DB;
    const list = await requireList(db, owner, id);
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can have a cover');
    const expected = coverVersion(c.req.header('X-Worth-Cover-Revision'));
    if (expected !== undefined && expected !== (list.coverRevision ?? 0)) coverChanged();
    await writeCover(db, [
      coverGuard(db, owner, id, list.coverRevision ?? 0),
      db.prepare('DELETE FROM list_photos WHERE list_id=? AND owner_id=?').bind(id, owner),
      db
        .prepare(
          'UPDATE lists SET updated_at=MIN(8640000000000000,MAX(updated_at+1,?)), cover_revision=cover_revision+1 WHERE id=? AND owner_id=?',
        )
        .bind(Math.min(8640000000000000, Math.max(Date.now(), list.updatedAt + 1)), id, owner),
    ]);
    return c.body(null, 204);
  });
}

function registerPhotoOwner(
  api: Hono<AppEnv>,
  pathName: 'items' | 'logs',
  table: 'item_photos' | 'log_photos',
  idColumn: 'item_id' | 'log_id',
): void {
  const path = `/${pathName}/:id/photo`;

  async function requireOwner(db: D1Database, ownerId: string, id: string): Promise<string> {
    if (!id) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    const record =
      pathName === 'items' ? await requireItem(db, ownerId, id, true) : await requireLog(db, ownerId, id);
    return record.listId;
  }

  api.get(path, async (c) => {
    const id = c.req.param('id') ?? '';
    await requireOwner(c.env.DB, c.get('ownerId'), id);
    const photo = await c.env.DB.prepare(
      `SELECT content_type, data FROM ${table} WHERE ${idColumn} = ? AND owner_id = ?`,
    )
      .bind(id, c.get('ownerId'))
      .first<{ content_type: string; data: number[] }>();
    if (!photo) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    return new Response(new Uint8Array(photo.data), {
      headers: { 'Content-Type': photo.content_type, 'Cache-Control': 'private, no-store' },
    });
  });

  api.put(path, async (c) => {
    const id = c.req.param('id') ?? '';
    await requireOwner(c.env.DB, c.get('ownerId'), id);
    const bytes = await readBytes(c.req.raw, MAX_PHOTO_BYTES);
    const contentType = photoContentType(bytes);
    const declaredType = c.req.header('content-type')?.split(';')[0]?.toLowerCase();
    if (declaredType !== contentType)
      throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file');
    const album = await addGalleryPhoto(
      c.env.DB,
      c.get('ownerId'),
      pathName,
      id,
      creationId(c.req.header('Idempotency-Key')),
      bytes,
      contentType,
    );
    return c.json({
      hasPhoto: album.entries.some((entry) => entry.id === album.coverId && entry.source.available),
    });
  });

  api.delete(path, async (c) => {
    const id = c.req.param('id') ?? '';
    const album = await readGallery(c.env.DB, c.get('ownerId'), pathName, id);
    if (album.coverId)
      await removeGalleryPhoto(c.env.DB, c.get('ownerId'), pathName, id, album.coverId, album.revision);
    return c.body(null, 204);
  });
}
