import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireItem, requireList, requireLog } from '../data';
import { photoContentType, readBytes } from '../http';

const MAX_PHOTO_BYTES = 900_000;

export function registerPhotoRoutes(api: Hono<AppEnv>): void {
  registerListCover(api);
  registerPhotoOwner(api, 'items', 'item_photos', 'item_id');
  registerPhotoOwner(api, 'logs', 'log_photos', 'log_id');
}

function registerListCover(api: Hono<AppEnv>): void {
  const path = '/lists/:id/cover';

  api.get(path, async (c) => {
    const id = c.req.param('id') ?? '';
    await requireList(c.env.DB, c.get('ownerId'), id);
    const photo = await c.env.DB.prepare(
      'SELECT content_type, data FROM list_photos WHERE list_id = ? AND owner_id = ?',
    )
      .bind(id, c.get('ownerId'))
      .first<{ content_type: string; data: number[] }>();
    if (!photo) throw new ApiError(404, 'NOT_FOUND', 'Cover photo not found');
    return new Response(new Uint8Array(photo.data), { headers: { 'Content-Type': photo.content_type } });
  });

  api.put(path, async (c) => {
    const id = c.req.param('id') ?? '';
    const list = await requireList(c.env.DB, c.get('ownerId'), id);
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can have a cover');
    const bytes = await readBytes(c.req.raw, MAX_PHOTO_BYTES);
    const contentType = photoContentType(bytes);
    const declaredType = c.req.header('content-type')?.split(';')[0]?.toLowerCase();
    if (declaredType !== contentType)
      throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file');
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO list_photos (list_id, owner_id, content_type, data, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(list_id) DO UPDATE SET
        content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at`,
      ).bind(id, c.get('ownerId'), contentType, bytes, now),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        id,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ hasCoverPhoto: true });
  });

  api.delete(path, async (c) => {
    const id = c.req.param('id') ?? '';
    const list = await requireList(c.env.DB, c.get('ownerId'), id);
    if (list.kind !== 'collection')
      throw new ApiError(400, 'WRONG_LIST_KIND', 'Only collections can have a cover');
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM list_photos WHERE list_id = ? AND owner_id = ?').bind(
        id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        Date.now(),
        id,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}

function registerPhotoOwner(
  api: Hono<AppEnv>,
  pathName: 'items' | 'logs',
  table: 'item_photos' | 'log_photos',
  idColumn: 'item_id' | 'log_id',
): void {
  const path = `/${pathName}/:id/photo`;

  async function requireOwner(db: D1Database, ownerId: string, id: string): Promise<string> {
    if (!id) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    const record =
      pathName === 'items' ? await requireItem(db, ownerId, id) : await requireLog(db, ownerId, id);
    return record.listId;
  }

  api.get(path, async (c) => {
    const id = c.req.param('id') ?? '';
    await requireOwner(c.env.DB, c.get('ownerId'), id);
    const photo = await c.env.DB.prepare(
      `SELECT content_type, data FROM ${table} WHERE ${idColumn} = ? AND owner_id = ?`,
    )
      .bind(id, c.get('ownerId'))
      .first<{ content_type: string; data: number[] }>();
    if (!photo) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    return new Response(new Uint8Array(photo.data), {
      headers: { 'Content-Type': photo.content_type },
    });
  });

  api.put(path, async (c) => {
    const id = c.req.param('id') ?? '';
    const listId = await requireOwner(c.env.DB, c.get('ownerId'), id);
    const bytes = await readBytes(c.req.raw, MAX_PHOTO_BYTES);
    const contentType = photoContentType(bytes);
    const declaredType = c.req.header('content-type')?.split(';')[0]?.toLowerCase();
    if (declaredType !== contentType)
      throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file');
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO ${table} (${idColumn}, owner_id, content_type, data, updated_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(${idColumn}) DO UPDATE SET
        content_type = excluded.content_type, data = excluded.data, updated_at = excluded.updated_at`,
      ).bind(id, c.get('ownerId'), contentType, bytes, now),
      c.env.DB.prepare(`UPDATE ${pathName} SET updated_at = ? WHERE id = ? AND owner_id = ?`).bind(
        now,
        id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        listId,
        c.get('ownerId'),
      ),
    ]);
    return c.json({ hasPhoto: true });
  });

  api.delete(path, async (c) => {
    const id = c.req.param('id') ?? '';
    const listId = await requireOwner(c.env.DB, c.get('ownerId'), id);
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ? AND owner_id = ?`).bind(
        id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare(`UPDATE ${pathName} SET updated_at = ? WHERE id = ? AND owner_id = ?`).bind(
        now,
        id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare('UPDATE lists SET updated_at = ? WHERE id = ? AND owner_id = ?').bind(
        now,
        listId,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}
