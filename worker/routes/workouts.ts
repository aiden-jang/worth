import type { Hono } from 'hono';
import { workoutInput, workoutPatch } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listWorkouts, requireList, requireWorkout, requireRoutine } from '../data';
import { readJson } from '../http';

export function registerWorkoutRoutes(api: Hono<AppEnv>): void {
  api.get('/lists/:listId/workouts', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Workouts belong in an activity list');
    return c.json({ workouts: await listWorkouts(c.env.DB, c.get('ownerId'), list.id) });
  });
  api.post('/lists/:listId/workouts', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Workouts belong in an activity list');
    const input = await readJson(c.req.raw, workoutInput),
      id = crypto.randomUUID(),
      now = Date.now();
    const routine = input.routineId
      ? await requireRoutine(c.env.DB, c.get('ownerId'), input.routineId)
      : null;
    if (routine && routine.listId !== list.id)
      throw new ApiError(400, 'INVALID_ROUTINE', 'Choose a routine in this activity list');
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO workout_sessions (id, list_id, owner_id, title, happened_on, created_at, updated_at, planned_exercises, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      ).bind(
        id,
        list.id,
        c.get('ownerId'),
        input.title || routine?.title || 'Workout',
        input.happenedOn,
        now,
        now,
        JSON.stringify(routine?.exercises ?? []),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        list.id,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ workout: await requireWorkout(c.env.DB, c.get('ownerId'), id) }, 201);
  });
  api.patch('/workouts/:workoutId', async (c) => {
    const workout = await requireWorkout(c.env.DB, c.get('ownerId'), c.req.param('workoutId'));
    const patch = await readJson(c.req.raw, workoutPatch),
      now = Date.now();
    const happenedOn = patch.happenedOn ?? workout.happenedOn;
    const planned = patch.plannedExercises ?? workout.plannedExercises ?? [];
    const skipped =
      patch.skippedExercises ?? (workout.skippedExercises ?? []).filter((name) => planned.includes(name));
    if (skipped.some((name) => !planned.includes(name)))
      throw new ApiError(400, 'INVALID_SKIP', 'Only exercises in this visit can be skipped');
    await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE workout_sessions SET title = ?, happened_on = ?, updated_at = ?, status = ?, planned_exercises = ?, skipped_exercises = ? WHERE id = ? AND owner_id = ?',
      ).bind(
        (patch.title ?? workout.title) || 'Workout',
        happenedOn,
        now,
        patch.status ?? workout.status ?? 'finished',
        JSON.stringify(planned),
        JSON.stringify(skipped),
        workout.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare(
        'UPDATE logs SET happened_on = ?, updated_at = ? WHERE workout_id = ? AND owner_id = ?',
      ).bind(happenedOn, now, workout.id, c.get('ownerId')),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        workout.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ workout: await requireWorkout(c.env.DB, c.get('ownerId'), workout.id) });
  });
  api.delete('/workouts/:workoutId', async (c) => {
    const workout = await requireWorkout(c.env.DB, c.get('ownerId'), c.req.param('workoutId'));
    // ON DELETE SET NULL preserves each exercise, its sets and private photo.
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM workout_sessions WHERE id = ? AND owner_id = ?').bind(
        workout.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        Date.now(),
        workout.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}
