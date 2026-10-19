import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { aliasInput } from '../../src/shared/activity-plans';
import { ApiError, requireList } from '../data';
import { readJson } from '../http';
export function registerActivityAliasRoutes(api: Hono<AppEnv>) {
  api.put('/lists/:listId/exercise-aliases', async (c) => {
    const owner = c.get('ownerId'),
      list = await requireList(c.env.DB, owner, c.req.param('listId'));
    if (list.kind !== 'activity')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Exercise aliases belong to an activity list.');
    const input = await readJson(c.req.raw, aliasInput, 128 * 1024);
    const result = await c.env.DB.prepare(
      `UPDATE lists SET exercise_aliases=?,exercise_alias_revision=exercise_alias_revision+1,updated_at=? WHERE id=? AND owner_id=? AND kind='activity' AND trashed_at IS NULL AND exercise_alias_revision=?`,
    )
      .bind(JSON.stringify(input.groups), Date.now(), list.id, owner, input.expectedRevision)
      .run();
    if (!result.meta.changes) {
      const saved = await requireList(c.env.DB, owner, list.id);
      if (JSON.stringify(saved.exerciseAliases ?? []) !== JSON.stringify(input.groups))
        throw new ApiError(
          409,
          'ALIASES_CHANGED',
          'These aliases changed elsewhere. Your draft is kept; check the saved groups before replacing them.',
        );
      return c.json({ list: saved });
    }
    return c.json({ list: await requireList(c.env.DB, owner, list.id) });
  });
}
