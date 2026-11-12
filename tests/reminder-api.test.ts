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
