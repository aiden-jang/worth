import type { Hono } from 'hono';
import { shareInput } from '../../src/shared/validation';
import type { PublicShare } from '../../src/shared/models';
import type { AppEnv } from '../context';
import { ApiError, listItems, listShares, requireList } from '../data';
import { readJson } from '../http';
import { createShareToken, hashToken, shareSnapshot, validShareToken } from '../sharing';

export function registerPublicShareRoute(api: Hono<AppEnv>): void {
  api.get('/public/:token', async (c) => {
    const token = c.req.param('token');
    if (!validShareToken(token)) throw new ApiError(404, 'NOT_FOUND', 'Share not found');
    const hash = await hashToken(token);
    const row = await c.env.DB.prepare(`SELECT payload_json FROM shares
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(hash, Date.now()).first<{ payload_json: string }>();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Share not found');
    return c.json({ share: JSON.parse(row.payload_json) as PublicShare });
  });
}

export function registerShareRoutes(api: Hono<AppEnv>): void {
  api.get('/lists/:listId/shares', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    return c.json({ shares: await listShares(c.env.DB, c.get('ownerId'), list.id) });
  });

  api.post('/lists/:listId/shares', async (c) => {
    const list = await requireList(c.env.DB, c.get('ownerId'), c.req.param('listId'));
    if (list.kind !== 'collection') throw new ApiError(400, 'WRONG_LIST_KIND', 'Only ranked collections can be shared');
    const input = await readJson(c.req.raw, shareInput);
    const items = await listItems(c.env.DB, c.get('ownerId'), list.id);
    const now = Date.now();
    const snapshot = shareSnapshot(list, items, input.limit, now);
    if (!snapshot.entries.length) throw new ApiError(400, 'EMPTY_RANKING', 'Rank something before sharing this list');
    const token = createShareToken();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    const id = crypto.randomUUID();
    await c.env.DB.prepare(`INSERT INTO shares
      (id, list_id, owner_id, token_hash, title, payload_json, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, list.id, c.get('ownerId'), await hashToken(token),
      `${input.limit === 'all' ? 'Ranked list' : `Top ${input.limit}`} · ${list.name}`,
      JSON.stringify(snapshot), now, expiresAt).run();
    return c.json({ id, token, share: snapshot, expiresAt }, 201);
  });

  api.delete('/shares/:shareId', async (c) => {
    const result = await c.env.DB.prepare(`UPDATE shares SET revoked_at = ?
      WHERE id = ? AND owner_id = ? AND revoked_at IS NULL`)
      .bind(Date.now(), c.req.param('shareId'), c.get('ownerId')).run();
    if (result.meta.changes === 0) throw new ApiError(404, 'NOT_FOUND', 'Active share not found');
    return c.body(null, 204);
  });
}

