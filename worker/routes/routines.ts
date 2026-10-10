import type { Hono } from 'hono';
import { routineInput } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listRoutines, requireList, requireRoutine } from '../data';
import { readJson } from '../http';

export function registerRoutineRoutes(api: Hono<AppEnv>): void {
  api.get('/lists/:listId/routines', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Routines belong in an activity list');
    return c.json({ routines: await listRoutines(c.env.DB, c.get('ownerId'), list.id) });
  });
  api.post('/lists/:listId/routines', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Routines belong in an activity list');
    const input = await readJson(c.req.raw, routineInput),
      id = crypto.randomUUID(),
      now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO workout_routines (id, list_id, owner_id, title, exercises, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).bind(id, list.id, c.get('ownerId'), input.title, JSON.stringify(input.exercises), now, now),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        list.id,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ routine: await requireRoutine(c.env.DB, c.get('ownerId'), id) }, 201);
  });
  api.put('/routines/:routineId', async (c) => {
    const routine = await requireRoutine(c.env.DB, c.get('ownerId'), c.req.param('routineId'));
    const input = await readJson(c.req.raw, routineInput),
      now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE workout_routines SET title = ?, exercises = ?, updated_at = ? WHERE id = ? AND owner_id = ?',
      ).bind(input.title, JSON.stringify(input.exercises), now, routine.id, c.get('ownerId')),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        routine.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ routine: await requireRoutine(c.env.DB, c.get('ownerId'), routine.id) });
  });
  api.delete('/routines/:routineId', async (c) => {
    const routine = await requireRoutine(c.env.DB, c.get('ownerId'), c.req.param('routineId'));
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM workout_routines WHERE id = ? AND owner_id = ?').bind(
        routine.id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        Date.now(),
        routine.listId,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}
