import { inboxPayload } from '../../src/shared/inbox';
import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError } from '../data';
import { readJson } from '../http';
import { offlineOperation, offlineSnapshot, type OfflineOperation } from '../../src/shared/offline';
import { fingerprint } from '../operations';
import { recordIdentityGuard } from '../record-identity';
import { itemInput } from '../../src/shared/validation';
import { inboxLimit } from '../../src/shared/inbox';
function epochGuard(db: D1Database, owner: string, epoch: string) {
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM offline_epochs WHERE owner_id=? AND epoch=?) THEN 'null' ELSE 'offline epoch changed' END)`,
    )
    .bind(owner, epoch);
}
async function failure(db: D1Database, owner: string, epoch: string, error: unknown): Promise<never> {
  const current = await db
    .prepare('SELECT epoch FROM offline_epochs WHERE owner_id=?')
    .bind(owner)
    .first<{ epoch: string }>();
  if (current?.epoch !== epoch)
    throw new ApiError(
      409,
      'OFFLINE_RESET',
      'Worth data was reset after this device copy. Pending saves were kept. Copy any text you need, then discard the old queue and prepare a fresh copy.',
    );
  const msg = error instanceof Error ? error.message : '';
  if (msg.includes('offline epoch changed'))
    throw new ApiError(
      409,
      'OFFLINE_RESET',
      'Worth data was reset after this device copy. Pending saves were kept. Copy any text you need, then discard the old queue and prepare a fresh copy.',
    );
  if (msg.includes('malformed JSON'))
    throw new ApiError(
      409,
      'OFFLINE_CONFLICT',
      'This record changed or is unavailable. Your queued note is kept. Compare it with the current archive before making a new edit.',
    );
  throw error;
}
async function known(db: D1Database, owner: string, op: OfflineOperation, hash: string) {
  try {
    const result = await db.batch<Record<string, unknown>>([
      epochGuard(db, owner, op.epoch),
      db.prepare('SELECT * FROM offline_operations WHERE id=?').bind(op.id),
    ]);
    const row = result[1].results[0];
    if (!row) return null;
    if (row.owner_id !== owner || row.epoch !== op.epoch || row.fingerprint !== hash)
      throw new ApiError(
        409,
        'OPERATION_CHANGED',
        'This pending save key belongs to another request. Its text is kept.',
      );
    return confirmation(op, JSON.parse(String(row.result_json)));
  } catch (e) {
    await failure(db, owner, op.epoch, e);
  }
}
function confirmation(op: OfflineOperation, result: { record: Record<string, unknown> }) {
  return {
    record: {
      ...result.record,
      note: op.note,
      ...(op.kind === 'capture'
        ? { title: op.title, date: null, decision: null, rank: null, listId: null, kind: 'inbox' }
        : {}),
    },
  };
}
export function registerOfflineRoutes(api: Hono<AppEnv>) {
  api.get('/offline/snapshot', async (c) => {
    const db = c.env.DB,
      owner = c.get('ownerId');
    await db
      .prepare('INSERT INTO offline_epochs(owner_id,epoch) VALUES(?,?) ON CONFLICT(owner_id) DO NOTHING')
      .bind(owner, crypto.randomUUID())
      .run();
    const stats = `(SELECT COUNT(*) FROM active_items WHERE owner_id=?)+(SELECT COUNT(*) FROM active_logs WHERE owner_id=?)+(SELECT COUNT(*) FROM inbox_entries WHERE owner_id=? AND trashed_at IS NULL)`;
    const bytes = `(SELECT COALESCE(SUM(length(CAST(title||note AS BLOB))),0) FROM active_items WHERE owner_id=?)+(SELECT COALESCE(SUM(length(CAST(title||note AS BLOB))),0) FROM active_logs WHERE owner_id=?)+(SELECT COALESCE(SUM(length(CAST(payload_json AS BLOB))),0) FROM inbox_entries WHERE owner_id=? AND trashed_at IS NULL)`;
    const bounded = `(${stats})<=2000 AND (${bytes})<=4194304`,
      bounds = [owner, owner, owner, owner, owner, owner];
    const result = await db.batch<Record<string, unknown>>([
      db.prepare('SELECT epoch FROM offline_epochs WHERE owner_id=?').bind(owner),
      db.prepare(`SELECT (${stats}) AS n,(${bytes}) AS bytes`).bind(...bounds),
      db.prepare('SELECT id,name,kind,ranked_ids FROM active_lists WHERE owner_id=? LIMIT 501').bind(owner),
      db
        .prepare(
          `SELECT id,list_id,title,note,updated_at,decision,started_on FROM active_items WHERE owner_id=? AND ${bounded} ORDER BY created_at DESC LIMIT 2001`,
        )
        .bind(owner, ...bounds),
      db
        .prepare(
          `SELECT g.id,g.list_id,COALESCE(NULLIF(g.title,''),p.title,'Visit') AS title,g.note,g.updated_at,g.happened_on FROM active_logs g LEFT JOIN record_items p ON p.id=g.item_id AND p.owner_id=g.owner_id AND p.list_id=g.list_id WHERE g.owner_id=? AND ${bounded} ORDER BY g.created_at DESC LIMIT 2001`,
        )
        .bind(owner, ...bounds),
      db
        .prepare(
          `SELECT id,payload_json,updated_at FROM inbox_entries WHERE owner_id=? AND trashed_at IS NULL AND ${bounded} ORDER BY created_at DESC LIMIT 2001`,
        )
        .bind(owner, ...bounds),
    ]);
    const stat = result[1].results[0];
    if (Number(stat.n) > 2000 || Number(stat.bytes) > 4194304 || result[2].results.length > 500)
      throw new ApiError(
        413,
        'OFFLINE_TOO_LARGE',
        'Offline copies support up to 2,000 text records, 500 collections and 4 MB of text. No partial copy was saved.',
      );
    const lists = result[2].results,
      rank = (row: Record<string, unknown>) => {
        const ids = JSON.parse(
            String(lists.find((l) => l.id === row.list_id)?.ranked_ids ?? '[]'),
          ) as string[],
          index = ids.indexOf(String(row.id));
        return index < 0 ? null : index + 1;
      };
    const records = [
      ...result[3].results.map((r) => ({
        id: r.id,
        kind: 'item',
        listId: r.list_id,
        title: r.title,
        note: r.note,
        updatedAt: r.updated_at,
        date: r.started_on,
        decision: r.decision,
        rank: rank(r),
      })),
      ...result[4].results.map((r) => ({
        id: r.id,
        kind: 'log',
        listId: r.list_id,
        title: r.title,
        note: r.note,
        updatedAt: r.updated_at,
        date: r.happened_on,
        decision: null,
        rank: null,
      })),
      ...result[5].results.map((r) => {
        const item = inboxPayload.parse(JSON.parse(String(r.payload_json)));
        return {
          id: r.id,
          kind: 'inbox',
          listId: null,
          title: item.title,
          note: item.note,
          updatedAt: r.updated_at,
          date: item.memory?.happenedOn ?? null,
          decision: item.decision,
          rank: null,
        };
      }),
    ];
    return c.json(
      offlineSnapshot.parse({
        owner,
        epoch: result[0].results[0].epoch,
        savedAt: Date.now(),
        lists: lists.map((l) => ({ id: l.id, name: l.name, kind: l.kind })),
        records,
      }),
    );
  });
  api.post('/offline/sync', async (c) => {
    const op = await readJson(c.req.raw, offlineOperation),
      db = c.env.DB,
      owner = c.get('ownerId'),
      hash = await fingerprint(op),
      previous = await known(db, owner, op, hash);
    if (previous) return c.json(previous);
    const now = Date.now();
    const writes: D1PreparedStatement[] = [epochGuard(db, owner, op.epoch)];
    let result: { record: Record<string, unknown> };
    if (op.kind === 'capture') {
      const payload = itemInput.parse({ title: op.title, note: op.note });
      writes.push(
        recordIdentityGuard(db, [op.id]),
        db
          .prepare(
            `SELECT json(CASE WHEN (SELECT COUNT(*) FROM inbox_entries WHERE owner_id=? AND trashed_at IS NULL)<? THEN 'null' ELSE 'offline conflict' END)`,
          )
          .bind(owner, inboxLimit),
        db
          .prepare(
            'INSERT INTO inbox_entries(id,owner_id,payload_json,created_at,updated_at) VALUES(?,?,?,?,?)',
          )
          .bind(op.id, owner, JSON.stringify(payload), now, now),
      );
      result = { record: { id: op.id, updatedAt: now } };
    } else {
      const table = op.recordKind === 'item' ? 'items' : op.recordKind === 'log' ? 'logs' : 'inbox_entries',
        view =
          op.recordKind === 'item'
            ? 'active_items'
            : op.recordKind === 'log'
              ? 'active_logs'
              : 'inbox_entries',
        note = op.recordKind === 'inbox' ? "json_extract(payload_json,'$.note')" : 'note',
        extra = op.recordKind === 'inbox' ? ' AND trashed_at IS NULL' : '';
      const before = await db
        .prepare(`SELECT *,${note} AS old_note FROM ${view} WHERE id=? AND owner_id=?${extra}`)
        .bind(op.recordId, owner)
        .first();
      if (!before || before.old_note !== op.expectedNote || before.updated_at !== op.expectedUpdatedAt) {
        const retry = await known(db, owner, op, hash);
        if (retry) return c.json(retry);
      }
      if (!before)
        throw new ApiError(404, 'NOT_FOUND', 'This record is no longer available. Your queued text is kept.');
      if (before.old_note !== op.expectedNote || before.updated_at !== op.expectedUpdatedAt)
        throw new ApiError(
          409,
          'OFFLINE_CONFLICT',
          'This record changed after your device copy. Your queued note is kept. Open the current record and compare before making a new edit.',
        );
      const updatedAt = Math.max(now, Number(before.updated_at) + 1);
      writes.push(
        recordIdentityGuard(db, [op.id]),
        db
          .prepare(
            `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM ${view} WHERE id=? AND owner_id=? AND ${note} IS ? AND updated_at=?${extra}) THEN 'null' ELSE 'offline conflict' END)`,
          )
          .bind(op.recordId, owner, op.expectedNote, op.expectedUpdatedAt),
        db
          .prepare(
            `UPDATE ${table} SET ${op.recordKind === 'inbox' ? "payload_json=json_set(payload_json,'$.note',?)" : 'note=?'},updated_at=?${op.recordKind === 'item' ? '' : ',revision=revision+1'} WHERE id=? AND owner_id=?`,
          )
          .bind(op.note, updatedAt, op.recordId, owner),
      );
      if (op.recordKind !== 'inbox')
        writes.push(
          db
            .prepare('UPDATE lists SET updated_at=MAX(updated_at,?) WHERE id=? AND owner_id=?')
            .bind(updatedAt, before.list_id, owner),
        );
      result = { record: { id: op.recordId, updatedAt } };
    }
    writes.push(
      db
        .prepare(
          'INSERT INTO offline_operations(id,owner_id,epoch,fingerprint,result_json) VALUES(?,?,?,?,?)',
        )
        .bind(op.id, owner, op.epoch, hash, JSON.stringify(result)),
    );
    try {
      await db.batch(writes);
    } catch (e) {
      const retry = await known(db, owner, op, hash);
      if (retry) return c.json(retry);
      await failure(db, owner, op.epoch, e);
    }
    return c.json(confirmation(op, result));
  });
}
