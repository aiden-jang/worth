import type { Hono } from 'hono';
import { logInput, logPatch } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listLogs, requireItem, requireList, requireLog, validateWorkoutTarget } from '../data';
import { readJson } from '../http';
import { creationId } from '../operations';
import { hasVisitContext, emptyVisitContext } from '../../src/shared/visit-context';

export function registerLogRoutes(api: Hono<AppEnv>): void {
  api.get('/lists/:listId/logs', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    return c.json({ logs: await listLogs(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.post('/lists/:listId/logs', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    const input = await readJson(c.req.raw, logInput, 128 * 1024);
    if (list.kind !== 'activity' && input.measurements.length)
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Named measurements belong to activity logs.');
    if (list.kind !== 'collection' && hasVisitContext(input.context))
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Visit details belong to collection revisits');
    await validateLogTarget(c.env.DB, c.get('ownerId'), list.id, list.kind, input.itemId, input.title);
    await validateWorkoutTarget(
      c.env.DB,
      c.get('ownerId'),
      list.id,
      input.workoutId,
      input.happenedOn,
      input.exerciseSets,
      input.itemId,
      input.measurements,
      input.exercise,
    );
    const id = creationId(c.req.header('Idempotency-Key'));
    const existing = await c.env.DB.prepare('SELECT owner_id, list_id FROM logs WHERE id = ?')
      .bind(id)
      .first<{ owner_id: string; list_id: string }>();
    if (existing) {
      if (existing.owner_id !== c.get('ownerId') || existing.list_id !== list.id)
        throw new ApiError(409, 'ID_CONFLICT', 'Please start a fresh capture');
      return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), id) }, 201);
    }
    const now = Date.now();
    try {
      await c.env.DB.batch([
        logWriteGuard(c.env.DB, c.get('ownerId'), list.id, input),
        c.env.DB.prepare(
          `INSERT INTO logs
      (id, list_id, item_id, owner_id, title, happened_on, note, amount, unit, sets, reps, exercise_sets, weight_unit, workout_id, context_json, measurements_json, exercise_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          id,
          list.id,
          input.itemId,
          c.get('ownerId'),
          input.title,
          input.happenedOn,
          input.note,
          input.amount,
          input.unit,
          input.sets,
          input.reps,
          JSON.stringify(input.exerciseSets),
          input.weightUnit,
          input.workoutId,
          JSON.stringify(input.context),
          JSON.stringify(input.measurements),
          input.exercise || input.exerciseSets.length ? 1 : 0,
          now,
          now,
        ),
        c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
          now,
          list.id,
          c.get('ownerId'),
        ),
      ]);
    } catch (error) {
      const previous = await c.env.DB.prepare(
        'SELECT id FROM active_logs WHERE id=? AND owner_id=? AND list_id=?',
      )
        .bind(id, c.get('ownerId'), list.id)
        .first();
      if (previous) return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), id) }, 201);
      logWriteFailure(error);
    }
    return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), id) }, 201);
  });

  api.patch('/logs/:logId', async (c) => {
    const log = await requireLog(c.env.DB, c.get('ownerId'), c.req.param('logId'));
    const list = await requireList(c.env.DB, c.get('ownerId'), log.listId);
    const patch = await readJson(c.req.raw, logPatch, 128 * 1024);
    const merged = logInput.safeParse({
      exercise: patch.exercise ?? log.exercise ?? false,
      measurements: patch.measurements ?? log.measurements ?? [],
      context: patch.context ?? log.context ?? emptyVisitContext,
      workoutId: patch.workoutId === undefined ? (log.workoutId ?? null) : patch.workoutId,
      exerciseSets: patch.exerciseSets ?? log.exerciseSets ?? [],
      weightUnit: patch.weightUnit ?? log.weightUnit ?? 'kg',
      itemId: patch.itemId === undefined ? log.itemId : patch.itemId,
      title: patch.title ?? log.title,
      happenedOn: patch.happenedOn ?? log.happenedOn,
      note: patch.note ?? log.note,
      amount: patch.amount === undefined ? log.amount : patch.amount,
      unit: patch.unit ?? log.unit,
      sets: patch.sets === undefined ? log.sets : patch.sets,
      reps: patch.reps === undefined ? log.reps : patch.reps,
    });
    if (!merged.success)
      throw new ApiError(400, 'INVALID_INPUT', merged.error.issues[0]?.message ?? 'Invalid log');
    const value = merged.data;
    if (list.kind !== 'activity' && value.measurements.length)
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Named measurements belong to activity logs.');
    if (list.kind !== 'collection' && hasVisitContext(value.context))
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Visit details belong to collection revisits');
    await validateWorkoutTarget(
      c.env.DB,
      c.get('ownerId'),
      list.id,
      value.workoutId,
      value.happenedOn,
      value.exerciseSets,
      value.itemId,
      value.measurements,
      value.exercise,
    );
    await validateLogTarget(c.env.DB, c.get('ownerId'), list.id, list.kind, value.itemId, value.title);
    const now = Date.now();
    // The editor supplies its original revision; older clients still guard the read/write interval.
    const revision = patch.expectedRevision ?? log.revision ?? 0;
    try {
      await c.env.DB.batch([
        logWriteGuard(c.env.DB, c.get('ownerId'), list.id, value, { id: log.id, revision }),
        c.env.DB.prepare(
          `UPDATE logs SET item_id = ?, title = ?, happened_on = ?, note = ?, amount = ?,
        unit = ?, sets = ?, reps = ?, exercise_sets = ?, weight_unit = ?, workout_id = ?, context_json = ?, measurements_json = ?, exercise_mode = ?,
        revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND list_id = ? AND revision = ?
        AND id IN (SELECT id FROM active_logs WHERE owner_id = ?)`,
        ).bind(
          value.itemId,
          value.title,
          value.happenedOn,
          value.note,
          value.amount,
          value.unit,
          value.sets,
          value.reps,
          JSON.stringify(value.exerciseSets),
          value.weightUnit,
          value.workoutId,
          JSON.stringify(value.context),
          JSON.stringify(value.measurements),
          value.exercise || value.exerciseSets.length ? 1 : 0,
          now,
          log.id,
          c.get('ownerId'),
          list.id,
          revision,
          c.get('ownerId'),
        ),
        c.env.DB.prepare(
          'UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ? AND trashed_at IS NULL',
        ).bind(now, list.id, c.get('ownerId')),
      ]);
    } catch (error) {
      logWriteFailure(error);
    }
    return c.json({ log: await requireLog(c.env.DB, c.get('ownerId'), log.id) });
  });

  api.delete('/logs/:logId', async (c) => {
    const log = await requireLog(c.env.DB, c.get('ownerId'), c.req.param('logId'));
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE logs SET trashed_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        log.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        log.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}

function logWriteGuard(
  db: D1Database,
  owner: string,
  listId: string,
  value: { itemId: string | null; workoutId: string | null; happenedOn: string },
  edit?: { id: string; revision: number },
) {
  return db
    .prepare(
      `SELECT json(CASE WHEN
    EXISTS(SELECT 1 FROM active_lists WHERE id=? AND owner_id=?)
    AND (? IS NULL OR EXISTS(SELECT 1 FROM record_items WHERE id=? AND list_id=? AND owner_id=?))
    AND (? IS NULL OR EXISTS(SELECT 1 FROM workout_sessions WHERE id=? AND list_id=? AND owner_id=? AND happened_on=?))
    AND (? IS NULL OR EXISTS(SELECT 1 FROM active_logs WHERE id=? AND list_id=? AND owner_id=? AND revision=?))
    THEN 'null' ELSE 'log target changed' END)`,
    )
    .bind(
      listId,
      owner,
      value.itemId,
      value.itemId,
      listId,
      owner,
      value.workoutId,
      value.workoutId,
      listId,
      owner,
      value.happenedOn,
      edit?.id ?? null,
      edit?.id ?? null,
      listId,
      owner,
      edit?.revision ?? 0,
    );
}
function logWriteFailure(error: unknown): never {
  if (error instanceof Error && error.message.includes('malformed JSON'))
    throw new ApiError(
      409,
      'LOG_CHANGED',
      'This visit or its linked record changed elsewhere. Check the saved version before trying again.',
    );
  throw error;
}

async function validateLogTarget(
  db: D1Database,
  ownerId: string,
  listId: string,
  kind: 'collection' | 'activity',
  itemId: string | null,
  title: string,
): Promise<void> {
  if (kind === 'activity') {
    if (itemId !== null || !title)
      throw new ApiError(400, 'INVALID_LOG', 'An activity needs a title and no item');
    return;
  }
  if (!itemId) throw new ApiError(400, 'INVALID_LOG', 'Choose an item for this log');
  const item = await requireItem(db, ownerId, itemId, true);
  if (item.listId !== listId) throw new ApiError(400, 'INVALID_LOG', 'The item belongs to another list');
}
