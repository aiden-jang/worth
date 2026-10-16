import type { Hono, Context } from 'hono';
import type { AppEnv } from '../context';
import { ApiError } from '../data';
import { readJson } from '../http';
import {
  widgetAuthorization,
  widgetExchange,
  widgetCallback,
  widgetLifetime,
  type WidgetDevice,
  type WidgetEntry,
  type WidgetSnapshot,
} from '../../src/shared/widgets';
import { widgetAccessToken, widgetDigest, widgetSecret } from '../widget-crypto';
type DeviceRow = {
  id: string;
  owner_id: string;
  name: string;
  platform: 'ios' | 'android';
  token_hash: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
};
type GrantRow = Omit<DeviceRow, 'token_hash' | 'revoked_at' | 'id'> & {
  device_id: string;
  challenge: string;
  scope_json: string;
  consumed_at: number | null;
};

async function publicLimit(c: Context<AppEnv>, category: string) {
  // Cloudflare supplies this address in production; local requests share a bounded test bucket.
  const address = c.req.header('CF-Connecting-IP') ?? 'local';
  const bucket = `widget-ip:${await widgetDigest(address)}`;
  const window = Math.floor(Date.now() / 60000);
  const row = await c.env.DB.prepare(
    'INSERT INTO request_limits (owner_id, category, window, hits) VALUES (?, ?, ?, 1) ON CONFLICT (owner_id, category, window) DO UPDATE SET hits = hits + 1 RETURNING hits',
  )
    .bind(bucket, category, window)
    .first<{ hits: number }>();
  if ((row?.hits ?? 0) > 30) {
    c.header('Retry-After', '60');
    throw new ApiError(429, 'RATE_LIMITED', 'Wait a minute before trying again.');
  }
  await c.env.DB.prepare('DELETE FROM request_limits WHERE window < ?')
    .bind(window - 2)
    .run();
}
async function bearerDevice(c: Context<AppEnv>, allowExpired = false): Promise<DeviceRow> {
  const header = c.req.header('Authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(header))
    throw new ApiError(401, 'WIDGET_RECONNECT', 'Reconnect the Worth companion.');
  const row = await c.env.DB.prepare(
    'SELECT * FROM widget_devices WHERE token_hash = ? AND revoked_at IS NULL',
  )
    .bind(await widgetDigest(header.slice(7)))
    .first<DeviceRow>();
  if (!row || (!allowExpired && row.expires_at <= Date.now()))
    throw new ApiError(401, 'WIDGET_RECONNECT', 'Reconnect the Worth companion.');
  return row;
}

export function registerPrivateWidgetRoutes(api: Hono<AppEnv>) {
  api.post('/widgets/authorize', async (c) => {
    const input = await readJson(c.req.raw, widgetAuthorization, 4096);
    const owner = c.get('ownerId'),
      now = Date.now();
    await c.env.DB.prepare('DELETE FROM widget_grants WHERE owner_id = ? AND expires_at <= ?')
      .bind(owner, now)
      .run();
    const code = widgetSecret(),
      id = crypto.randomUUID();
    const result = await c.env.DB.prepare(
      `INSERT INTO widget_grants
      (code_hash, device_id, owner_id, name, platform, challenge, scope_json, created_at, expires_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM widget_devices WHERE owner_id = ? AND revoked_at IS NULL AND expires_at > ?) +
        (SELECT COUNT(*) FROM widget_grants WHERE owner_id = ? AND consumed_at IS NULL AND expires_at > ?) < 10
      AND NOT EXISTS (SELECT 1 FROM json_each(?) selected WHERE NOT EXISTS (
        SELECT 1 FROM active_lists l WHERE l.id = selected.value AND l.owner_id = ? AND l.kind = 'collection'
      ))`,
    )
      .bind(
        await widgetDigest(code),
        id,
        owner,
        input.name,
        input.platform,
        input.challenge,
        JSON.stringify(input.collectionIds),
        now,
        now + 5 * 60000,
        owner,
        now,
        owner,
        now,
        JSON.stringify(input.collectionIds),
        owner,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        'WIDGET_SCOPE_CHANGED',
        'Choose available collections and keep up to ten widget connections or pending requests.',
      );
    const callback = new URL(widgetCallback);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', input.state);
    return c.json({ callback: callback.href, requestId: id, expiresAt: now + 5 * 60000 }, 201);
  });
  api.get('/widgets/devices', async (c) => {
    const owner = c.get('ownerId');
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM widget_devices WHERE owner_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
    )
      .bind(owner, Date.now())
      .all<DeviceRow>();
    const devices: WidgetDevice[] = await Promise.all(
      results.map(async (row) => {
        const scopes = await c.env.DB.prepare(
          `SELECT l.id, l.name FROM widget_scopes s JOIN active_lists l ON l.id = s.list_id
        WHERE s.device_id = ? AND l.owner_id = ? ORDER BY l.name`,
        )
          .bind(row.id, owner)
          .all<{ id: string; name: string }>();
        return {
          id: row.id,
          name: row.name,
          platform: row.platform,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          collections: scopes.results,
        };
      }),
    );
    const pending = await c.env.DB.prepare(
      'SELECT * FROM widget_grants WHERE owner_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC',
    )
      .bind(owner, Date.now())
      .all<GrantRow>();
    const requests: WidgetDevice[] = await Promise.all(
      pending.results.map(async (row) => {
        const scopes = await c.env.DB.prepare(
          'SELECT id, name FROM active_lists WHERE owner_id = ? AND id IN (SELECT value FROM json_each(?)) ORDER BY name',
        )
          .bind(owner, row.scope_json)
          .all<{ id: string; name: string }>();
        return {
          id: row.device_id,
          name: row.name,
          platform: row.platform,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          collections: scopes.results,
        };
      }),
    );
    return c.json({ devices, requests });
  });
  api.delete('/widgets/devices/:id', async (c) => {
    const id = c.req.param('id'),
      owner = c.get('ownerId');
    const row = await c.env.DB.prepare(
      'SELECT id FROM widget_devices WHERE id = ? AND owner_id = ? UNION ALL SELECT device_id AS id FROM widget_grants WHERE device_id = ? AND owner_id = ? LIMIT 1',
    )
      .bind(id, owner, id, owner)
      .first();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Connection not found.');
    await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE widget_devices SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ? AND owner_id = ?',
      ).bind(Date.now(), id, owner),
      c.env.DB.prepare('DELETE FROM widget_grants WHERE device_id = ? AND owner_id = ?').bind(id, owner),
    ]);
    return c.body(null, 204);
  });
}

export function registerPublicWidgetRoutes(api: Hono<AppEnv>) {
  api.post('/widgets/token', async (c) => {
    await publicLimit(c, 'widget-exchange');
    const input = await readJson(c.req.raw, widgetExchange, 2048);
    const codeHash = await widgetDigest(input.code),
      challenge = await widgetDigest(input.verifier),
      now = Date.now();
    const grant = await c.env.DB.prepare(
      'SELECT * FROM widget_grants WHERE code_hash = ? AND challenge = ? AND expires_at > ?',
    )
      .bind(codeHash, challenge, now)
      .first<GrantRow>();
    if (!grant)
      throw new ApiError(401, 'WIDGET_GRANT_EXPIRED', 'Start a fresh connection from the Worth companion.');
    const accessToken = await widgetAccessToken(input.code, input.verifier),
      tokenHash = await widgetDigest(accessToken);
    const existing = await c.env.DB.prepare('SELECT * FROM widget_devices WHERE id = ?')
      .bind(grant.device_id)
      .first<DeviceRow>();
    if (
      existing &&
      (existing.owner_id !== grant.owner_id ||
        existing.revoked_at !== null ||
        existing.expires_at <= now ||
        existing.token_hash !== tokenHash)
    )
      throw new ApiError(401, 'WIDGET_RECONNECT', 'Start a fresh connection.');
    if (!existing) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO widget_devices (id, owner_id, name, platform, token_hash, created_at, expires_at)
          SELECT device_id, owner_id, name, platform, ?, created_at, created_at + ? FROM widget_grants g
          WHERE code_hash = ? AND challenge = ? AND expires_at > ? AND consumed_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM widget_devices d WHERE d.id = g.device_id)
          AND (SELECT COUNT(*) FROM widget_devices d WHERE d.owner_id = g.owner_id AND d.revoked_at IS NULL AND d.expires_at > ?) < 10
          AND NOT EXISTS (SELECT 1 FROM json_each(g.scope_json) selected WHERE NOT EXISTS (
            SELECT 1 FROM active_lists l WHERE l.id = selected.value AND l.owner_id = g.owner_id AND l.kind = 'collection'
          ))`,
        ).bind(tokenHash, widgetLifetime, codeHash, challenge, now, now),
        c.env.DB.prepare(
          `INSERT INTO widget_scopes (device_id, list_id)
          SELECT g.device_id, selected.value FROM widget_grants g, json_each(g.scope_json) selected
          WHERE g.code_hash = ? AND EXISTS (SELECT 1 FROM widget_devices d WHERE d.id = g.device_id AND d.owner_id = g.owner_id AND d.token_hash = ? AND d.revoked_at IS NULL)
          ON CONFLICT (device_id, list_id) DO NOTHING`,
        ).bind(codeHash, tokenHash),
        c.env.DB.prepare(
          `UPDATE widget_grants SET consumed_at = ? WHERE code_hash = ? AND consumed_at IS NULL
          AND EXISTS (SELECT 1 FROM widget_devices d WHERE d.id = widget_grants.device_id AND d.owner_id = widget_grants.owner_id AND d.token_hash = ? AND d.revoked_at IS NULL)`,
        ).bind(now, codeHash, tokenHash),
      ]);
    }
    const device = await c.env.DB.prepare(
      'SELECT * FROM widget_devices WHERE id = ? AND owner_id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at > ?',
    )
      .bind(grant.device_id, grant.owner_id, tokenHash, now)
      .first<DeviceRow>();
    if (!device)
      throw new ApiError(
        409,
        'WIDGET_SCOPE_CHANGED',
        'Collections or connections changed. Start a fresh connection.',
      );
    return c.json({ accessToken, deviceId: device.id, expiresAt: device.expires_at, name: device.name });
  });
  api.get('/widgets/snapshot', async (c) => {
    await publicLimit(c, 'widget-read');
    const device = await bearerDevice(c);
    const find = c.req.query('find') ?? 'all';
    const filters = {
      all: '',
      want: 'AND i.want_to_try = 1',
      queue: 'AND i.revisit_queued = 1',
      favorites: "AND i.decision = 'favorite'",
    };
    if (!(find in filters) || !Object.hasOwn(filters, find))
      throw new ApiError(400, 'INVALID_QUERY', 'Choose a saved-find filter.');
    const lists = await c.env.DB.prepare(
      `SELECT l.id, l.name FROM widget_scopes s JOIN active_lists l ON l.id = s.list_id
      WHERE s.device_id = ? AND l.owner_id = ? AND l.kind = 'collection' ORDER BY l.name`,
    )
      .bind(device.id, device.owner_id)
      .all<{ id: string; name: string }>();
    const collections: WidgetSnapshot['collections'] = await Promise.all(
      lists.results.map(async (list) => {
        const [ranked, pick] = await Promise.all([
          c.env.DB.prepare(
            `SELECT i.id, i.title, i.type, CAST(r.key AS INTEGER) + 1 AS rank
          FROM active_lists l, json_each(l.ranked_ids) r JOIN active_items i ON i.id = r.value
          WHERE l.id = ? AND l.owner_id = ? AND i.list_id = l.id AND i.owner_id = l.owner_id
          ORDER BY CAST(r.key AS INTEGER) LIMIT 5`,
          )
            .bind(list.id, device.owner_id)
            .all<WidgetEntry & { rank: number }>(),
          c.env.DB.prepare(
            `SELECT i.id, i.title, i.type FROM active_items i WHERE i.list_id = ? AND i.owner_id = ? ${filters[find as keyof typeof filters]} ORDER BY random() LIMIT 1`,
          )
            .bind(list.id, device.owner_id)
            .first<WidgetEntry>(),
        ]);
        return { ...list, ranked: ranked.results, find: pick };
      }),
    );
    return c.json({
      schemaVersion: 1,
      updatedAt: Date.now(),
      expiresAt: device.expires_at,
      collections,
    } satisfies WidgetSnapshot);
  });
  api.delete('/widgets/connection', async (c) => {
    await publicLimit(c, 'widget-revoke');
    const device = await bearerDevice(c, true);
    await c.env.DB.prepare('UPDATE widget_devices SET revoked_at = ? WHERE id = ? AND token_hash = ?')
      .bind(Date.now(), device.id, device.token_hash)
      .run();
    return c.body(null, 204);
  });
}
