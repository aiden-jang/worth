// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { getPlatformProxy } from 'wrangler';

test('Meh migration preserves calls, ranks, related logs, and photo bytes', async () => {
  const platform = await getPlatformProxy<Env>({ persist: false, remoteBindings: false });
  const db = platform.env.DB;
  async function migrate(file: string) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    for (const statement of sql
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)) {
      await db.prepare(statement).run();
    }
  }
  try {
    for (const file of [
      '0001_initial.sql',
      '0002_photo_storage.sql',
      '0003_item_decisions.sql',
      '0004_list_photos.sql',
    ])
      await migrate(file);
    await db
      .prepare(
        "INSERT INTO lists (id, owner_id, name, kind, ranked_ids, rank_revision, created_at, updated_at) VALUES ('list', 'owner', 'Drinks', 'collection', '[\"favorite\",\"no\"]', 7, 1, 1)",
      )
      .run();
    for (const [id, decision] of [
      ['favorite', 'favorite'],
      ['no', 'would_not_again'],
      ['empty', null],
    ]) {
      await db
        .prepare(
          'INSERT INTO items (id, list_id, owner_id, title, decision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, 'list', 'owner', id, decision, 1, 1)
        .run();
    }
    await db
      .prepare(
        "INSERT INTO logs (id, list_id, item_id, owner_id, title, happened_on, created_at, updated_at) VALUES ('log', 'list', 'favorite', 'owner', 'Revisit', '2026-10-01', 1, 1)",
      )
      .run();
    await db.prepare("INSERT INTO item_photos VALUES ('favorite', 'owner', 'image/png', X'010203', 1)").run();
    await db.prepare("INSERT INTO log_photos VALUES ('log', 'owner', 'image/png', X'040506', 1)").run();
    await db.prepare("INSERT INTO list_photos VALUES ('list', 'owner', 'image/png', X'070809', 1)").run();
    await migrate('0005_meh_decision.sql');
    expect((await db.prepare('SELECT id, decision FROM items ORDER BY id').all()).results).toEqual([
      { id: 'empty', decision: null },
      { id: 'favorite', decision: 'favorite' },
      { id: 'no', decision: 'would_not_again' },
    ]);
    expect(await db.prepare('SELECT ranked_ids, rank_revision FROM lists').first()).toEqual({
      ranked_ids: '["favorite","no"]',
      rank_revision: 7,
    });
    expect(await db.prepare('SELECT item_id FROM logs').first()).toEqual({ item_id: 'favorite' });
    for (const [table, bytes] of [
      ['item_photos', '010203'],
      ['log_photos', '040506'],
      ['list_photos', '070809'],
    ]) {
      expect(await db.prepare(`SELECT hex(data) AS bytes FROM ${table}`).first()).toEqual({ bytes });
    }
    await db.prepare("UPDATE items SET decision = 'meh' WHERE id = 'empty'").run();
    expect(await db.prepare("SELECT decision FROM items WHERE id = 'empty'").first()).toEqual({
      decision: 'meh',
    });
    await expect(
      db.prepare("UPDATE items SET decision = 'maybe' WHERE id = 'empty'").run(),
    ).rejects.toThrow();
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  } finally {
    await platform.dispose();
  }
}, 30000);
