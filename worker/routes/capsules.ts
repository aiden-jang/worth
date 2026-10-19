import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { capsuleInput } from '../../src/shared/capsules';
import { sourceSelection } from '../../src/shared/record-snapshots';
import { ApiError } from '../data';
import { readJson } from '../http';
import { operationId } from '../operations';
import { prepareRecordSource } from '../source-snapshots';
import {
  capsuleView,
  capsuleSummaries,
  capsuleComparison,
  createCapsule,
  openCapsule,
  removeCapsule,
  checkCapsuleSave,
} from '../capsules';
export function registerCapsuleRoutes(api: Hono<AppEnv>) {
  api.post('/capsules/source-preview', async (c) => {
    const selection = await readJson(c.req.raw, sourceSelection);
    const result = await prepareRecordSource(c.env.DB, c.get('ownerId'), selection);
    return c.json({ preview: result.preview });
  });
  api.get('/capsules', async (c) => c.json({ capsules: await capsuleSummaries(c.env.DB, c.get('ownerId')) }));
  api.get('/capsules/:id', async (c) =>
    c.json(await capsuleView(c.env.DB, c.get('ownerId'), c.req.param('id'))),
  );
  api.get('/capsules/:id/current', async (c) =>
    c.json({ current: await capsuleComparison(c.env.DB, c.get('ownerId'), c.req.param('id')) }),
  );
  api.get('/capsules/:id/photos/:photoId', async (c) => {
    const row = await c.env.DB.prepare(
      `SELECT p.content_type,p.data FROM capsule_photos p JOIN time_capsules t ON t.id=p.capsule_id AND t.owner_id=p.owner_id WHERE t.owner_id=? AND t.id=? AND t.removed_at IS NULL AND t.opened_at IS NOT NULL AND p.id=? AND p.data IS NOT NULL`,
    )
      .bind(c.get('ownerId'), c.req.param('id'), c.req.param('photoId'))
      .first<{ content_type: string; data: number[] }>();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Capsule photo unavailable.');
    return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': row.content_type } });
  });
  api.post('/capsules', async (c) => {
    const id = operationId(c.req.header('Idempotency-Key')),
      input = await readJson(c.req.raw, capsuleInput, 64 * 1024);
    return c.json(await createCapsule(c.env.DB, c.get('ownerId'), id, input), 201);
  });
  api.post('/capsules/:id/open', async (c) =>
    c.json(await openCapsule(c.env.DB, c.get('ownerId'), c.req.param('id'))),
  );
  api.post('/capsules/:id/check', async (c) =>
    c.json(
      await checkCapsuleSave(
        c.env.DB,
        c.get('ownerId'),
        c.req.param('id'),
        await readJson(c.req.raw, capsuleInput, 64 * 1024),
      ),
    ),
  );
  api.delete('/capsules/:id', async (c) => {
    await removeCapsule(c.env.DB, c.get('ownerId'), c.req.param('id'));
    return c.body(null, 204);
  });
}
