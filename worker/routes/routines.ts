import type { Hono } from 'hono';
import { routineInput } from '../../src/shared/validation';
import { validRoutineTargets } from '../../src/shared/activity-plans';
import type { AppEnv } from '../context';
import { ApiError, listRoutines, requireList, requireRoutine } from '../data';
import { readJson } from '../http';
import { activityListGuard, createPlanRecord, planFailure, planGuard } from '../activity-plans';

export function registerRoutineRoutes(api: Hono<AppEnv>): void {
  api.get('/lists/:listId/routines', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Routines belong in an activity list');
    return c.json({ routines: await listRoutines(c.env.DB, c.get('ownerId'), list.id) });
  });
  api.post('/lists/:listId/routines', async (c) => {
    const owner = c.get('ownerId'),
      listId = c.req.param('listId'),
      db = c.env.DB;
    const list = await requireList(db, owner, listId);
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Routines belong in an activity list');
    const input = await readJson(c.req.raw, routineInput, 128 * 1024);
    if (!validRoutineTargets(input.exercises, input.targets ?? []))
      throw new ApiError(400, 'INVALID_PLAN', 'Each target needs a matching exercise name.');
    const routine = await createPlanRecord({
      db,
      owner,
      listId,
      kind: 'routine',
      key: c.req.header('Idempotency-Key'),
      body: input,
      read: (id) => requireRoutine(db, owner, id),
      statements: (id, now) => [
        db
          .prepare(
            'INSERT INTO workout_routines(id,list_id,owner_id,title,exercises,targets_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            listId,
            owner,
            input.title,
            JSON.stringify(input.exercises),
            JSON.stringify(input.targets ?? []),
            now,
            now,
          ),
      ],
    });
    return c.json({ routine }, 201);
  });
  api.put('/routines/:routineId', async (c) => {
    const owner = c.get('ownerId'),
      db = c.env.DB,
      routine = await requireRoutine(db, owner, c.req.param('routineId'));
    const input = await readJson(c.req.raw, routineInput, 128 * 1024),
      targets = input.targets ?? routine.targets ?? [],
      now = Date.now();
    if (!validRoutineTargets(input.exercises, targets))
      throw new ApiError(
        400,
        'INVALID_PLAN',
        'Each target needs a matching exercise name. Remove unmatched plans explicitly.',
      );
    try {
      await db.batch([
        activityListGuard(db, owner, routine.listId),
        planGuard(db, 'EXISTS(SELECT 1 FROM workout_routines WHERE id=? AND owner_id=? AND revision=?)', [
          routine.id,
          owner,
          input.expectedRevision ?? routine.revision ?? 0,
        ]),
        db
          .prepare(
            'UPDATE workout_routines SET title=?,exercises=?,targets_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=?',
          )
          .bind(
            input.title,
            JSON.stringify(input.exercises),
            JSON.stringify(targets),
            now,
            routine.id,
            owner,
          ),
        db
          .prepare('UPDATE lists SET updated_at=? WHERE id=? AND owner_id=?')
          .bind(now, routine.listId, owner),
      ]);
    } catch (error) {
      planFailure(error);
    }
    return c.json({ routine: await requireRoutine(db, owner, routine.id) });
  });
  api.delete('/routines/:routineId', async (c) => {
    const owner = c.get('ownerId'),
      db = c.env.DB,
      routine = await requireRoutine(db, owner, c.req.param('routineId'));
    const revision = Number(c.req.query('revision') ?? routine.revision ?? 0);
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new ApiError(400, 'INVALID_REVISION', 'Use the saved routine revision.');
    try {
      await db.batch([
        activityListGuard(db, owner, routine.listId),
        planGuard(db, 'EXISTS(SELECT 1 FROM workout_routines WHERE id=? AND owner_id=? AND revision=?)', [
          routine.id,
          owner,
          revision,
        ]),
        db.prepare('DELETE FROM workout_routines WHERE id=? AND owner_id=?').bind(routine.id, owner),
        db
          .prepare('UPDATE lists SET updated_at=? WHERE id=? AND owner_id=?')
          .bind(Date.now(), routine.listId, owner),
      ]);
    } catch (error) {
      planFailure(error);
    }
    return c.body(null, 204);
  });
}
