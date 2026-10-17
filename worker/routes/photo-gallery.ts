import type { Hono } from 'hono';
import { z } from 'zod';
import { galleryPatch } from '../../src/shared/photo-gallery';
import type { AppEnv } from '../context';
import { ApiError } from '../data';
import { photoContentType, readBytes, readJson } from '../http';
import {
  addGalleryPhoto,
  changeGallery,
  galleryTables,
  readGallery,
  removeGalleryPhoto,
} from '../photo-gallery';
const removal = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
export function registerGalleryRoutes(api: Hono<AppEnv>) {
  for (const kind of ['items', 'logs'] as const) {
    const path = `/${kind}/:id/photos`;
    api.get(path, async (c) =>
      c.json({ gallery: await readGallery(c.env.DB, c.get('ownerId'), kind, c.req.param('id') ?? '') }),
    );
    api.put(path, async (c) => {
      const input = await readJson(c.req.raw, galleryPatch, 128 * 1024);
      return c.json({
        gallery: await changeGallery(c.env.DB, c.get('ownerId'), kind, c.req.param('id') ?? '', input),
      });
    });
    api.get(`${path}/:photoId`, async (c) => {
      const id = c.req.param('id') ?? '',
        assetId = c.req.param('photoId');
      const album = await readGallery(c.env.DB, c.get('ownerId'), kind, id);
      if (!album.entries.some((entry) => entry.id === assetId))
        throw new ApiError(404, 'NOT_FOUND', 'Photo not found');
      const config = galleryTables(kind),
        photo = await c.env.DB.prepare(
          `SELECT content_type,data FROM photo_assets WHERE id=? AND owner_id=? AND ${config.field}=? AND removed_at IS NULL AND data IS NOT NULL AND ${config.field} IN (SELECT id FROM ${config.view} WHERE owner_id=?)`,
        )
          .bind(assetId, c.get('ownerId'), id, c.get('ownerId'))
          .first<{ content_type: string; data: number[] }>();
      if (!photo)
        throw new ApiError(
          404,
          'PHOTO_UNAVAILABLE',
          'This original is unavailable. A records-only restore keeps its caption and annotations without the photo.',
        );
      return new Response(new Uint8Array(photo.data), {
        headers: { 'Content-Type': photo.content_type, 'Cache-Control': 'private, no-store' },
      });
    });
    api.put(`${path}/:photoId`, async (c) => {
      const photoId = z.string().uuid().safeParse(c.req.param('photoId'));
      const revision = c.req.header('X-Worth-Gallery-Revision');
      if (!photoId.success || revision === undefined || !/^\d{1,15}$/.test(revision))
        throw new ApiError(400, 'INVALID_PHOTO_REQUEST', 'Choose a photo and reload its saved photo list.');
      const bytes = await readBytes(c.req.raw, 900000),
        contentType = photoContentType(bytes);
      if (c.req.header('content-type')?.split(';')[0]?.toLowerCase() !== contentType)
        throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Image type does not match the file');
      return c.json({
        gallery: await addGalleryPhoto(
          c.env.DB,
          c.get('ownerId'),
          kind,
          c.req.param('id') ?? '',
          photoId.data,
          bytes,
          contentType,
          Number(revision),
        ),
      });
    });
    api.delete(`${path}/:photoId`, async (c) => {
      const input = await readJson(c.req.raw, removal);
      return c.json({
        gallery: await removeGalleryPhoto(
          c.env.DB,
          c.get('ownerId'),
          kind,
          c.req.param('id') ?? '',
          c.req.param('photoId'),
          input.expectedRevision,
        ),
      });
    });
  }
}
