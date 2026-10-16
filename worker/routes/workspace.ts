import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, listItems, requireList } from '../data';
import { readJson } from '../http';
import { collectionWorkspace, filterWorkspace, workspaceUpdate } from '../../src/shared/workspace';

export function registerWorkspaceRoutes(api: Hono<AppEnv>) {
  api.get('/lists/:listId/workspace', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'Choose a collection');
    const row = await c.env.DB.prepare(
      'SELECT workspace_json, workspace_revision FROM lists WHERE id = ? AND owner_id = ?',
    )
      .bind(list.id, c.get('ownerId'))
      .first<{ workspace_json: string; workspace_revision: number }>();
    const items = await listItems(c.env.DB, c.get('ownerId'), list.id);
    return c.json({
      workspace: filterWorkspace(
        collectionWorkspace.parse(JSON.parse(row!.workspace_json)),
        new Set(items.map((item) => item.id)),
      ),
      revision: row!.workspace_revision,
    });
  });
  api.put('/lists/:listId/workspace', async (c) => {
    const owner = c.get('ownerId');
    const list = await requireList(c.env.DB, owner, c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'Choose a collection');
    const input = await readJson(c.req.raw, workspaceUpdate, 512 * 1024);
    const shelfIds = [input.workspace.shelf?.keepsakeId, input.workspace.shelf?.inscription?.itemId].filter(
      Boolean,
    );
    const result = await c.env.DB.prepare(
      `UPDATE lists SET workspace_json = ?, workspace_revision = workspace_revision + 1
      WHERE id = ? AND owner_id = ? AND trashed_at IS NULL AND workspace_revision = ?
      AND NOT EXISTS (
        SELECT 1 FROM json_each(?, '$.rankings') ranking, json_each(ranking.value, '$.itemIds') member
        WHERE NOT EXISTS (SELECT 1 FROM active_items i WHERE i.id = member.value AND i.owner_id = ? AND i.list_id = lists.id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM json_each(?) member
        WHERE NOT EXISTS (SELECT 1 FROM active_items i WHERE i.id = member.value AND i.owner_id = ? AND i.list_id = lists.id)
      )`,
    )
      .bind(
        JSON.stringify(input.workspace),
        list.id,
        owner,
        input.expectedRevision,
        JSON.stringify(input.workspace),
        owner,
        JSON.stringify(shelfIds),
        owner,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        'WORKSPACE_CHANGED',
        'These saved tools or records changed elsewhere. Refresh them before saving again.',
      );
    return c.json({ workspace: input.workspace, revision: input.expectedRevision + 1 });
  });
}
