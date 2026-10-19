import { recordIdentityGuard } from './record-identity';
import {
  galleryEntries,
  type GalleryEntry,
  type PhotoGallery,
  type GallerySource,
} from '../src/shared/photo-gallery';
import { ApiError, requireItem, requireLog } from './data';

type Kind = 'items' | 'logs';
export function galleryTables(kind: Kind) {
  return kind === 'items'
    ? ({ table: 'items', view: 'record_items', field: 'item_id', cache: 'item_photos' } as const)
    : ({ table: 'logs', view: 'active_logs', field: 'log_id', cache: 'log_photos' } as const);
}
type AlbumRow = {
  gallery_json: string;
  gallery_revision: number;
  cover_photo_id: string | null;
  list_id: string;
};
type SourceRow = {
  id: string;
  content_type: GallerySource['contentType'];
  fingerprint: string | null;
  created_at: number;
  available: number;
};
export async function readGallery(
  db: D1Database,
  owner: string,
  kind: Kind,
  recordId: string,
): Promise<PhotoGallery> {
  if (kind === 'items') await requireItem(db, owner, recordId, true);
  else await requireLog(db, owner, recordId);
  const config = galleryTables(kind);
  const [albums, sources] = await db.batch([
    db
      .prepare(
        `SELECT gallery_json,gallery_revision,cover_photo_id,list_id FROM ${config.view} WHERE id=? AND owner_id=?`,
      )
      .bind(recordId, owner),
    db
      .prepare(
        `SELECT id,content_type,fingerprint,created_at,data IS NOT NULL AS available FROM photo_assets WHERE ${config.field}=? AND owner_id=? AND removed_at IS NULL`,
      )
      .bind(recordId, owner),
  ]);
  const album = albums.results[0] as AlbumRow | undefined;
  if (!album) throw new ApiError(404, 'NOT_FOUND', 'These photos are unavailable.');
  const entries = galleryEntries.parse(JSON.parse(album.gallery_json));
  const byId = new Map((sources.results as SourceRow[]).map((row) => [row.id, row]));
  if (entries.length !== byId.size || entries.some((entry) => !byId.has(entry.id)))
    throw new ApiError(409, 'GALLERY_CHANGED', 'The saved photo list changed. Reload these photos.');
  return {
    kind,
    recordId,
    listId: album.list_id,
    revision: album.gallery_revision,
    coverId: album.cover_photo_id,
    entries: entries.map((entry) => {
      const row = byId.get(entry.id)!;
      return {
        ...entry,
        source: {
          id: row.id,
          kind: kind === 'items' ? 'item' : 'log',
          recordId,
          contentType: row.content_type,
          fingerprint: row.fingerprint,
          createdAt: row.created_at,
          available: !!row.available,
        },
      };
    }),
  };
}
export async function photoFingerprint(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}
function guard(db: D1Database, owner: string, kind: Kind, recordId: string, revision: number) {
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS (SELECT 1 FROM ${galleryTables(kind).view} WHERE owner_id=? AND id=? AND gallery_revision=?) THEN 'null' ELSE 'photo gallery changed' END)`,
    )
    .bind(owner, recordId, revision);
}
function changed(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('photo gallery full'))
    throw new ApiError(
      409,
      'GALLERY_FULL',
      'Keep up to 12 photos per record. Remove one before adding another.',
    );
  if (message.includes('malformed JSON') || message.includes('photo owner changed'))
    throw new ApiError(
      409,
      'GALLERY_CHANGED',
      'These photos changed elsewhere. Reload saved photos before trying again.',
    );
  throw error;
}
function touch(
  db: D1Database,
  owner: string,
  kind: Kind,
  recordId: string,
  entries: GalleryEntry[],
  coverId: string | null,
) {
  const config = galleryTables(kind);
  return [
    db
      .prepare(
        `UPDATE ${config.table} SET gallery_json=?,cover_photo_id=?,gallery_revision=gallery_revision+1,updated_at=MIN(8640000000000000,MAX(updated_at+1,?)) WHERE id=? AND owner_id=?`,
      )
      .bind(JSON.stringify(entries), coverId, Date.now(), recordId, owner),
    db
      .prepare(
        `UPDATE lists SET updated_at=MIN(8640000000000000,MAX(updated_at+1,?)) WHERE owner_id=? AND id=(SELECT list_id FROM ${config.table} WHERE owner_id=? AND id=?)`,
      )
      .bind(Date.now(), owner, owner, recordId),
  ];
}
function cover(db: D1Database, owner: string, kind: Kind, recordId: string, assetId: string | null) {
  const config = galleryTables(kind);
  return [
    db.prepare(`DELETE FROM ${config.cache} WHERE ${config.field}=? AND owner_id=?`).bind(recordId, owner),
    db
      .prepare(
        `INSERT INTO ${config.cache}(${config.field},owner_id,content_type,data,updated_at) SELECT ?,owner_id,content_type,data,? FROM photo_assets WHERE id=? AND owner_id=? AND ${config.field}=? AND removed_at IS NULL AND data IS NOT NULL`,
      )
      .bind(recordId, Date.now(), assetId, owner, recordId),
  ];
}
async function previousUpload(
  db: D1Database,
  owner: string,
  kind: Kind,
  recordId: string,
  assetId: string,
  fingerprint: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT owner_id,item_id,log_id,fingerprint,removed_at FROM photo_assets WHERE id=?')
    .bind(assetId)
    .first<{
      owner_id: string;
      item_id: string | null;
      log_id: string | null;
      fingerprint: string | null;
      removed_at: number | null;
    }>();
  if (!row) return false;
  if (
    row.owner_id !== owner ||
    (kind === 'items' ? row.item_id : row.log_id) !== recordId ||
    row.fingerprint !== fingerprint
  )
    throw new ApiError(
      409,
      'PHOTO_REQUEST_CHANGED',
      'This retry differs from the saved photo request. Review the saved photos before choosing a new upload.',
    );
  if (row.removed_at !== null)
    throw new ApiError(
      410,
      'PHOTO_REMOVED',
      'This upload was already removed. Choose a new photo to start another upload.',
    );
  return true;
}
export async function addGalleryPhoto(
  db: D1Database,
  owner: string,
  kind: Kind,
  recordId: string,
  assetId: string,
  bytes: Uint8Array,
  contentType: GallerySource['contentType'],
  expectedRevision?: number,
): Promise<PhotoGallery> {
  const hash = await photoFingerprint(bytes);
  if (await previousUpload(db, owner, kind, recordId, assetId, hash))
    return readGallery(db, owner, kind, recordId);
  const album = await readGallery(db, owner, kind, recordId),
    config = galleryTables(kind);
  if (expectedRevision !== undefined && expectedRevision !== album.revision)
    throw new ApiError(
      409,
      'GALLERY_CHANGED',
      'These photos changed elsewhere. Reload saved photos before trying again.',
    );
  const entries = [
    ...album.entries.map(({ id, caption, arrows }) => ({ id, caption, arrows })),
    { id: assetId, caption: '', arrows: [] },
  ];
  if (album.entries.length >= 12)
    throw new ApiError(
      409,
      'GALLERY_FULL',
      'Keep up to 12 photos per record. Remove one before adding another.',
    );
  try {
    await db.batch([
      recordIdentityGuard(db, [assetId]),
      guard(db, owner, kind, recordId, album.revision),
      db
        .prepare(
          `INSERT INTO photo_assets(id,owner_id,${config.field},content_type,data,fingerprint,created_at) VALUES(?,?,?,?,?,?,?)`,
        )
        .bind(assetId, owner, recordId, contentType, bytes, hash, Date.now()),
      ...touch(db, owner, kind, recordId, entries, assetId),
      ...cover(db, owner, kind, recordId, assetId),
    ]);
  } catch (error) {
    if (await previousUpload(db, owner, kind, recordId, assetId, hash))
      return readGallery(db, owner, kind, recordId);
    changed(error);
  }
  return readGallery(db, owner, kind, recordId);
}
export async function changeGallery(
  db: D1Database,
  owner: string,
  kind: Kind,
  recordId: string,
  input: { entries: GalleryEntry[]; coverId: string | null; expectedRevision: number },
): Promise<PhotoGallery> {
  const album = await readGallery(db, owner, kind, recordId);
  if (input.expectedRevision !== album.revision)
    throw new ApiError(
      409,
      'GALLERY_CHANGED',
      'These photos changed elsewhere. Reload saved photos before trying again.',
    );
  const current = new Set(album.entries.map((entry) => entry.id));
  if (input.entries.length !== current.size || input.entries.some((entry) => !current.has(entry.id)))
    throw new ApiError(
      409,
      'GALLERY_CHANGED',
      'Use Add photo or Remove photo to change the saved photo list. Reload before editing its order.',
    );
  if (input.coverId !== null && !input.entries.some((entry) => entry.id === input.coverId))
    throw new ApiError(400, 'INVALID_COVER', 'Choose a photo from this record.');
  if (
    input.coverId !== null &&
    input.coverId !== album.coverId &&
    !album.entries.find((entry) => entry.id === input.coverId)?.source.available
  )
    throw new ApiError(
      409,
      'PHOTO_UNAVAILABLE',
      'That original is unavailable. Choose an available photo or clear the cover.',
    );
  try {
    await db.batch([
      guard(db, owner, kind, recordId, input.expectedRevision),
      ...touch(db, owner, kind, recordId, input.entries, input.coverId),
      ...(input.coverId !== album.coverId ? cover(db, owner, kind, recordId, input.coverId) : []),
    ]);
  } catch (error) {
    changed(error);
  }
  return readGallery(db, owner, kind, recordId);
}
export async function removeGalleryPhoto(
  db: D1Database,
  owner: string,
  kind: Kind,
  recordId: string,
  assetId: string,
  expectedRevision?: number,
): Promise<PhotoGallery> {
  const album = await readGallery(db, owner, kind, recordId),
    config = galleryTables(kind);
  if (!album.entries.some((entry) => entry.id === assetId)) {
    const removed = await db
      .prepare(
        `SELECT id FROM photo_assets WHERE owner_id=? AND ${config.field}=? AND id=? AND removed_at IS NOT NULL`,
      )
      .bind(owner, recordId, assetId)
      .first();
    if (removed) return album;
    throw new ApiError(404, 'NOT_FOUND', 'This photo is unavailable.');
  }
  if (expectedRevision !== undefined && expectedRevision !== album.revision)
    throw new ApiError(
      409,
      'GALLERY_CHANGED',
      'These photos changed elsewhere. Reload saved photos before trying again.',
    );
  const nextCover = album.coverId === assetId ? null : album.coverId;
  try {
    await db.batch([
      guard(db, owner, kind, recordId, album.revision),
      db
        .prepare(
          `UPDATE photo_assets SET data=NULL,removed_at=? WHERE id=? AND owner_id=? AND ${config.field}=? AND removed_at IS NULL`,
        )
        .bind(Date.now(), assetId, owner, recordId),
      ...touch(
        db,
        owner,
        kind,
        recordId,
        album.entries
          .filter((entry) => entry.id !== assetId)
          .map(({ id, caption, arrows }) => ({ id, caption, arrows })),
        nextCover,
      ),
      ...(nextCover !== album.coverId ? cover(db, owner, kind, recordId, nextCover) : []),
    ]);
  } catch (error) {
    changed(error);
  }
  return readGallery(db, owner, kind, recordId);
}
