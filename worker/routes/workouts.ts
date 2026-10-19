import type { Hono } from 'hono';
import { workoutInput, workoutPatch } from '../../src/shared/validation';
import { validRoutineTargets } from '../../src/shared/activity-plans';
import type { AppEnv } from '../context';
import { ApiError, listWorkouts, requireList, requireWorkout, requireRoutine } from '../data';
import { readJson } from '../http';
import { activityListGuard, createPlanRecord, planFailure, planGuard } from '../activity-plans';

export function registerWorkoutRoutes(api: Hono<AppEnv>): void {
  api.get('/lists/:listId/workouts', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Workouts belong in an activity list');
    return c.json({ workouts: await listWorkouts(c.env.DB, c.get('ownerId'), list.id) });
  });
  api.post('/lists/:listId/workouts', async (c) => {
    const db = c.env.DB,
      owner = c.get('ownerId'),
      listId = c.req.param('listId');
    const list = await requireList(db, owner, listId);
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Workouts belong in an activity list');
    const input = await readJson(c.req.raw, workoutInput);
    const workout = await createPlanRecord({
      db,
      owner,
      listId,
      kind: 'workout',
      key: c.req.header('Idempotency-Key'),
      body: input,
      read: (id) => requireWorkout(db, owner, id),
      statements: async (id, now) => {
        const routine = input.routineId ? await requireRoutine(db, owner, input.routineId) : null;
        if (routine && routine.listId !== listId)
          throw new ApiError(400, 'INVALID_ROUTINE', 'Choose a routine in this activity list.');
        return [
          ...(routine
            ? [
                planGuard(
                  db,
                  'EXISTS(SELECT 1 FROM workout_routines WHERE id=? AND owner_id=? AND list_id=? AND revision=?)',
                  [routine.id, owner, listId, input.expectedRoutineRevision ?? routine.revision ?? 0],
                ),
              ]
            : []),
          db
            .prepare(
              "INSERT INTO workout_sessions(id,list_id,owner_id,title,happened_on,planned_exercises,targets_json,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active',?,?)",
            )
            .bind(
              id,
              listId,
              owner,
              input.title || routine?.title || 'Workout',
              input.happenedOn,
              JSON.stringify(routine?.exercises ?? []),
              JSON.stringify(routine?.targets ?? []),
              now,
              now,
            ),
        ];
      },
    });
    return c.json({ workout }, 201);
  });
  api.patch('/workouts/:workoutId', async (c) => {
    const db = c.env.DB,
      owner = c.get('ownerId'),
      workout = await requireWorkout(db, owner, c.req.param('workoutId'));
    const patch = await readJson(c.req.raw, workoutPatch, 128 * 1024),
      now = Date.now();
    const happenedOn = patch.happenedOn ?? workout.happenedOn,
      planned = patch.plannedExercises ?? workout.plannedExercises ?? [];
    const skipped =
      patch.skippedExercises ?? (workout.skippedExercises ?? []).filter((name) => planned.includes(name));
    const targets = patch.targets ?? workout.targets ?? [];
    if (skipped.some((name) => !planned.includes(name)))
      throw new ApiError(400, 'INVALID_SKIP', 'Only exercises in this visit can be skipped');
    if (!validRoutineTargets(planned, targets))
      throw new ApiError(
        400,
        'INVALID_PLAN',
        'Each target needs a matching exercise name. Remove unmatched plans explicitly.',
      );
    try {
      await db.batch([
        activityListGuard(db, owner, workout.listId),
        planGuard(db, 'EXISTS(SELECT 1 FROM workout_sessions WHERE id=? AND owner_id=? AND revision=?)', [
          workout.id,
          owner,
          patch.expectedRevision ?? workout.revision ?? 0,
        ]),
        db
          .prepare(
            'UPDATE workout_sessions SET title=?,happened_on=?,updated_at=?,status=?,planned_exercises=?,skipped_exercises=?,targets_json=?,revision=revision+1 WHERE id=? AND owner_id=?',
          )
          .bind(
            (patch.title ?? workout.title) || 'Workout',
            happenedOn,
            now,
            patch.status ?? workout.status ?? 'finished',
            JSON.stringify(planned),
            JSON.stringify(skipped),
            JSON.stringify(targets),
            workout.id,
            owner,
          ),
        // Moving the visit invalidates any open exercise editor using the old date.
        db
          .prepare(
            'UPDATE logs SET happened_on=?,updated_at=?,revision=revision+1 WHERE workout_id=? AND owner_id=? AND happened_on<>?',
          )
          .bind(happenedOn, now, workout.id, owner, happenedOn),
        db
          .prepare('UPDATE lists SET updated_at=? WHERE id=? AND owner_id=?')
          .bind(now, workout.listId, owner),
      ]);
    } catch (error) {
      planFailure(error);
    }
    return c.json({ workout: await requireWorkout(db, owner, workout.id) });
  });
  api.delete('/workouts/:workoutId', async (c) => {
    const db = c.env.DB,
      owner = c.get('ownerId'),
      workout = await requireWorkout(db, owner, c.req.param('workoutId'));
    const revision = Number(c.req.query('revision') ?? workout.revision ?? 0);
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new ApiError(400, 'INVALID_REVISION', 'Use the saved workout revision.');
    try {
      await db.batch([
        activityListGuard(db, owner, workout.listId),
        planGuard(db, 'EXISTS(SELECT 1 FROM workout_sessions WHERE id=? AND owner_id=? AND revision=?)', [
          workout.id,
          owner,
          revision,
        ]),
        // ON DELETE SET NULL preserves exercises, measurements, notes and private photos.
        db.prepare('DELETE FROM workout_sessions WHERE id=? AND owner_id=?').bind(workout.id, owner),
        db
          .prepare('UPDATE lists SET updated_at=? WHERE id=? AND owner_id=?')
          .bind(Date.now(), workout.listId, owner),
      ]);
    } catch (error) {
      planFailure(error);
    }
    return c.body(null, 204);
  });
}
