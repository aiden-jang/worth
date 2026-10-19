import type { ArchiveFile } from '../src/shared/portability';
import { exportReceiptReferences, receiptBody, type SavedReceipt } from '../src/shared/receipts';
import { ApiError } from './data';
import { fingerprint } from './operations';
import { photoFingerprint } from './photo-gallery';
import { photoContentType } from './http';
import { imageDimensions } from '../src/shared/image-dimensions';
type Photo = ArchiveFile['photos'][number];
export async function exportReceiptPhotos(
  db: D1Database,
  owner: string,
  receipts: SavedReceipt[],
  photos: Photo[],
  photoBytes: number,
) {
  const ids = receipts.filter((r) => r.attachment?.available).map((r) => r.id);
  const bounds = await db
    .prepare(
      'SELECT COUNT(*) AS n,COALESCE(SUM(length(attachment_data)),0) AS bytes FROM receipts WHERE owner_id=? AND id IN(SELECT value FROM json_each(?)) AND removed_at IS NULL AND attachment_data IS NOT NULL',
    )
    .bind(owner, JSON.stringify(ids))
    .first<{ n: number; bytes: number }>();
  if (photos.length + (bounds?.n ?? 0) > 200 || photoBytes + (bounds?.bytes ?? 0) > 22 * 1024 * 1024)
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'Photo backups support up to 200 photos/covers and 32 MB. Export records separately or contact support for an archive transfer.',
    );
  for (let offset = 0; offset < (bounds?.n ?? 0); offset += 6) {
    const rows = await db
      .prepare(
        "SELECT id,attachment_data AS data,json_extract(body_json,'$.attachment.contentType') AS type FROM receipts WHERE owner_id=? AND id IN(SELECT value FROM json_each(?)) AND removed_at IS NULL AND attachment_data IS NOT NULL ORDER BY id LIMIT 6 OFFSET ?",
      )
      .bind(owner, JSON.stringify(ids), offset)
      .all<{ id: string; data: number[]; type: Photo['contentType'] }>();
    for (const row of rows.results) {
      const info = receipts.find((r) => r.id === row.id)?.attachment,
        bytes = new Uint8Array(row.data);
      if (!info || info.contentType !== row.type || (await photoFingerprint(bytes)) !== info.digest)
        throw new ApiError(
          409,
          'EXPORT_CHANGED',
          'A receipt attachment changed while preparing the backup. Try again.',
        );
      let binary = '';
      for (let at = 0; at < bytes.length; at += 8192)
        binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
      photos.push({ kind: 'receipt', id: row.id, contentType: row.type, data: btoa(binary) });
    }
  }
}
export async function restoreReceiptRows(
  db: D1Database,
  owner: string,
  file: ArchiveFile,
  id: (source: string) => string,
) {
  const available = new Set(file.photos.filter((p) => p.kind === 'receipt').map((p) => p.id));
  const rows = await Promise.all(
    file.receipts.map(async (receipt) => {
      const normalized = exportReceiptReferences(
          receipt,
          new Set(file.items.filter((item) => !item.mergedIntoId).map((item) => item.id)),
        ),
        body = receiptBody(normalized);
      body.lines = body.lines.map((line) => ({
        ...line,
        id: crypto.randomUUID(),
        mapping:
          line.mapping.mode === 'none'
            ? line.mapping
            : { mode: 'existing' as const, itemId: id(line.mapping.itemId) },
      }));
      if (body.attachment) body.attachment = { ...body.attachment, available: available.has(receipt.id) };
      return {
        id: id(receipt.id),
        owner_id: owner,
        body_json: JSON.stringify(body),
        creation_hash: await fingerprint(body),
        created_at: receipt.createdAt,
      };
    }),
  );
  const statements: D1PreparedStatement[] = [];
  // Keep the receipt bodies in bounded JSON batches; attachment bytes use separate bindings.
  let group: typeof rows = [],
    size = 2;
  const flush = () => {
    if (!group.length) return;
    statements.push(
      db
        .prepare(
          "INSERT INTO receipts(id,owner_id,body_json,creation_hash,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.owner_id'),json_extract(value,'$.body_json'),json_extract(value,'$.creation_hash'),json_extract(value,'$.created_at') FROM json_each(?)",
        )
        .bind(JSON.stringify(group)),
    );
    group = [];
    size = 2;
  };
  for (const row of rows) {
    const bytes = new TextEncoder().encode(JSON.stringify(row)).length;
    if (size + bytes > 1500000) flush();
    group.push(row);
    size += bytes + 1;
  }
  flush();
  const photos = file.photos.filter((p) => p.kind === 'receipt');
  for (let offset = 0; offset < photos.length; offset += 20) {
    const batch = photos.slice(offset, offset + 20),
      bindings: (string | Uint8Array)[] = [];
    for (const photo of batch) {
      const receipt = file.receipts.find((r) => r.id === photo.id)!,
        bytes = Uint8Array.from(atob(photo.data), (c) => c.charCodeAt(0));
      if (
        !bytes.length ||
        bytes.length > 900000 ||
        photoContentType(bytes) !== photo.contentType ||
        (await photoFingerprint(bytes)) !== receipt.attachment?.digest
      )
        throw new ApiError(
          400,
          'INVALID_RECEIPT_ATTACHMENT',
          'A receipt attachment has invalid bytes, type, size or fingerprint.',
        );
      try {
        imageDimensions(bytes, photo.contentType);
      } catch {
        throw new ApiError(
          400,
          'INVALID_RECEIPT_ATTACHMENT',
          'A receipt attachment is not a complete supported image.',
        );
      }
      bindings.push(id(photo.id), bytes);
    }
    statements.push(
      db
        .prepare(
          `UPDATE receipts SET attachment_data=CASE id ${batch.map(() => 'WHEN ? THEN ?').join(' ')} ELSE attachment_data END WHERE owner_id=? AND id IN(SELECT value FROM json_each(?))`,
        )
        .bind(...bindings, owner, JSON.stringify(batch.map((photo) => id(photo.id)))),
    );
  }
  return statements;
}
