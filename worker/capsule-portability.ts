import type { ArchiveFile } from '../src/shared/portability';
import { normalizeCapsuleReferences, type SavedCapsule } from '../src/shared/capsules';
import { capsuleRecordBody } from './capsule-data';
import { ApiError } from './data';
import { fingerprint } from './operations';
import { photoContentType } from './http';
import { photoFingerprint } from './photo-gallery';
import { imageDimensions } from '../src/shared/image-dimensions';
type Photo = ArchiveFile['photos'][number];
export async function exportCapsulePhotos(
  db: D1Database,
  owner: string,
  capsules: SavedCapsule[],
  photos: Photo[],
) {
  const expected = new Map(
    capsules.flatMap((capsule) =>
      capsule.entries.flatMap((entry) =>
        entry.photos.filter((photo) => photo.available).map((photo) => [photo.id, photo] as const),
      ),
    ),
  );
  const ids = JSON.stringify([...expected.keys()]);
  const existingBytes = photos.reduce(
    (sum, photo) =>
      sum + (photo.data.length / 4) * 3 - (photo.data.endsWith('==') ? 2 : photo.data.endsWith('=') ? 1 : 0),
    0,
  );
  const bounds = await db
    .prepare(
      'SELECT COUNT(*) AS n,COALESCE(SUM(length(p.data)),0) AS bytes FROM capsule_photos p JOIN time_capsules t ON t.id=p.capsule_id AND t.owner_id=p.owner_id WHERE p.owner_id=? AND t.removed_at IS NULL AND p.id IN(SELECT value FROM json_each(?)) AND p.data IS NOT NULL',
    )
    .bind(owner, ids)
    .first<{ n: number; bytes: number }>();
  if (photos.length + (bounds?.n ?? 0) > 200 || existingBytes + (bounds?.bytes ?? 0) > 22 * 1024 * 1024)
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'Photo backups support up to 200 photos/covers and 32 MB. Export records separately or contact support for an archive transfer.',
    );
  for (let offset = 0; offset < (bounds?.n ?? 0); offset += 6) {
    const rows = await db
      .prepare(
        'SELECT p.id,p.content_type,p.data FROM capsule_photos p JOIN time_capsules t ON t.id=p.capsule_id AND t.owner_id=p.owner_id WHERE p.owner_id=? AND t.removed_at IS NULL AND p.id IN(SELECT value FROM json_each(?)) AND p.data IS NOT NULL ORDER BY p.id LIMIT 6 OFFSET ?',
      )
      .bind(owner, ids, offset)
      .all<{ id: string; content_type: Photo['contentType']; data: number[] }>();
    for (const row of rows.results) {
      const metadata = expected.get(row.id),
        bytes = new Uint8Array(row.data);
      if (
        !metadata ||
        metadata.contentType !== row.content_type ||
        (await photoFingerprint(bytes)) !== metadata.digest
      )
        throw new ApiError(
          409,
          'EXPORT_CHANGED',
          'A capsule photo changed while preparing this backup. Try again.',
        );
      let binary = '';
      for (let at = 0; at < bytes.length; at += 8192)
        binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
      photos.push({ kind: 'capsule', id: row.id, contentType: row.content_type, data: btoa(binary) });
    }
  }
}
export async function prepareCapsuleRestore(
  db: D1Database,
  owner: string,
  file: ArchiveFile,
  id: (source: string) => string,
) {
  const available = new Set(file.photos.filter((photo) => photo.kind === 'capsule').map((photo) => photo.id));
  const itemIds = new Set(file.items.filter((item) => !item.mergedIntoId).map((item) => item.id)),
    logIds = new Set(file.logs.map((log) => log.id)),
    assetIds = new Set(file.photoAssets.map((photo) => photo.id));
  const capsules = await Promise.all(
    file.capsules.map(async (capsule) => {
      const body = capsuleRecordBody(normalizeCapsuleReferences(capsule, itemIds, logIds, assetIds));
      body.entries = body.entries.map((entry) => ({
        ...entry,
        id: crypto.randomUUID(),
        reference: entry.reference ? { ...entry.reference, id: id(entry.reference.id) } : null,
        photos: entry.photos.map((photo) => ({
          ...photo,
          id: id(photo.id),
          sourceAssetId: photo.sourceAssetId ? id(photo.sourceAssetId) : null,
          available: available.has(photo.id),
          arrows: photo.arrows.map((arrow) => ({ ...arrow, id: crypto.randomUUID() })),
        })),
      }));
      return {
        id: id(capsule.id),
        owner_id: owner,
        body_json: JSON.stringify(body),
        creation_hash: await fingerprint(body),
        created_at: capsule.createdAt,
        opens_at: body.opening.opensAt,
        opened_at: capsule.openedAt,
      };
    }),
  );
  const photoRows = file.capsules.flatMap((capsule) =>
    capsule.entries.flatMap((entry) =>
      entry.photos.map((photo) => ({
        id: id(photo.id),
        capsule_id: id(capsule.id),
        owner_id: owner,
        content_type: photo.contentType,
        fingerprint: photo.digest,
      })),
    ),
  );
  const statements: D1PreparedStatement[] = [];
  const originals = new Map(
    file.capsules.flatMap((capsule) =>
      capsule.entries.flatMap((entry) => entry.photos.map((photo) => [photo.id, photo] as const)),
    ),
  );
  const encoded = file.photos.filter((photo) => photo.kind === 'capsule');
  for (let offset = 0; offset < encoded.length; offset += 20) {
    const group = encoded.slice(offset, offset + 20),
      bindings: (string | Uint8Array)[] = [];
    for (const photo of group) {
      const metadata = originals.get(photo.id)!,
        bytes = Uint8Array.from(atob(photo.data), (char) => char.charCodeAt(0));
      if (
        !bytes.length ||
        bytes.length > 900000 ||
        photoContentType(bytes) !== photo.contentType ||
        (await photoFingerprint(bytes)) !== metadata.digest
      )
        throw new ApiError(
          400,
          'INVALID_CAPSULE_PHOTO',
          'A capsule photo has invalid bytes, type, size or fingerprint.',
        );
      try {
        imageDimensions(bytes, photo.contentType);
      } catch {
        throw new ApiError(
          400,
          'INVALID_CAPSULE_PHOTO',
          'A capsule photo is not a complete supported image.',
        );
      }
      bindings.push(id(photo.id), bytes);
    }
    statements.push(
      db
        .prepare(
          `UPDATE capsule_photos SET data=CASE id ${group.map(() => 'WHEN ? THEN ?').join(' ')} ELSE data END WHERE owner_id=? AND id IN(SELECT value FROM json_each(?))`,
        )
        .bind(...bindings, owner, JSON.stringify(group.map((photo) => id(photo.id)))),
    );
  }
  return { capsules, photos: photoRows, statements };
}
