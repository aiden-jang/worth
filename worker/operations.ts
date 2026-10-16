import { ApiError } from './data';
export function operationId(key?: string) {
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    throw new ApiError(400, 'INVALID_CAPTURE_KEY', 'A valid retry key is required');
  return key;
}
export async function fingerprint(value: unknown) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, '0')).join('');
}
export async function previousOperation(
  db: D1Database,
  id: string,
  owner: string,
  kind: string,
  hash: string,
) {
  const row = await db
    .prepare('SELECT owner_id, kind, fingerprint, result_json FROM capture_operations WHERE id = ?')
    .bind(id)
    .first<{ owner_id: string; kind: string; fingerprint: string; result_json: string }>();
  if (!row) return null;
  if (row.owner_id !== owner || row.kind !== kind || row.fingerprint !== hash)
    throw new ApiError(
      409,
      'OPERATION_CHANGED',
      'This retry differs from the saved request. Start a fresh capture or restore.',
    );
  return JSON.parse(row.result_json) as { ids: string[] };
}

export function creationId(key?: string): string {
  if (!key) return crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    throw new ApiError(400, 'INVALID_CAPTURE_KEY', 'Invalid capture key');
  return key;
}
