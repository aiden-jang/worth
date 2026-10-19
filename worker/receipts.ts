import { recordIdentityGuard } from './record-identity';
import {
  receiptInput,
  type ReceiptInput,
  type ReceiptSource,
  type ReceiptView,
  type ReceiptSummary,
} from '../src/shared/receipts';
import { ApiError } from './data';
import { fingerprint } from './operations';
import { mapReceipt, type ReceiptRow } from './receipt-data';
export async function receiptSummaries(db: D1Database, owner: string): Promise<ReceiptSummary[]> {
  const result = await db
    .prepare(
      "SELECT id,created_at AS createdAt,json_extract(body_json,'$.name') AS name,json_extract(body_json,'$.merchant') AS merchant,json_extract(body_json,'$.day') AS day,json_array_length(body_json,'$.lines') AS lineCount FROM receipts WHERE owner_id=? AND removed_at IS NULL ORDER BY created_at DESC,id LIMIT 101",
    )
    .bind(owner)
    .all<ReceiptSummary>();
  if (result.results.length > 100)
    throw new ApiError(409, 'RECEIPT_LIMIT', 'This archive exceeds 100 receipts.');
  return result.results;
}
export async function readReceipt(db: D1Database, owner: string, id: string): Promise<ReceiptView> {
  const [rows, sources] = await db.batch([
    db
      .prepare(
        'SELECT id,owner_id,body_json,creation_hash,created_at,removed_at FROM receipts WHERE owner_id=? AND id=? AND removed_at IS NULL',
      )
      .bind(owner, id),
    db
      .prepare(
        `SELECT i.id,i.title,i.list_id AS listId,l.name AS listName,l.archived FROM active_items i JOIN active_lists l ON l.id=i.list_id AND l.owner_id=i.owner_id WHERE i.owner_id=? AND i.id IN (SELECT json_extract(e.value,'$.mapping.itemId') FROM receipts r,json_each(r.body_json,'$.lines') e WHERE r.owner_id=? AND r.id=? AND r.removed_at IS NULL)`,
      )
      .bind(owner, owner, id),
  ]);
  const row = rows.results[0] as ReceiptRow | undefined;
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Receipt not found.');
  return {
    ...mapReceipt(row),
    sources: (
      sources.results as (Omit<ReceiptSource, 'archived'> & {
        archived: number;
      })[]
    ).map((s) => ({ ...s, archived: !!s.archived })),
  };
}
export function receiptFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('receipt capacity reached'))
    throw new ApiError(409, 'RECEIPT_LIMIT', 'Keep up to 100 receipts. Remove one before saving another.');
  if (message.includes('malformed JSON'))
    throw new ApiError(
      409,
      'RECEIPT_SOURCE_CHANGED',
      'A chosen record or collection changed. Your reviewed receipt is kept; check sources before another review.',
    );
  throw error;
}
export async function createReceipt(
  db: D1Database,
  owner: string,
  id: string,
  input: ReceiptInput,
  attachment: Uint8Array | null,
): Promise<ReceiptView> {
  const body = receiptInput.parse(input),
    hash = await fingerprint(body);
  async function previous() {
    const row = await db
      .prepare('SELECT id,owner_id,body_json,creation_hash,created_at,removed_at FROM receipts WHERE id=?')
      .bind(id)
      .first<ReceiptRow>();
    if (!row) return null;
    if (row.owner_id !== owner || row.creation_hash !== hash)
      throw new ApiError(
        409,
        'OPERATION_CHANGED',
        'This retry differs from the saved receipt. Check the saved receipt before starting another review.',
      );
    if (row.removed_at !== null)
      throw new ApiError(
        410,
        'RECEIPT_REMOVED',
        'This receipt was removed. An old retry cannot recreate it.',
      );
    return readReceipt(db, owner, id);
  }
  const prior = await previous();
  if (prior) return prior;
  const now = Date.now(),
    raw = JSON.stringify(body);
  const statements = [
    recordIdentityGuard(db, [
      id,
      ...body.lines.flatMap((line) => (line.mapping.mode === 'create' ? [line.mapping.itemId] : [])),
    ]),
    db
      .prepare(
        `SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(?,'$.lines') e WHERE
 (json_extract(e.value,'$.mapping.mode')='existing' AND NOT EXISTS(SELECT 1 FROM active_items i WHERE i.id=json_extract(e.value,'$.mapping.itemId') AND i.owner_id=?)) OR
 (json_extract(e.value,'$.mapping.mode')='create' AND (EXISTS(SELECT 1 FROM items i WHERE i.id=json_extract(e.value,'$.mapping.itemId')) OR NOT EXISTS(SELECT 1 FROM active_lists l WHERE l.id=json_extract(e.value,'$.mapping.listId') AND l.owner_id=? AND l.kind='collection' AND l.archived=0)))
 ) THEN 'null' ELSE 'receipt source changed' END)`,
      )
      .bind(raw, owner, owner),
    db
      .prepare(
        'INSERT INTO receipts(id,owner_id,body_json,creation_hash,attachment_data,created_at) VALUES(?,?,?,?,?,?)',
      )
      .bind(id, owner, raw, hash, attachment, now),
    db
      .prepare(
        `INSERT INTO items(id,list_id,owner_id,title,created_at,updated_at) SELECT json_extract(e.value,'$.mapping.itemId'),json_extract(e.value,'$.mapping.listId'),?,json_extract(e.value,'$.mapping.title'),?,? FROM json_each(?,'$.lines') e WHERE json_extract(e.value,'$.mapping.mode')='create'`,
      )
      .bind(owner, now, now, raw),
    db
      .prepare(
        `UPDATE lists SET updated_at=? WHERE owner_id=? AND id IN(SELECT json_extract(e.value,'$.mapping.listId') FROM json_each(?,'$.lines') e WHERE json_extract(e.value,'$.mapping.mode')='create')`,
      )
      .bind(now, owner, raw),
  ];
  try {
    await db.batch(statements);
  } catch (error) {
    const saved = await previous();
    if (saved) return saved;
    receiptFailure(error);
  }
  return readReceipt(db, owner, id);
}
export async function removeReceipt(db: D1Database, owner: string, id: string) {
  const removed = await db
    .prepare(
      "UPDATE receipts SET removed_at=?,body_json='{}',attachment_data=NULL WHERE owner_id=? AND id=? AND removed_at IS NULL",
    )
    .bind(Date.now(), owner, id)
    .run();
  if (!removed.meta.changes) {
    const known = await db
      .prepare('SELECT 1 FROM receipts WHERE owner_id=? AND id=?')
      .bind(owner, id)
      .first();
    if (!known) throw new ApiError(404, 'NOT_FOUND', 'Receipt not found.');
  }
}
