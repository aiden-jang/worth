// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import app from '../worker/index';

vi.mock('@aidenjang/auth-client', () => ({
  resolveSession: async (request: Request) => {
    const userId = request.headers.get('cookie')?.match(/preview_user=([a-z]+)/)?.[1];
    return userId
      ? { state: 'signed-in', user: { id: userId, email: `${userId}@example.test`, displayName: userId } }
      : { state: 'signed-out' };
  },
}));

let platform: PlatformProxy<Env>;

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({ persist: false, remoteBindings: false });
  for (const file of ['0001_initial.sql', '0002_photo_storage.sql']) {
    const migration = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    for (const statement of migration
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      await platform.env.DB.prepare(statement).run();
    }
  }
});

afterAll(async () => {
  await platform?.dispose();
});

async function call(
  path: string,
  user: string | null,
  method = 'GET',
  body?: unknown,
  origin = 'https://worth.test',
): Promise<Response> {
  return await app.request(
    `https://worth.test/api${path}`,
    {
      method,
      headers: {
        ...(user ? { Cookie: `preview_user=${user}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        Origin: origin,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    platform.env,
    platform.ctx,
  );
}

test('private records stay owner-scoped and public snapshots exclude notes', async () => {
  const unauthenticated = await call('/lists', null);
  expect(unauthenticated.status).toBe(401);
  expect(unauthenticated.headers.get('Cache-Control')).toContain('no-store');

  const createdList = await call('/lists', 'alice', 'POST', {
    name: 'Drinks',
    kind: 'collection',
    description: 'Good pours',
  });
  expect(createdList.status).toBe(201);
  const list = ((await createdList.json()) as { list: { id: string; rankRevision: number } }).list;

  const createdItem = await call(`/lists/${list.id}/items`, 'alice', 'POST', {
    title: 'Booker’s Bourbon',
    type: 'Whiskey',
    note: 'Private tasting note',
    startedOn: null,
    endedOn: null,
  });
  expect(createdItem.status).toBe(201);
  const item = ((await createdItem.json()) as { item: { id: string } }).item;

  expect((await call(`/lists/${list.id}`, 'bob')).status).toBe(404);
  expect((await call(`/items/${item.id}`, 'bob')).status).toBe(404);
  expect(((await call('/lists', 'bob').then((res) => res.json())) as { lists: unknown[] }).lists).toEqual([]);
  expect(
    (await call(`/lists/${list.id}/rank`, 'bob', 'PUT', { itemIds: [item.id], expectedRevision: 0 })).status,
  ).toBe(404);

  const ranked = await call(`/lists/${list.id}/rank`, 'alice', 'PUT', {
    itemIds: [item.id],
    expectedRevision: list.rankRevision,
  });
  expect(ranked.status).toBe(200);

  const createdShare = await call(`/lists/${list.id}/shares`, 'alice', 'POST', { limit: 5 });
  expect(createdShare.status).toBe(201);
  const { token, id, expiresAt } = (await createdShare.json()) as {
    token: string;
    id: string;
    expiresAt: number;
  };
  expect(expiresAt - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  expect(expiresAt - Date.now()).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  const publicResponse = await call(`/public/${token}`, null);
  expect(publicResponse.status).toBe(200);
  const snapshot = await publicResponse.text();
  expect(snapshot).toContain('Booker’s Bourbon');
  expect(snapshot).not.toContain('Private tasting note');
  expect(snapshot).not.toContain(item.id);

  await platform.env.DB.prepare('UPDATE shares SET expires_at = ? WHERE id = ?')
    .bind(Date.now() - 1, id)
    .run();
  expect((await call(`/public/${token}`, null)).status).toBe(404);

  expect((await call(`/shares/${id}`, 'bob', 'DELETE')).status).toBe(404);
  expect((await call(`/shares/${id}`, 'alice', 'DELETE')).status).toBe(204);
  expect((await call(`/public/${token}`, null)).status).toBe(404);

  expect((await call(`/items/${item.id}`, 'alice', 'DELETE')).status).toBe(204);
  const refreshed = await call(`/lists/${list.id}`, 'alice');
  expect(((await refreshed.json()) as { list: { rankedIds: string[] } }).list.rankedIds).toEqual([]);
});

test('cross-origin writes fail before reaching private data', async () => {
  const response = await call(
    '/lists',
    'alice',
    'POST',
    {
      name: 'Unexpected',
      kind: 'collection',
      description: '',
    },
    'https://elsewhere.test',
  );
  expect(response.status).toBe(403);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});

test('photos stay private, validate uploads, and disappear with their item', async () => {
  const createdList = await call('/lists', 'alice', 'POST', {
    name: 'Photos',
    kind: 'collection',
    description: '',
  });
  const list = ((await createdList.json()) as { list: { id: string } }).list;
  const createdItem = await call(`/lists/${list.id}/items`, 'alice', 'POST', {
    title: 'A good night',
    type: '',
    note: '',
    startedOn: null,
    endedOn: null,
  });
  const item = ((await createdItem.json()) as { item: { id: string } }).item;
  const path = `/items/${item.id}/photo`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pJ8AAAAASUVORK5CYII=',
    'base64',
  );

  async function upload(user: string, bytes: Uint8Array, contentType = 'image/png') {
    return await app.request(
      `https://worth.test/api${path}`,
      {
        method: 'PUT',
        headers: {
          Cookie: `preview_user=${user}`,
          Origin: 'https://worth.test',
          'Content-Type': contentType,
        },
        body: new Blob([new Uint8Array(bytes)], { type: contentType }),
      },
      platform.env,
      platform.ctx,
    );
  }

  expect((await upload('bob', png)).status).toBe(404);
  expect((await upload('alice', png, 'image/jpeg')).status).toBe(415);
  expect((await upload('alice', new Uint8Array(900_001))).status).toBe(413);
  expect((await upload('alice', png)).status).toBe(200);

  const ownerPhoto = await call(path, 'alice');
  expect(ownerPhoto.status).toBe(200);
  expect(ownerPhoto.headers.get('Content-Type')).toBe('image/png');
  expect(Buffer.from(await ownerPhoto.arrayBuffer())).toEqual(png);
  expect((await call(path, 'bob')).status).toBe(404);
  expect((await call(path, null)).status).toBe(401);

  const itemResponse = await call(`/items/${item.id}`, 'alice');
  expect(((await itemResponse.json()) as { item: { hasPhoto: boolean } }).item.hasPhoto).toBe(true);

  expect((await call(`/items/${item.id}`, 'alice', 'DELETE')).status).toBe(204);
  expect((await call(path, 'alice')).status).toBe(404);
  const row = await platform.env.DB.prepare('SELECT item_id FROM item_photos WHERE item_id = ?')
    .bind(item.id)
    .first();
  expect(row).toBeNull();
});

test('activity logs can be found, edited, and removed without crossing accounts', async () => {
  const createdList = await call('/lists', 'alice', 'POST', {
    name: 'Runs',
    kind: 'activity',
    description: '',
  });
  const list = ((await createdList.json()) as { list: { id: string } }).list;
  const createdLog = await call(`/lists/${list.id}/logs`, 'alice', 'POST', {
    itemId: null,
    title: 'Evening run',
    happenedOn: '2026-09-30',
    note: 'Private pace notes',
    amount: 5.2,
    unit: 'mi',
    sets: null,
    reps: null,
  });
  expect(createdLog.status).toBe(201);
  const log = ((await createdLog.json()) as { log: { id: string } }).log;
  expect((await call(`/lists/${list.id}/logs`, 'bob')).status).toBe(404);
  expect((await call(`/logs/${log.id}`, 'bob', 'PATCH', { title: 'Changed' })).status).toBe(404);

  const results = (await (await call('/search?q=Evening', 'alice')).json()) as {
    results: { id: string; title: string }[];
  };
  expect(results.results).toContainEqual(expect.objectContaining({ id: log.id, title: 'Evening run' }));
  const overview = (await (await call('/overview', 'alice')).json()) as {
    lastTimes: { title: string }[];
  };
  expect(overview.lastTimes).toContainEqual(expect.objectContaining({ title: 'Evening run' }));

  expect((await call(`/logs/${log.id}`, 'alice', 'PATCH', { amount: 6.1 })).status).toBe(200);
  const logs = (await (await call(`/lists/${list.id}/logs`, 'alice')).json()) as {
    logs: { id: string; amount: number }[];
  };
  expect(logs.logs).toContainEqual(expect.objectContaining({ id: log.id, amount: 6.1 }));
  expect((await call(`/logs/${log.id}`, 'alice', 'DELETE')).status).toBe(204);
  expect(await call(`/lists/${list.id}/logs`, 'alice').then((response) => response.json())).toEqual({
    logs: [],
  });
});
