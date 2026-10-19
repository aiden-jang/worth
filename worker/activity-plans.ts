import { ApiError } from './data';
import { fingerprint, creationId } from './operations';
import { recordIdentityGuard } from './record-identity';

export function planGuard(db: D1Database, sql: string, values: (string | number | null)[]) {
  return db
    .prepare(`SELECT json(CASE WHEN (${sql}) THEN 'null' ELSE 'activity plan changed' END)`)
    .bind(...values);
}
export function activityListGuard(db: D1Database, owner: string, listId: string) {
  return planGuard(db, "EXISTS(SELECT 1 FROM active_lists WHERE owner_id=? AND id=? AND kind='activity')", [
    owner,
    listId,
  ]);
}
export function planFailure(error: unknown): never {
  if (error instanceof Error && error.message.includes('malformed JSON'))
    throw new ApiError(
      409,
      'PLAN_CHANGED',
      'This plan or activity changed elsewhere. Your draft is kept. Check the saved version before trying again.',
    );
  throw error;
}
/** The receipt and record share a transaction; a removed creation can never be replayed. */
export async function createPlanRecord<T>(options: {
  db: D1Database;
  owner: string;
  listId: string;
  kind: 'routine' | 'workout';
  key?: string;
  body: unknown;
  read: (id: string) => Promise<T>;
  statements: (id: string, now: number) => D1PreparedStatement[] | Promise<D1PreparedStatement[]>;
}) {
  const { db, owner, listId, kind, read } = options;
  const id = creationId(options.key),
    hash = await fingerprint({ listId, body: options.body });
  async function previous(): Promise<T | null> {
    const receipt = await db
      .prepare('SELECT owner_id,list_id,kind,fingerprint FROM activity_plan_receipts WHERE id=?')
      .bind(id)
      .first<{ owner_id: string; list_id: string; kind: string; fingerprint: string }>();
    if (!receipt) return null;
    if (
      receipt.owner_id !== owner ||
      receipt.list_id !== listId ||
      receipt.kind !== kind ||
      receipt.fingerprint !== hash
    )
      throw new ApiError(
        409,
        'OPERATION_CHANGED',
        'This retry differs from its saved request. Check the saved plan before starting another.',
      );
    try {
      return await read(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404)
        throw new ApiError(
          410,
          'PLAN_REMOVED',
          'This saved plan was removed. An old retry cannot recreate it.',
        );
      throw error;
    }
  }
  const prior = await previous();
  if (prior) return prior;
  const now = Date.now();
  try {
    await db.batch([
      recordIdentityGuard(db, [id]),
      activityListGuard(db, owner, listId),
      db
        .prepare('INSERT INTO activity_plan_receipts(id,owner_id,list_id,kind,fingerprint) VALUES(?,?,?,?,?)')
        .bind(id, owner, listId, kind, hash),
      ...(await options.statements(id, now)),
      db.prepare('UPDATE lists SET updated_at=? WHERE owner_id=? AND id=?').bind(now, owner, listId),
    ]);
  } catch (error) {
    const saved = await previous();
    if (saved) return saved;
    planFailure(error);
  }
  return read(id);
}
