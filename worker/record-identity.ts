// Backup records share one ID namespace. Keep client-chosen retry/photo identities
// from colliding with another kind, including rows that may return from Trash.
export function recordIdentityGuard(db: D1Database, ids: readonly string[]) {
  const tables = [
    'lists',
    'items',
    'logs',
    'workout_sessions',
    'workout_routines',
    'inbox_entries',
    'photo_assets',
    'memory_boards',
    'receipts',
    'activity_plan_receipts',
    'time_capsules',
    'capsule_photos',
    'private_spaces',
    'space_entries',
    'space_entry_receipts',
    'pair_rounds',
    'shared_archives',
  ];
  const encoded = JSON.stringify(ids);
  return db
    .prepare(
      `SELECT json(CASE WHEN
    (SELECT COUNT(*)=COUNT(DISTINCT value) FROM json_each(?))
    AND ${tables.map((table) => `NOT EXISTS(SELECT 1 FROM ${table} WHERE id IN(SELECT value FROM json_each(?)))`).join(' AND ')}
    THEN 'null' ELSE 'record identity used' END)`,
    )
    .bind(encoded, ...tables.map(() => encoded));
}
