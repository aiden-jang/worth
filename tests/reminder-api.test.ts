// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { ApiError } from '../worker/data';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { registerMemoryRoutes } from '../worker/routes/memories';
import type { AppEnv } from '../worker/context';
import type { MemoryPage } from '../src/shared/memories';

let db: DatabaseSync;
let app: Hono<AppEnv>;
let env: Env;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE active_lists(id TEXT, owner_id TEXT, name TEXT, kind TEXT, archived INTEGER);
    CREATE TABLE active_items(id TEXT, list_id TEXT, owner_id TEXT, title TEXT, note TEXT, created_at INTEGER, type TEXT, context_json TEXT, decision TEXT, want_to_try INTEGER);
    CREATE TABLE active_logs(id TEXT, list_id TEXT, item_id TEXT, owner_id TEXT, title TEXT, happened_on TEXT, note TEXT, context_json TEXT, created_at INTEGER);
    CREATE TABLE record_items(id TEXT, owner_id TEXT, merged_into_id TEXT);
    CREATE TABLE item_photos(item_id TEXT);
    CREATE TABLE log_photos(log_id TEXT);
    CREATE TABLE inbox_photos(inbox_id TEXT, owner_id TEXT, removed_at INTEGER, data BLOB);
    CREATE TABLE inbox_entries(id TEXT, owner_id TEXT, payload_json TEXT, created_at INTEGER, trashed_at INTEGER);
    INSERT INTO active_lists VALUES ('a','alice','Drinks','collection',0),('b','bob','Other','collection',0),('g','alice','Gym','activity',0),('archived','alice','Older','collection',1);
    INSERT INTO active_items VALUES ('favorite','a','alice','Old favorite','Keep note',1735689600000,'Drink','{}','favorite',0),('wanted','a','alice','Waiting','',1735689600000,'Drink','{}',NULL,1),('foreign','b','bob','Private','',1735689600000,'Drink','{}','favorite',1),('hidden','archived','alice','Archived','',1735689600000,'Drink','{}','favorite',1);
    INSERT INTO record_items VALUES ('favorite','alice',NULL),('wanted','alice',NULL);
    INSERT INTO active_logs VALUES ('visit','a','favorite','alice','','2026-11-10','An actual experience','{"reaction":"meh"}',1),('workout','g',NULL,'alice','Bench press','2026-11-10','','{}',2);
  `);
  const inbox = db.prepare('INSERT INTO inbox_entries VALUES(?,?,?,?,?)');
  inbox.run(
    'unfiled',
    'alice',
    JSON.stringify({
      title: 'An unfiled plan',
      type: 'Book',
      note: '',
      decision: null,
      wantToTry: true,
      context: {},
    }),
    1,
    null,
  );
  inbox.run(
    'unfiled-visit',
    'alice',
    JSON.stringify({
      title: 'An unfiled experience',
      type: '',
      note: '',
      decision: null,
      wantToTry: false,
      context: {},
      memory: { happenedOn: '2026-11-09', reaction: 'favorite' },
    }),
    1,
    null,
  );
  type Statement = { sql: string; args: (string | number | null)[] };
  env = {
    DB: {
      prepare: (sql: string) => ({ bind: (...args: Statement['args']) => ({ sql, args }) }),
      batch: async (statements: Statement[]) =>
        statements.map(({ sql, args }) => ({ results: db.prepare(sql).all(...args) })),
    },
  } as unknown as Env;
  app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('ownerId', c.req.header('X-Test-Owner') ?? 'alice');
    await next();
  });
  app.onError((error, c) =>
    c.json(
      { message: error.message },
      (error instanceof ApiError ? error.status : 500) as ContentfulStatusCode,
    ),
  );
  registerMemoryRoutes(app);
});
afterEach(() => db.close());

async function read(query: string, owner = 'alice') {
  const response = await app.request('/memories?' + query, { headers: { 'X-Test-Owner': owner } }, env);
  expect(response.status).toBe(200);
  return response.json() as Promise<MemoryPage>;
}

test('reminder filters run through the production SQL and retain owner and archive scope', async () => {
  const wanted = await read('mode=saved&want=1');
  expect(wanted.records.map((record) => record.id).sort()).toEqual(['unfiled', 'wanted']);
  expect(wanted.records.every((record) => record.wantToTry)).toBe(true);
  expect((await read('mode=saved&call=favorite&want=0')).records.map((record) => record.id)).toEqual([
    'favorite',
  ]);
  expect((await read('mode=saved&want=1', 'bob')).records.map((record) => record.id)).toEqual(['foreign']);
  expect((await read('mode=saved&want=1&archived=1')).records).toHaveLength(3);
});

test('recent reminder sources exclude activities and respect explicit date boundaries', async () => {
  const recent = await read('experiences=1&from=2026-11-01&to=2026-11-11');
  expect(recent.records.map((record) => record.id)).toEqual(['visit', 'unfiled-visit']);
  expect(recent.records[0]).toMatchObject({ title: 'Old favorite', reaction: 'meh', wantToTry: false });
  expect((await read('experiences=1&from=2026-11-11')).total).toBe(0);
});

test('exact reminder refreshes do not switch to another item or another account', async () => {
  expect((await read('mode=saved&id=favorite&call=favorite')).records[0]?.id).toBe('favorite');
  expect((await read('mode=saved&id=favorite', 'bob')).total).toBe(0);
  db.prepare('UPDATE active_items SET decision=? WHERE id=?').run('meh', 'favorite');
  expect((await read('mode=saved&id=favorite&call=favorite')).total).toBe(0);
  expect((await read('mode=saved&id=foreign')).total).toBe(0);
  const invalid = await app.request('/memories?want=2', undefined, env);
  expect(invalid.status).toBe(400);
});

test('choice search matches recorded types, brands and labels while preserving literal text and ownership', async () => {
  const context = JSON.stringify({
    labels: ['rainy day'],
    fields: [{ name: 'Brand', value: 'Harbor' }],
  });
  db.prepare('UPDATE active_items SET type=?,context_json=?,note=?').run(
    'Illustrated book',
    context,
    '100% calm_ reading',
  );
  for (const word of ['illustrated', 'Harb', 'rainy']) {
    const result = await read(`mode=saved&q=${word}`);
    expect(result.records.map((record) => record.id).sort()).toEqual(['favorite', 'wanted']);
    expect(result.records.find((record) => record.id === 'favorite')?.reaction).toBe('favorite');
    expect((await read(`mode=saved&q=${word}`, 'bob')).records.map((record) => record.id)).toEqual([
      'foreign',
    ]);
  }
  db.prepare('UPDATE inbox_entries SET payload_json=? WHERE id=?').run(
    JSON.stringify({
      title: 'Daily moisturizer',
      type: 'Skincare',
      note: 'Light',
      wantToTry: true,
      context: { labels: ['unscented'] },
    }),
    'unfiled',
  );
  expect((await read('mode=saved&q=unscented&want=1&list=inbox')).records.map((record) => record.id)).toEqual(
    ['unfiled'],
  );
  expect((await read('mode=saved&q=skin')).records.map((record) => record.id)).toEqual(['unfiled']);
  expect((await read('mode=saved&q=%25')).total).toBe(2);
  expect((await read('mode=saved&q=%5F')).total).toBe(2);
  expect((await read('mode=saved&q=missing%25')).total).toBe(0);
  expect((await read('mode=saved&q=%27%20OR%201%3D1')).total).toBe(0);
});

test('picks use explicit overall calls and plans, excluding neutral, negative, archived and visit-only evidence', async () => {
  db.exec(`INSERT INTO active_items VALUES
    ('neutral','a','alice','Neutral plan','',1,'Book','{}','meh',1),
    ('negative','a','alice','Negative plan','',1,'Book','{}','would_not_again',1),
    ('uncalled','a','alice','A name only','',1,'Book','{}',NULL,0)`);
  const mixed = await read('mode=saved&pick=all');
  expect(mixed.total).toBe(3);
  expect(mixed.nextOffset).toBeNull();
  expect(mixed.records.map((record) => record.id).sort()).toEqual(['favorite', 'unfiled', 'wanted']);
  expect((await read('mode=saved&pick=again')).records.map((record) => record.id)).toEqual(['favorite']);
  expect((await read('mode=saved&pick=try')).records.map((record) => record.id).sort()).toEqual([
    'unfiled',
    'wanted',
  ]);
  expect((await read('mode=saved&pick=all&q=Neutral')).total).toBe(0);
  expect((await read('mode=saved&q=Neutral')).total).toBe(1);
  db.prepare('UPDATE active_items SET decision=? WHERE id=?').run('would_not_again', 'favorite');
  expect((await read('mode=saved&pick=again')).total).toBe(0);
  expect((await read('mode=saved&pick=all', 'bob')).records.map((record) => record.id)).toEqual(['foreign']);
});

test('picks search recorded descriptions literally and return only the requested source', async () => {
  db.prepare('UPDATE active_items SET note=?,type=?,context_json=? WHERE id=?').run(
    '100% calm_ reading',
    'Illustrated book',
    JSON.stringify({ labels: ['rainy day'], fields: [{ name: 'Brand', value: 'Harbor' }] }),
    'favorite',
  );
  for (const q of ['calm', 'illustrated', 'rainy', 'Harb', '%25', '%5F']) {
    const result = await read('mode=saved&pick=all&q=' + q);
    expect(result.records.map((record) => record.id)).toEqual(['favorite']);
    expect(result.total).toBe(1);
  }
  expect((await read('mode=saved&pick=all&q=%27%20OR%201%3D1')).total).toBe(0);
  expect((await read('mode=saved&pick=all&list=inbox')).records.map((record) => record.id)).toEqual([
    'unfiled',
  ]);
  expect((await read('mode=saved&pick=again&list=inbox')).total).toBe(0);
});

test('picks reach older eligible records beyond the first page and prefer unshown matches on another draw', async () => {
  db.exec('DELETE FROM inbox_entries');
  const insert = db.prepare('INSERT INTO inbox_entries VALUES(?,?,?,?,?)');
  const candidates: string[] = Array.from({ length: 6 }, () => crypto.randomUUID());
  for (const [index, id] of candidates.entries()) {
    insert.run(id, 'alice', JSON.stringify({ title: `Saved choice ${index}`, wantToTry: true }), 1, null);
  }
  for (let i = 0; i < 60; i++)
    insert.run(crypto.randomUUID(), 'alice', JSON.stringify({ title: `New name ${i}` }), 1000 + i, null);
  insert.run(crypto.randomUUID(), 'alice', JSON.stringify({ title: 'Removed plan', wantToTry: true }), 2, 1);
  insert.run(crypto.randomUUID(), 'bob', JSON.stringify({ title: 'Private plan', wantToTry: true }), 2, null);
  const before = db.prepare('SELECT * FROM inbox_entries ORDER BY id').all();
  expect(
    (await read('mode=saved&list=inbox')).records.every((record) => record.title.startsWith('New name')),
  ).toBe(true);
  const first = await read('mode=saved&pick=try&list=inbox');
  expect(first.records).toHaveLength(3);
  expect(first.total).toBe(6);
  expect(first.nextOffset).toBeNull();
  const shown = first.records.map((record) => record.id);
  expect(shown.every((id) => candidates.includes(id))).toBe(true);
  const next = await read('mode=saved&pick=try&list=inbox&exclude=' + shown.join(','));
  expect(next.total).toBe(6);
  expect(next.records).toHaveLength(3);
  expect(next.records.every((record) => !shown.includes(record.id))).toBe(true);
  expect(new Set([...shown, ...next.records.map((record) => record.id)])).toEqual(new Set(candidates));
  expect(db.prepare('SELECT * FROM inbox_entries ORDER BY id').all()).toEqual(before);
});

test('pick filters reject visit inference, archived scopes, pagination and invalid exclusion lists', async () => {
  const ids = Array.from({ length: 4 }, () => crypto.randomUUID()).join(',');
  for (const query of [
    'pick=all',
    'mode=saved&pick=unknown',
    'mode=saved&pick=all&archived=1',
    'mode=saved&pick=all&offset=1',
    'mode=saved&exclude=' + crypto.randomUUID(),
    'mode=saved&pick=all&exclude=unknown',
    'mode=saved&pick=all&exclude=' + ids,
  ]) {
    const response = await app.request('/memories?' + query, { headers: { 'X-Test-Owner': 'alice' } }, env);
    expect(response.status, query).toBe(400);
  }
});
