import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireItem, requireLog } from '../data';
import { photoContentType, readBytes } from '../http';

const MAX_PHOTO_BYTES = 900_000;

export function registerPhotoRoutes(api: Hono<AppEnv>): void {
  registerPhotoOwner(api, 'items', 'item_photos', 'item_id');
  registerPhotoOwner(api, 'logs', 'log_photos', 'log_id');
}

function registerPhotoOwner(
  api: Hono<AppEnv>,
  pathName: 'items' | 'logs',
  table: 'item_photos' | 'log_photos',
  idColumn: 'item_id' | 'log_id',
): void {
  const path = `/${pathName}/:id/photo`;

  async function requireOwner(db: D1Database, ownerId: string, id: string): Promise<void> {
    if (!id) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    if (pathName === 'items') await requireItem(db, ownerId, id);
    else await requireLog(db, ownerId, id);
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
    await requireOwner(c.env.DB, c.get('ownerId'), id);
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
    ]);
    return c.json({ hasPhoto: true });
  });

  api.delete(path, async (c) => {
    const id = c.req.param('id') ?? '';
    await requireOwner(c.env.DB, c.get('ownerId'), id);
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM ${table} WHERE ${idColumn} = ? AND owner_id = ?`).bind(
        id,
        c.get('ownerId'),
      ),
      c.env.DB.prepare(`UPDATE ${pathName} SET updated_at = ? WHERE id = ? AND owner_id = ?`).bind(
        Date.now(),
        id,
        c.get('ownerId'),
      ),
    ]);
    return c.body(null, 204);
  });
}
