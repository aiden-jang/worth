import { inboxEntry, type InboxEntry } from '../src/shared/inbox';
import { ApiError } from './data';

export type InboxRow = {
  id: string;
  payload_json: string;
  revision: number;
  created_at: number;
  updated_at: number;
  photo_id?: string | null;
  photo_type?: string;
  photo_fingerprint?: string | null;
  photo_created_at?: number;
  photo_available?: number;
};
export const inboxQuery = `SELECT e.*,p.id AS photo_id,p.content_type AS photo_type,
  p.fingerprint AS photo_fingerprint,p.created_at AS photo_created_at,p.data IS NOT NULL AS photo_available
  FROM inbox_entries e LEFT JOIN inbox_photos p ON p.inbox_id=e.id AND p.owner_id=e.owner_id AND p.removed_at IS NULL`;
export function mapInbox(row: InboxRow): InboxEntry {
  return inboxEntry.parse({
    ...JSON.parse(row.payload_json),
    id: row.id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photo: row.photo_id
      ? {
          id: row.photo_id,
          contentType: row.photo_type,
          fingerprint: row.photo_fingerprint ?? null,
          createdAt: row.photo_created_at,
          available: !!row.photo_available,
        }
      : null,
  });
}
export async function readInbox(db: D1Database, owner: string): Promise<InboxEntry[]> {
  const rows = await db
    .prepare(
      `${inboxQuery} WHERE e.owner_id = ? AND e.trashed_at IS NULL ORDER BY e.created_at DESC, e.id DESC`,
    )
    .bind(owner)
    .all<InboxRow>();
  return rows.results.map(mapInbox);
}
export async function requireInbox(db: D1Database, owner: string, id: string) {
  const row = await db
    .prepare(`${inboxQuery} WHERE e.id = ? AND e.owner_id = ? AND e.trashed_at IS NULL`)
    .bind(id, owner)
    .first<InboxRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'This Inbox find is unavailable.');
  return mapInbox(row);
}
export type InboxResult = {
  entryId: string;
  itemId: string | null;
  listId: string | null;
  logId?: string | null;
};
export async function previousInboxOperation(
  db: D1Database,
  owner: string,
  id: string,
  kind: 'create' | 'file',
  hash: string,
): Promise<InboxResult | null> {
  const row = await db
    .prepare('SELECT * FROM inbox_operations WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string; kind: string; fingerprint: string; result_json: string }>();
  if (!row) return null;
  if (row.owner_id !== owner || row.kind !== kind || row.fingerprint !== hash)
    throw new ApiError(
      409,
      'INBOX_REQUEST_CHANGED',
      'This retry differs from the saved request. Check the Inbox before starting again.',
    );
  return JSON.parse(row.result_json);
}
export function inboxGuard(db: D1Database, sql: string, bindings: (string | number)[]) {
  return db.prepare(`SELECT json(CASE WHEN (${sql}) THEN 'null' ELSE 'inbox changed' END)`).bind(...bindings);
}
export function inboxChanged(error: unknown): never {
  if (error instanceof Error && error.message.includes('malformed JSON'))
    throw new ApiError(
      409,
      'INBOX_CHANGED',
      'The Inbox or destination changed, or the Inbox is full. Refresh before trying again.',
    );
  throw error;
}
