import type { Hono } from 'hono';
import { listInput, listPatch, rankInput } from '../../src/shared/validation';
import type { AppEnv } from '../context';
import { ApiError, listItems, listLists, requireList } from '../data';
import { readJson } from '../http';

export function registerListRoutes(api: Hono<AppEnv>): void {
  api.get('/lists', async (c) => c.json({ lists: await listLists(c.env.DB, c.get('ownerId')) }));

  api.post('/lists', async (c) => {
    const input = await readJson(c.req.raw, listInput);
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare(`INSERT INTO lists (id, owner_id, name, kind, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, c.get('ownerId'), input.name, input.kind, input.description, now, now).run();
    return c.json({ list: await requireList(c.env.DB, c.get('ownerId'), id) }, 201);
  });

  api.get('/lists/:listId', async (c) => c.json({ list: await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId')) }));

  api.patch('/lists/:listId', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    const patch = await readJson(c.req.raw, listPatch);
    await c.env.DB.prepare('UPDATE lists SET name = ?, description = ?, updated_at = ? WHERE id = ? AND owner_id = ?')
      .bind(patch.name ?? list.name, patch.description ?? list.description, Date.now(), list.id, c.get('ownerId')).run();
    return c.json({ list: await requireList(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.delete('/lists/:listId', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    const { results: itemPhotos } = await c.env.DB.prepare('SELECT photo_key FROM items WHERE list_id = ? AND photo_key IS NOT NULL')
      .bind(list.id).all<{ photo_key: string }>();
    const { results: logPhotos } = await c.env.DB.prepare('SELECT photo_key FROM logs WHERE list_id = ? AND photo_key IS NOT NULL')
      .bind(list.id).all<{ photo_key: string }>();
    await c.env.DB.prepare('DELETE FROM lists WHERE id = ? AND owner_id = ?').bind(list.id, c.get('ownerId')).run();
    const keys = [...itemPhotos, ...logPhotos].map((row) => row.photo_key);
    if (keys.length) c.executionCtx.waitUntil(deletePhotos(c.env.PHOTOS, keys));
    return c.body(null, 204);
  });

  api.get('/lists/:listId/items', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'This list holds activity logs');
    return c.json({ items: await listItems(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.put('/lists/:listId/rank', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can be ranked');
    const input = await readJson(c.req.raw, rankInput);
    const items = await listItems(c.env.DB, c.get('ownerId'), list.id);
    const validIds = new Set(items.map((item) => item.id));
    if (input.itemIds.some((id) => !validIds.has(id))) {
      throw new ApiError(400, 'INVALID_RANK', 'The ranking includes an item outside this list');
    }
    const result = await c.env.DB.prepare(`UPDATE lists SET ranked_ids = ?, rank_revision = rank_revision + 1,
      updated_at = ? WHERE id = ? AND owner_id = ? AND rank_revision = ?`)
      .bind(JSON.stringify(input.itemIds), Date.now(), list.id, c.get('ownerId'), input.expectedRevision).run();
    if (result.meta.changes === 0) throw new ApiError(409, 'RANK_CHANGED', 'This ranking changed elsewhere. Refresh and try again.');
    return c.json({ list: await requireList(c.env.DB, c.get('ownerId'), list.id) });
  });
}

async function deletePhotos(bucket: R2Bucket, keys: string[]): Promise<void> {
  try {
    for (let start = 0; start < keys.length; start += 1000) {
      await bucket.delete(keys.slice(start, start + 1000));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'photo_cleanup_failed', count: keys.length, message: String(error) }));
  }
}

