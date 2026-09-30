import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, itemPhotoKey, logPhotoKey } from '../data';
import { photoContentType, readBytes } from '../http';

type PhotoOwner = 'items' | 'logs';

export function registerPhotoRoutes(api: Hono<AppEnv>): void {
  for (const table of ['items', 'logs'] as const) registerPhotoOwner(api, table);
}

function registerPhotoOwner(api: Hono<AppEnv>, table: PhotoOwner): void {
  const path = `/${table}/:id/photo`;
  const keyFor = table === 'items' ? itemPhotoKey : logPhotoKey;

  api.get(path, async (c) => {
    const id = c.req.param('id');
    if (!id) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    const key = await keyFor(c.env.DB, c.get('ownerId'), id);
    if (!key) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    const photo = await c.env.PHOTOS.get(key);
    if (!photo) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    return new Response(photo.body, {
      headers: { 'Content-Type': photo.httpMetadata?.contentType ?? 'application/octet-stream' },
    });
  });

  api.put(path, async (c) => {
    const id = c.req.param('id');
    if (!id) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    const oldKey = await keyFor(c.env.DB, c.get('ownerId'), id);
    const bytes = await readBytes(c.req.raw, 3 * 1024 * 1024);
    const contentType = photoContentType(bytes);
    const declaredType = c.req.header('content-type')?.split(';')[0]?.toLowerCase();
    if (declaredType !== contentType) throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file');
    const key = `private/${crypto.randomUUID()}`;
    await c.env.PHOTOS.put(key, bytes, { httpMetadata: { contentType } });
    try {
      await c.env.DB.prepare(`UPDATE ${table} SET photo_key = ?, updated_at = ? WHERE id = ? AND owner_id = ?`)
        .bind(key, Date.now(), id, c.get('ownerId')).run();
    } catch (error) {
      await c.env.PHOTOS.delete(key);
      throw error;
    }
    if (oldKey) c.executionCtx.waitUntil(c.env.PHOTOS.delete(oldKey).catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'photo_cleanup_failed', message: String(error) }));
    }));
    return c.json({ hasPhoto: true });
  });

  api.delete(path, async (c) => {
    const id = c.req.param('id');
    if (!id) throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
    const key = await keyFor(c.env.DB, c.get('ownerId'), id);
    if (!key) return c.body(null, 204);
    await c.env.DB.prepare(`UPDATE ${table} SET photo_key = NULL, updated_at = ? WHERE id = ? AND owner_id = ?`)
      .bind(Date.now(), id, c.get('ownerId')).run();
    c.executionCtx.waitUntil(c.env.PHOTOS.delete(key).catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'photo_cleanup_failed', message: String(error) }));
    }));
    return c.body(null, 204);
  });
}
