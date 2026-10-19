// @vitest-environment node
import { receiptInput, emptyReceipt, receiptLineSuggestions, receiptDigest } from '../src/shared/receipts';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import app from '../worker/index';
import type {
  Item,
  ListDetail,
  ListSummary,
  Log,
  WorkoutRoutine,
  WorkoutSession,
} from '../src/shared/models';
import { archiveFile, type ArchiveFile } from '../src/shared/portability';
import { itemInput } from '../src/shared/validation';
import type { InboxEntry } from '../src/shared/inbox';
import { itemContext } from '../src/shared/item-context';
import { emptyCollectionShelf } from '../src/shared/workspace';

vi.mock('@aidenjang/auth-client', () => ({
  resolveSession: async (request: Request) => {
    const userId = request.headers.get('cookie')?.match(/preview_user=([a-z]+)/)?.[1];
    return userId
      ? { state: 'signed-in', user: { id: userId, email: `${userId}@example.test`, displayName: userId } }
      : { state: 'signed-out' };
  },
}));

// Real D1 operations need more headroom than the default 5s component-test budget.
vi.setConfig({ testTimeout: 30_000 });

let platform: PlatformProxy<Env>;

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({ persist: false, remoteBindings: false });
  for (const file of [
    '0001_initial.sql',
    '0002_photo_storage.sql',
    '0003_item_decisions.sql',
    '0004_list_photos.sql',
    '0005_meh_decision.sql',
    '0006_personal_tools.sql',
    '0007_workout_sessions.sql',
    '0008_workout_routines.sql',
    '0009_product_flow.sql',
    '0010_completion.sql',
    '0011_archive_tools.sql',
    '0012_collection_workspace.sql',
    '0013_item_context.sql',
    '0014_collection_archiving.sql',
    '0015_visit_context.sql',
    '0016_collection_templates.sql',
    '0017_capture_inbox.sql',
    '0018_taste_history.sql',
    '0019_record_connections.sql',
    '0020_photo_galleries.sql',
    '0021_cover_revisions.sql',
    '0022_memory_boards.sql',
    '0023_receipts.sql',
    '0024_activity_plans.sql',
  ]) {
    if (file === '0009_product_flow.sql') {
      await platform.env.DB.prepare(
        "INSERT INTO lists (id, owner_id, name, kind, created_at, updated_at) VALUES ('pre-flow', 'migration', 'Old gym', 'activity', 1, 1)",
      ).run();
      await platform.env.DB.prepare(
        "INSERT INTO workout_sessions (id, list_id, owner_id, title, happened_on, planned_exercises, created_at, updated_at) VALUES ('old-visit', 'pre-flow', 'migration', 'Earlier visit', '2026-10-01', '[\"Row\"]', 1, 1)",
      ).run();
    }
    if (file === '0020_photo_galleries.sql') {
      const db = platform.env.DB;
      await db
        .prepare(
          "INSERT INTO lists(id,owner_id,name,kind,created_at,updated_at) VALUES(?,?,'Earlier photos','collection',1,1)",
        )
        .bind('a1111111-1111-4111-8111-111111111111', 'gallerymigration')
        .run();
      for (const [itemId, trashed] of [
        ['a2222222-2222-4222-8222-222222222222', null],
        ['a4444444-4444-4444-8444-444444444444', 1],
      ]) {
        await db
          .prepare(
            "INSERT INTO items(id,list_id,owner_id,title,trashed_at,created_at,updated_at) VALUES(?,'a1111111-1111-4111-8111-111111111111','gallerymigration','Earlier find',?,1,1)",
          )
          .bind(itemId, trashed)
          .run();
        await db
          .prepare(
            "INSERT INTO item_photos(item_id,owner_id,content_type,data,updated_at) VALUES(?,'gallerymigration','image/png',?,1)",
          )
          .bind(itemId, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
          .run();
      }
      await db
        .prepare(
          "INSERT INTO logs(id,list_id,item_id,owner_id,happened_on,created_at,updated_at) VALUES('a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222','gallerymigration','2026-10-01',1,1)",
        )
        .run();
      await db
        .prepare(
          "INSERT INTO log_photos(log_id,owner_id,content_type,data,updated_at) VALUES('a3333333-3333-4333-8333-333333333333','gallerymigration','image/png',?,1)",
        )
        .bind(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
        .run();
    }
    const migration = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    for (const statement of migration
      .split(migration.includes('-- statement\n') ? '-- statement\n' : ';')
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

async function archiveAction(listId: string, owner: string, body: unknown, key = crypto.randomUUID()) {
  return app.request(
    `https://worth.test/api/lists/${listId}/actions`,
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
    platform.env,
    platform.ctx,
  );
}

async function archiveCollection(owner: string, name: string) {
  const response = await call('/lists', owner, 'POST', { name, kind: 'collection' });
  expect(response.status).toBe(201);
  return ((await response.json()) as { list: ListDetail }).list;
}

async function archiveItem(owner: string, listId: string, title: string, extra = {}) {
  const response = await call(`/lists/${listId}/items`, owner, 'POST', { title, ...extra });
  expect(response.status).toBe(201);
  return ((await response.json()) as { item: Item }).item;
}

test('private context is owner scoped, safe to retry and preserved by merges, search and restore', async () => {
  const owner = 'contextowner';
  const list = await archiveCollection(owner, 'Keepsakes');
  const context = itemContext.parse({
    sourceUrl: 'https://example.test/edition',
    recommendedBy: 'Mina',
    whySaved: 'Pistachio expedition',
    followUp: 'Tell them about it',
    labels: ['small luxury'],
    stamps: ['worth the detour'],
    fields: [{ name: 'Edition', value: 'Second' }],
    purchase: { boughtOn: '2026-10-01', price: 0, currency: 'USD', returnBy: '2026-11-01', status: 'using' },
    loan: { direction: 'lent', person: 'Sam', returnBy: '2026-12-01' },
  });
  const item = await archiveItem(owner, list.id, 'A small find', {
    context,
    decision: 'meh',
    wantToTry: true,
  });
  expect(item.context).toEqual(context);
  expect(item.contextRevision).toBe(0);
  const next = { ...context, followUp: 'Told them. Worth it.' };
  const changed = await call(`/items/${item.id}`, owner, 'PATCH', {
    context: next,
    expectedContextRevision: 0,
  });
  expect(changed.status).toBe(200);
  expect(((await changed.json()) as { item: Item }).item.contextRevision).toBe(1);
  expect(
    (await call(`/items/${item.id}`, owner, 'PATCH', { context: next, expectedContextRevision: 0 })).status,
  ).toBe(200);
  expect(
    (
      await call(`/items/${item.id}`, owner, 'PATCH', {
        context: { ...context, whySaved: 'Stale edit' },
        expectedContextRevision: 0,
        note: 'Must not overwrite',
      })
    ).status,
  ).toBe(409);
  const same = ((await (await call(`/items/${item.id}`, owner)).json()) as { item: Item }).item;
  expect(same.context).toEqual(next);
  expect(same.note).toBe('');
  expect(
    (await call(`/items/${item.id}`, owner, 'PATCH', { context: {}, expectedContextRevision: 1 })).status,
  ).toBe(200);
  expect(
    (await call(`/items/${item.id}`, owner, 'PATCH', { context: {}, expectedContextRevision: 1 })).status,
  ).toBe(200);
  expect(
    (await call(`/items/${item.id}`, owner, 'PATCH', { context: next, expectedContextRevision: 2 })).status,
  ).toBe(200);
  expect((await call(`/items/${item.id}`, 'foreigncontext')).status).toBe(404);
  expect(
    (
      await call(`/items/${item.id}`, owner, 'PATCH', {
        context: { sourceUrl: 'javascript:alert(1)' },
        expectedContextRevision: 1,
      })
    ).status,
  ).toBe(400);
  const search = (await (await call('/search?q=Pistachio', owner)).json()) as {
    results: { id: string; detail: string }[];
  };
  expect(search.results).toContainEqual(
    expect.objectContaining({ id: item.id, detail: 'Pistachio expedition' }),
  );
  expect(
    (
      await call(`/lists/${list.id}/rank`, owner, 'PUT', {
        itemIds: [item.id],
        expectedRevision: list.rankRevision,
      })
    ).status,
  ).toBe(200);
  const shared = await call(`/lists/${list.id}/shares`, owner, 'POST', { limit: 'all' });
  expect(shared.status).toBe(201);
  const token = ((await shared.json()) as { token: string }).token;
  const publicText = await (await call(`/public/${token}`, null)).text();
  for (const privateValue of ['Mina', 'Sam', 'Pistachio', 'worth the detour', 'context'])
    expect(publicText).not.toContain(privateValue);
  const root = await archiveItem(owner, list.id, 'Main find');
  expect(
    (await archiveAction(list.id, owner, { action: 'merge', itemIds: [root.id, item.id], targetId: root.id }))
      .status,
  ).toBe(200);
  const merged = ((await (await call(`/items/${root.id}/merged`, owner)).json()) as { items: Item[] }).items;
  expect(merged.find((record) => record.id === item.id)?.context).toEqual(next);
  const file = archiveFile.parse(await (await call('/export/records', owner)).json());
  expect(file.items.find((record) => record.id === item.id)?.context).toEqual(next);
  const restored = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=contextrestored',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(file),
    },
    platform.env,
    platform.ctx,
  );
  expect(restored.status).toBe(201);
  const imported = archiveFile.parse(await (await call('/export/records', 'contextrestored')).json());
  expect(imported.items.find((record) => record.title === item.title)?.context).toEqual(next);
  await call(`/items/${root.id}`, owner, 'DELETE');
  expect(archiveFile.parse(await (await call('/export/records', owner)).json()).items).toHaveLength(0);
  expect(
    ((await (await call('/search?q=Pistachio', owner)).json()) as { results: unknown[] }).results,
  ).toHaveLength(0);
});

test('saved views and context rankings enforce owners and revisions and survive backup restore', async () => {
  const owner = 'workspaceowner';
  const list = await archiveCollection(owner, 'Context orders');
  const first = await archiveItem(owner, list.id, 'A');
  const second = await archiveItem(owner, list.id, 'B');
  const foreign = await archiveCollection('foreignworkspace', 'Other collection');
  const foreignItem = await archiveItem('foreignworkspace', foreign.id, 'Foreign');
  const workspace = {
    duplicateReviews: [{ id: crypto.randomUUID(), itemIds: [first.id, second.id] }],
    shelf: {
      ...emptyCollectionShelf,
      bookend: 'plant' as const,
      dedication: 'For rainy Sundays',
      keepsakeId: first.id,
      inscription: { itemId: second.id, text: 'The beginning of this shelf.' },
      paperCreature: true,
    },
    rankings: [{ id: crypto.randomUUID(), name: 'Best value', itemIds: [second.id, first.id] }],
    views: [
      {
        id: crypto.randomUUID(),
        name: 'New things',
        filters: {
          label: '',
          stamp: '',
          browse: 'want',
          search: '',
          type: 'all',
          rankFilter: 'all',
          decisionFilter: 'all',
          sort: 'name',
          addedSince: '',
          addedBefore: '',
          visits: 'all',
        },
      },
    ],
  };
  expect((await call(`/lists/${list.id}/workspace`, 'foreignworkspace')).status).toBe(404);
  expect(
    (await call(`/lists/${list.id}/workspace`, owner, 'PUT', { workspace, expectedRevision: 0 })).status,
  ).toBe(200);
  expect(
    (await call(`/lists/${list.id}/workspace`, owner, 'PUT', { workspace, expectedRevision: 0 })).status,
  ).toBe(409);
  const injected = { ...workspace, rankings: [{ ...workspace.rankings[0], itemIds: [foreignItem.id] }] };
  expect(
    (await call(`/lists/${list.id}/workspace`, owner, 'PUT', { workspace: injected, expectedRevision: 1 }))
      .status,
  ).toBe(409);
  for (const shelf of [
    { ...workspace.shelf, keepsakeId: foreignItem.id },
    { ...workspace.shelf, inscription: { itemId: foreignItem.id, text: 'Foreign' } },
  ])
    expect(
      (
        await call(`/lists/${list.id}/workspace`, owner, 'PUT', {
          workspace: { ...workspace, shelf },
          expectedRevision: 1,
        })
      ).status,
    ).toBe(409);
  expect(
    (
      await call(`/lists/${list.id}/workspace`, owner, 'PUT', {
        workspace: {
          ...workspace,
          duplicateReviews: [{ id: crypto.randomUUID(), itemIds: [first.id, foreignItem.id] }],
        },
        expectedRevision: 1,
      })
    ).status,
  ).toBe(409);
  const saved = await (await call(`/lists/${list.id}/workspace`, owner)).json();
  expect(saved).toEqual({ workspace, revision: 1 });
  const exported = archiveFile.parse(await (await call('/export/records', owner)).json());
  expect(exported.lists[0].workspace).toEqual(workspace);
  const restored = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=workspacerestored',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(exported),
    },
    platform.env,
    platform.ctx,
  );
  expect(restored.status).toBe(201);
  const restoredId = ((await restored.json()) as { ids: string[] }).ids[0];
  const importedItems = (
    (await (await call(`/lists/${restoredId}/items`, 'workspacerestored')).json()) as { items: Item[] }
  ).items;
  const imported = (
    (await (await call(`/lists/${restoredId}/workspace`, 'workspacerestored')).json()) as {
      workspace: typeof workspace;
    }
  ).workspace;
  expect(imported.rankings[0].itemIds).toEqual(
    ['B', 'A'].map((title) => importedItems.find((item) => item.title === title)!.id),
  );
  expect(imported.views[0].filters).toEqual(workspace.views[0].filters);
  expect(imported.duplicateReviews[0].id).not.toBe(workspace.duplicateReviews[0].id);
  expect(imported.duplicateReviews[0].itemIds).toEqual(
    ['A', 'B'].map((title) => importedItems.find((item) => item.title === title)!.id),
  );
  expect(imported.shelf).toEqual({
    ...workspace.shelf,
    keepsakeId: importedItems.find((item) => item.title === 'A')!.id,
    inscription: {
      ...workspace.shelf.inscription,
      itemId: importedItems.find((item) => item.title === 'B')!.id,
    },
  });
  expect((await call(`/lists/${list.id}`, owner)).status).toBe(200);
  await call(`/items/${second.id}`, owner, 'DELETE');
  const hidden = (
    (await (await call(`/lists/${list.id}/workspace`, owner)).json()) as { workspace: typeof workspace }
  ).workspace;
  expect(hidden.rankings[0].itemIds).toEqual([first.id]);
  expect(hidden.shelf.keepsakeId).toBe(first.id);
  expect(hidden.shelf.inscription).toBeNull();
  expect(hidden.duplicateReviews).toEqual([]);
  expect(
    archiveFile.parse(await (await call('/export/records', owner)).json()).lists[0].workspace.rankings[0]
      .itemIds,
  ).toEqual([first.id]);
  expect(
    ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list.rankedIds,
  ).toEqual([]);
  expect(
    ((await (await call(`/items/${first.id}`, owner)).json()) as { item: Item }).item.decision,
  ).toBeNull();
  await call(`/items/${first.id}`, owner, 'DELETE');
  expect(
    ((await (await call(`/lists/${list.id}/workspace`, owner)).json()) as { workspace: typeof workspace })
      .workspace.shelf.keepsakeId,
  ).toBeNull();
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'item', id: first.id }] })).status,
  ).toBe(200);
  expect(
    ((await (await call(`/lists/${list.id}/workspace`, owner)).json()) as { workspace: typeof workspace })
      .workspace.shelf.keepsakeId,
  ).toBe(first.id);
  await call(`/lists/${list.id}`, owner, 'DELETE');
  expect((await call(`/lists/${list.id}/workspace`, owner)).status).toBe(404);
});

test('Want to try is independent of calls, ranks and the revisit queue, including batch capture', async () => {
  const owner = 'wantowner';
  const list = await archiveCollection(owner, 'Future coffee');
  const item = await archiveItem(owner, list.id, 'Next coffee', {
    wantToTry: true,
    decision: 'meh',
    revisitQueued: true,
  });
  expect(item).toMatchObject({ wantToTry: true, decision: 'meh', revisitQueued: true });
  await call(`/lists/${list.id}/rank`, owner, 'PUT', {
    itemIds: [item.id],
    expectedRevision: list.rankRevision,
  });
  const changed = await call(`/items/${item.id}`, owner, 'PATCH', { wantToTry: false });
  expect(((await changed.json()) as { item: Item }).item).toMatchObject({
    wantToTry: false,
    decision: 'meh',
    revisitQueued: true,
  });
  expect(
    ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list.rankedIds,
  ).toEqual([item.id]);
  const batch = await call(`/lists/${list.id}/items/batch`, owner, 'POST', {
    titles: ['Later', 'Eventually'],
    wantToTry: true,
  });
  expect(batch.status).toBe(201);
  expect(
    ((await batch.json()) as { items: Item[] }).items.every((i) => i.wantToTry && i.decision === null),
  ).toBe(true);
});

test('Trash hides records everywhere and restores photos, history and parent relationships', async () => {
  const owner = 'trashowner';
  const list = await archiveCollection(owner, 'Hidden archive');
  const item = await archiveItem(owner, list.id, 'Recoverable item', {
    note: 'Private memory',
    decision: 'favorite',
  });
  await call(`/lists/${list.id}/rank`, owner, 'PUT', {
    itemIds: [item.id],
    expectedRevision: list.rankRevision,
  });
  const log = (
    (await (
      await call(`/lists/${list.id}/logs`, owner, 'POST', {
        itemId: item.id,
        happenedOn: '2026-10-10',
        note: 'First visit',
      })
    ).json()) as { log: { id: string } }
  ).log;
  expect((await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), 0)).status).toBe(200);
  expect((await call(`/items/${item.id}`, owner, 'DELETE')).status).toBe(204);
  for (const path of [`/items/${item.id}`, `/items/${item.id}/photo`, `/logs/${log.id}`])
    expect((await call(path, owner)).status).toBe(404);
  expect(((await (await call(`/lists/${list.id}/logs`, owner)).json()) as { logs: unknown[] }).logs).toEqual(
    [],
  );
  expect(JSON.stringify(await (await call('/search?q=Recoverable', owner)).json())).not.toContain(item.id);
  const exported = (await (await call('/export/records', owner)).json()) as ArchiveFile;
  expect(exported.items).toEqual([]);
  expect(exported.logs).toEqual([]);
  const trashBackup = await call('/export/backup', owner);
  expect(trashBackup.status).toBe(200);
  expect(((await trashBackup.json()) as ArchiveFile).photos).toEqual([]);
  expect(
    (await call('/trash/restore', 'intruder', 'POST', { entries: [{ kind: 'item', id: item.id }] })).status,
  ).toBe(404);
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'item', id: item.id }] })).status,
  ).toBe(200);
  expect((await call(`/items/${item.id}/photo`, owner)).status).toBe(200);
  expect(
    ((await (await call(`/lists/${list.id}/items`, owner)).json()) as { items: Item[] }).items[0],
  ).toMatchObject({ id: item.id, note: 'Private memory', logCount: 1 });
  expect(
    ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list.rankedIds,
  ).toEqual([]);
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'item', id: item.id }] })).status,
  ).toBe(200);
  const ranked = ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list;
  await call(`/lists/${list.id}/rank`, owner, 'PUT', {
    itemIds: [item.id],
    expectedRevision: ranked.rankRevision,
  });
  const share = (await (await call(`/lists/${list.id}/shares`, owner, 'POST', { limit: 'all' })).json()) as {
    token: string;
  };
  await call(`/lists/${list.id}`, owner, 'DELETE');
  expect((await call(`/items/${item.id}`, owner)).status).toBe(404);
  expect((await call(`/public/${share.token}`, null)).status).toBe(404);
  await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'list', id: list.id }] });
  expect((await call(`/public/${share.token}`, null)).status).toBe(404);
  expect(
    ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list.rankedIds,
  ).toEqual([item.id]);
});

test('bulk moves and merges preserve originals, photos, visits, exports and retry safety', async () => {
  const owner = 'mergeowner';
  const list = await archiveCollection(owner, 'Before');
  const destination = await archiveCollection(owner, 'After');
  const main = await archiveItem(owner, list.id, 'Coffee', { decision: 'favorite', note: 'Main note' });
  const source = await archiveItem(owner, list.id, 'COFFEE', {
    decision: 'meh',
    note: 'Original note',
    wantToTry: true,
  });
  const photo = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  for (const item of [main, source])
    expect(
      (await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), 0, new Uint8Array(photo))).status,
    ).toBe(200);
  await call(`/lists/${list.id}/logs`, owner, 'POST', {
    itemId: source.id,
    happenedOn: '2026-10-10',
    note: 'Original visit',
  });
  await call(`/lists/${list.id}/rank`, owner, 'PUT', {
    itemIds: [source.id, main.id],
    expectedRevision: list.rankRevision,
  });
  const key = crypto.randomUUID();
  const merge = { action: 'merge', itemIds: [main.id, source.id], targetId: main.id };
  expect((await archiveAction(list.id, owner, merge, key)).status).toBe(200);
  expect((await archiveAction(list.id, owner, merge, key)).status).toBe(200);
  expect((await archiveAction(list.id, owner, { ...merge, targetId: source.id }, key)).status).toBe(409);
  const merged = ((await (await call(`/lists/${list.id}/items`, owner)).json()) as { items: Item[] }).items;
  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({
    id: main.id,
    note: 'Main note',
    decision: 'favorite',
    logCount: 1,
    mergedIds: [source.id],
  });
  const foundOriginal = await call('/search?q=Original', owner);
  expect(foundOriginal.status).toBe(200);
  expect(JSON.stringify(await foundOriginal.json())).toContain(main.id);
  expect((await call(`/items/${source.id}`, owner)).status).toBe(404);
  expect((await call(`/items/${source.id}/photo`, owner)).status).toBe(200);
  expect((await call(`/items/${source.id}/photo`, 'intruder')).status).toBe(404);
  expect(
    ((await (await call(`/items/${main.id}/merged`, owner)).json()) as { items: Item[] }).items[0],
  ).toMatchObject({ id: source.id, note: 'Original note', decision: 'meh', wantToTry: true });
  const moveKey = crypto.randomUUID();
  const move = { action: 'move', itemIds: [main.id], destinationId: destination.id };
  expect((await archiveAction(list.id, owner, move, moveKey)).status).toBe(200);
  expect((await archiveAction(list.id, owner, move, moveKey)).status).toBe(200);
  const backupResponse = await call('/export/backup', owner);
  expect(backupResponse.status).toBe(200);
  const backup = (await backupResponse.json()) as ArchiveFile;
  expect(archiveFile.safeParse(backup).success).toBe(true);
  expect(backup.items).toHaveLength(2);
  expect(backup.photos).toHaveLength(2);
  expect(backup.items.find((i) => i.id === source.id)).toMatchObject({
    mergedIntoId: main.id,
    listId: destination.id,
  });
  expect(backup.logs[0]).toMatchObject({ itemId: source.id, listId: destination.id, note: 'Original visit' });
  const restored = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=importmerge',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(backup),
    },
    platform.env,
    platform.ctx,
  );
  expect(restored.status).toBe(201);
  const imported = (await (await call('/export/records', 'importmerge')).json()) as ArchiveFile;
  expect(imported.items.filter((i) => i.mergedIntoId)).toHaveLength(1);
  expect((await call(`/items/${main.id}/separate/${source.id}`, owner, 'POST', {})).status).toBe(200);
  expect((await call(`/items/${main.id}/separate/${source.id}`, owner, 'POST', {})).status).toBe(200);
  expect(
    ((await (await call(`/lists/${destination.id}/items`, owner)).json()) as { items: Item[] }).items,
  ).toHaveLength(2);
  expect(((await (await call(`/items/${source.id}`, owner)).json()) as { item: Item }).item.logCount).toBe(1);
});

test('bulk operations reject foreign items and destinations without partial writes', async () => {
  const list = await archiveCollection('bulkowner', 'Mine');
  const item = await archiveItem('bulkowner', list.id, 'Keep me');
  const foreign = await archiveCollection('foreignowner', 'Other');
  const theirs = await archiveItem('foreignowner', foreign.id, 'Not mine');
  expect(
    (await archiveAction(list.id, 'bulkowner', { action: 'trash', itemIds: [item.id, theirs.id] })).status,
  ).toBe(404);
  expect((await call(`/items/${item.id}`, 'bulkowner')).status).toBe(200);
  expect(
    (
      await archiveAction(list.id, 'bulkowner', {
        action: 'move',
        itemIds: [item.id],
        destinationId: foreign.id,
      })
    ).status,
  ).toBe(404);
  expect(
    (await archiveAction(list.id, 'foreignowner', { action: 'queue', itemIds: [item.id], value: true }))
      .status,
  ).toBe(404);
  expect(
    ((await (await call(`/items/${item.id}`, 'bulkowner')).json()) as { item: Item }).item.revisitQueued,
  ).toBe(false);
});

test('100-item Trash and Undo stay atomic and expired records cannot be restored', async () => {
  const owner = 'hundredowner';
  const list = await archiveCollection(owner, 'Hundred');
  const ids = Array.from({ length: 100 }, () => crypto.randomUUID());
  await platform.env.DB.prepare(
    "INSERT INTO items (id, list_id, owner_id, title, created_at, updated_at) SELECT value, ?, ?, 'A record', 1, 1 FROM json_each(?)",
  )
    .bind(list.id, owner, JSON.stringify(ids))
    .run();
  expect((await archiveAction(list.id, owner, { action: 'trash', itemIds: ids })).status).toBe(200);
  expect(((await (await call(`/lists/${list.id}/items`, owner)).json()) as { items: Item[] }).items).toEqual(
    [],
  );
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: ids.map((id) => ({ kind: 'item', id })) }))
      .status,
  ).toBe(200);
  expect(
    ((await (await call(`/lists/${list.id}/items`, owner)).json()) as { items: Item[] }).items,
  ).toHaveLength(100);
  await platform.env.DB.prepare('UPDATE items SET trashed_at = ? WHERE id = ?')
    .bind(Date.now() - 31 * 86400000, ids[0])
    .run();
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'item', id: ids[0] }] })).status,
  ).toBe(410);
  await call('/trash', owner);
  expect(await platform.env.DB.prepare('SELECT id FROM items WHERE id = ?').bind(ids[0]).first()).toBeNull();
});

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
    decision: 'favorite',
    startedOn: null,
    endedOn: null,
  });
  expect(createdItem.status).toBe(201);
  const item = ((await createdItem.json()) as { item: { id: string } }).item;

  const listSearch = await call('/search?q=drinks', 'alice');
  expect(listSearch.status).toBe(200);
  expect(((await listSearch.json()) as { results: unknown[] }).results).toContainEqual(
    expect.objectContaining({ id: list.id, kind: 'list', title: 'Drinks' }),
  );

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
  const rankedOverview = (await (await call('/overview', 'alice')).json()) as {
    favorites: { itemId: string; listName: string }[];
    ranked: { itemId: string; listName: string; rank: number }[];
  };
  expect(rankedOverview.ranked).toContainEqual(
    expect.objectContaining({ itemId: item.id, listName: 'Drinks', rank: 1 }),
  );
  expect(rankedOverview.favorites).toContainEqual(
    expect.objectContaining({ itemId: item.id, listName: 'Drinks' }),
  );
  const listSummaries = (await (await call('/lists', 'alice')).json()) as {
    lists: { id: string; rankedCount: number; favoriteCount: number }[];
  };
  expect(listSummaries.lists).toContainEqual(
    expect.objectContaining({ id: list.id, rankedCount: 1, favoriteCount: 1 }),
  );

  const changedDecision = await call(`/items/${item.id}`, 'alice', 'PATCH', {
    decision: 'would_not_again',
  });
  expect(changedDecision.status).toBe(200);
  expect(((await changedDecision.json()) as { item: { decision: string | null } }).item.decision).toBe(
    'would_not_again',
  );
  const noFavorites = (await (await call('/overview', 'alice')).json()) as {
    favorites: unknown[];
    notAgain: { itemId: string; listName: string }[];
  };
  expect(noFavorites.favorites).toEqual([]);
  expect(noFavorites.notAgain).toContainEqual(
    expect.objectContaining({ itemId: item.id, listName: 'Drinks' }),
  );
  expect((await call(`/items/${item.id}`, 'alice', 'PATCH', { decision: 'maybe' })).status).toBe(400);

  const revisit = await call(`/lists/${list.id}/logs`, 'alice', 'POST', {
    itemId: item.id,
    title: '',
    happenedOn: '2026-09-28',
    note: 'The finish held up better the second time.',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
  });
  expect(revisit.status).toBe(201);
  const revisitLog = ((await revisit.json()) as { log: { id: string } }).log;
  const revisitSearch = await call('/search?q=finish', 'alice');
  expect(revisitSearch.status).toBe(200);
  expect(((await revisitSearch.json()) as { results: unknown[] }).results).toContainEqual(
    expect.objectContaining({ id: revisitLog.id, kind: 'log', title: 'Booker’s Bourbon' }),
  );
  expect(((await (await call('/search?q=finish', 'bob')).json()) as { results: unknown[] }).results).toEqual(
    [],
  );

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

test('batch capture keeps several title-only collection items together', async () => {
  const createdList = await call('/lists', 'batch-capture', 'POST', {
    name: 'Films',
    kind: 'collection',
    description: '',
  });
  const list = ((await createdList.json()) as { list: { id: string } }).list;
  const response = await call(`/lists/${list.id}/items/batch`, 'batch-capture', 'POST', {
    titles: ['Heat', 'The Third Man', 'Portrait of a Lady on Fire'],
  });
  expect(response.status).toBe(201);
  expect(
    ((await response.json()) as { items: { title: string; type: string; note: string }[] }).items,
  ).toEqual([
    expect.objectContaining({ title: 'Heat', type: '', note: '' }),
    expect.objectContaining({ title: 'The Third Man', type: '', note: '' }),
    expect.objectContaining({ title: 'Portrait of a Lady on Fire', type: '', note: '' }),
  ]);
  const overview = (await (await call('/overview', 'batch-capture')).json()) as {
    recent: { title: string; recordKind: string; itemId: string | null }[];
  };
  expect(overview.recent).toContainEqual(
    expect.objectContaining({ title: 'Heat', recordKind: 'item', itemId: expect.any(String) }),
  );

  expect(
    (
      await call(`/lists/${list.id}/items/batch`, 'batch-capture', 'POST', {
        titles: ['Heat', 'heat'],
      })
    ).status,
  ).toBe(400);

  const activity = await call('/lists', 'batch-capture', 'POST', {
    name: 'Runs',
    kind: 'activity',
    description: '',
  });
  const activityList = ((await activity.json()) as { list: { id: string } }).list;
  expect(
    (
      await call(`/lists/${activityList.id}/items/batch`, 'batch-capture', 'POST', {
        titles: ['Morning run'],
      })
    ).status,
  ).toBe(400);
});

test('patterns summarize only the signed-in owner’s archive', async () => {
  const createdList = await call('/lists', 'patterns', 'POST', {
    name: 'Places',
    kind: 'collection',
    description: '',
  });
  const list = ((await createdList.json()) as { list: { id: string; rankRevision: number } }).list;
  const createdItem = await call(`/lists/${list.id}/items`, 'patterns', 'POST', {
    title: 'Cafe Maki',
    type: 'Cafe',
    note: '',
    decision: 'favorite',
    startedOn: null,
    endedOn: null,
  });
  const item = ((await createdItem.json()) as { item: { id: string } }).item;
  expect(
    (
      await call(`/lists/${list.id}/rank`, 'patterns', 'PUT', {
        itemIds: [item.id],
        expectedRevision: list.rankRevision,
      })
    ).status,
  ).toBe(200);
  for (const happenedOn of ['2026-09-01', '2026-09-15']) {
    expect(
      (
        await call(`/lists/${list.id}/logs`, 'patterns', 'POST', {
          itemId: item.id,
          title: '',
          happenedOn,
          note: '',
          amount: null,
          unit: '',
          sets: null,
          reps: null,
        })
      ).status,
    ).toBe(201);
  }
  const newerList = await call('/lists', 'patterns', 'POST', {
    name: 'Wines',
    kind: 'collection',
    description: '',
  });
  const newer = ((await newerList.json()) as { list: { id: string } }).list;
  expect(
    (
      await call(`/lists/${list.id}`, 'patterns', 'PATCH', {
        description: 'Updated after Wines was created.',
      })
    ).status,
  ).toBe(200);

  const response = await call('/patterns', 'patterns');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(
    expect.objectContaining({
      totalRecords: 3,
      totalCollections: 2,
      totalActivities: 0,
      rankedItemCount: 1,
      revisitCount: 2,
      favoriteCount: 1,
      notAgainCount: 0,
      mostReturned: expect.objectContaining({ title: 'Cafe Maki', count: 2 }),
      newestCollection: expect.objectContaining({ id: newer.id, name: 'Wines', itemCount: 0 }),
      lastTouchedCollection: expect.objectContaining({ id: list.id, name: 'Places', itemCount: 1 }),
      mostKeptCollection: expect.objectContaining({ id: list.id, name: 'Places', itemCount: 1 }),
    }),
  );
  expect((await call('/patterns', 'someoneelse')).status).toBe(200);
  expect(
    (await (await call('/patterns', 'someoneelse')).json()) as {
      totalRecords: number;
      mostReturned: unknown;
    },
  ).toEqual(
    expect.objectContaining({
      totalRecords: 0,
      mostReturned: null,
      lastTouchedCollection: null,
      mostKeptCollection: null,
    }),
  );
});

test('record exports are owner-scoped and do not include photo binaries', async () => {
  const createdList = await call('/lists', 'exporter', 'POST', {
    name: 'Wines',
    kind: 'collection',
    description: '',
  });
  const list = ((await createdList.json()) as { list: { id: string } }).list;

  const createdItem = await call(`/lists/${list.id}/items`, 'exporter', 'POST', {
    title: 'Ridge Monte Bello',
    type: 'Cabernet',
    note: 'Save for a long dinner.',
    decision: 'favorite',
    startedOn: null,
    endedOn: null,
  });
  const item = ((await createdItem.json()) as { item: { id: string } }).item;
  const createdLog = await call(`/lists/${list.id}/logs`, 'exporter', 'POST', {
    itemId: item.id,
    title: 'Opened with friends',
    happenedOn: '2026-09-28',
    note: '',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
  });
  expect(createdLog.status).toBe(201);

  const response = await call('/export/records', 'exporter');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('content-disposition')).toMatch(
    /^attachment; filename="worth-records-\d{4}-\d{2}-\d{2}\.json"$/,
  );

  const exported = (await response.json()) as {
    schemaVersion: number;
    photosExcluded: boolean;
    lists: Array<{ id: string }>;
    items: Array<{ title: string; decision: string | null; note: string }>;
    logs: Array<{ title: string; hasPhoto: boolean }>;
  };
  expect(exported.schemaVersion).toBe(8);
  expect(exported.photosExcluded).toBe(true);
  expect(exported.lists).toEqual([expect.objectContaining({ id: list.id })]);
  expect(exported.items).toEqual([
    expect.objectContaining({
      title: 'Ridge Monte Bello',
      decision: 'favorite',
      note: 'Save for a long dinner.',
    }),
  ]);
  expect(exported.logs).toEqual([expect.objectContaining({ title: 'Opened with friends', hasPhoto: false })]);

  const otherOwner = await call('/export/records', 'someoneelse');
  const otherExport = (await otherOwner.json()) as { lists: unknown[]; items: unknown[]; logs: unknown[] };
  expect(otherExport.lists).toEqual([]);
  expect(otherExport.items).toEqual([]);
  expect(otherExport.logs).toEqual([]);
});

test('photos stay private, validate uploads, and remain recoverable in Trash', async () => {
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
  await platform.env.DB.prepare('UPDATE lists SET updated_at = 0 WHERE id = ?').bind(list.id).run();
  expect((await upload('alice', png)).status).toBe(200);
  const listAfterPhotoUpload = (await (await call(`/lists/${list.id}`, 'alice')).json()) as {
    list: { updatedAt: number };
  };
  expect(listAfterPhotoUpload.list.updatedAt).toBeGreaterThan(0);

  const ownerPhoto = await call(path, 'alice');
  expect(ownerPhoto.status).toBe(200);
  expect(ownerPhoto.headers.get('Content-Type')).toBe('image/png');
  expect(Buffer.from(await ownerPhoto.arrayBuffer())).toEqual(png);
  expect((await call(path, 'bob')).status).toBe(404);
  expect((await call(path, null)).status).toBe(401);

  const itemResponse = await call(`/items/${item.id}`, 'alice');
  expect(((await itemResponse.json()) as { item: { hasPhoto: boolean } }).item.hasPhoto).toBe(true);

  const coverPath = `/lists/${list.id}/cover`;
  async function uploadCover(user: string, bytes: Uint8Array, contentType = 'image/png') {
    return await app.request(
      `https://worth.test/api${coverPath}`,
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

  expect((await uploadCover('bob', png)).status).toBe(404);
  expect((await uploadCover('alice', png, 'image/jpeg')).status).toBe(415);
  expect((await uploadCover('alice', png)).status).toBe(200);
  const listAfterCoverUpload = (await (await call(`/lists/${list.id}`, 'alice')).json()) as {
    list: { hasCoverPhoto: boolean };
  };
  expect(listAfterCoverUpload.list.hasCoverPhoto).toBe(true);
  expect((await call(coverPath, 'bob')).status).toBe(404);
  const coverResponse = await call(coverPath, 'alice');
  expect(coverResponse.headers.get('Cache-Control')).toContain('private');
  expect(Buffer.from(await coverResponse.arrayBuffer())).toEqual(png);
  expect((await call(coverPath, 'alice', 'DELETE')).status).toBe(204);
  const listAfterCoverRemoval = (await (await call(`/lists/${list.id}`, 'alice')).json()) as {
    list: { hasCoverPhoto: boolean };
  };
  expect(listAfterCoverRemoval.list.hasCoverPhoto).toBe(false);

  expect((await call(`/items/${item.id}`, 'alice', 'DELETE')).status).toBe(204);
  expect((await call(path, 'alice')).status).toBe(404);
  const row = await platform.env.DB.prepare('SELECT item_id FROM item_photos WHERE item_id = ?')
    .bind(item.id)
    .first();
  expect(row).toMatchObject({ item_id: item.id });
  await platform.env.DB.prepare('UPDATE items SET trashed_at = ? WHERE id = ?')
    .bind(Date.now() - 31 * 86400000, item.id)
    .run();
  await call('/trash', 'alice');
  expect(
    await platform.env.DB.prepare('SELECT item_id FROM item_photos WHERE item_id = ?').bind(item.id).first(),
  ).toBeNull();
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

  const createdSecondList = await call('/lists', 'alice', 'POST', {
    name: 'Training',
    kind: 'activity',
    description: '',
  });
  const secondList = ((await createdSecondList.json()) as { list: { id: string } }).list;
  const createdSecondLog = await call(`/lists/${secondList.id}/logs`, 'alice', 'POST', {
    itemId: null,
    title: 'Evening run',
    happenedOn: '2026-10-01',
    note: '',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
  });
  const secondLog = ((await createdSecondLog.json()) as { log: { id: string } }).log;

  const results = (await (await call('/search?q=Evening', 'alice')).json()) as {
    results: { id: string; title: string }[];
  };
  expect(results.results).toContainEqual(expect.objectContaining({ id: log.id, title: 'Evening run' }));
  const noteResults = (await (await call('/search?q=pace', 'alice')).json()) as {
    results: { id: string; title: string }[];
  };
  expect(noteResults.results).toContainEqual(expect.objectContaining({ id: log.id, title: 'Evening run' }));
  const overview = (await (await call('/overview', 'alice')).json()) as {
    lastTimes: { id: string; listId: string; listName: string; title: string; happenedOn: string }[];
    recent: { id: string; itemId: string | null }[];
  };
  expect(overview.lastTimes).toContainEqual(
    expect.objectContaining({
      id: log.id,
      listId: list.id,
      listName: 'Runs',
      title: 'Evening run',
      happenedOn: '2026-09-30',
    }),
  );
  expect(overview.lastTimes).toContainEqual(
    expect.objectContaining({
      id: secondLog.id,
      listId: secondList.id,
      listName: 'Training',
      title: 'Evening run',
      happenedOn: '2026-10-01',
    }),
  );
  expect(overview.recent).toContainEqual(expect.objectContaining({ id: log.id, itemId: null }));

  await platform.env.DB.prepare('UPDATE lists SET updated_at = 0 WHERE id = ?').bind(list.id).run();
  expect((await call(`/logs/${log.id}`, 'alice', 'PATCH', { amount: 6.1 })).status).toBe(200);
  const listAfterLogUpdate = (await (await call(`/lists/${list.id}`, 'alice')).json()) as {
    list: { updatedAt: number };
  };
  expect(listAfterLogUpdate.list.updatedAt).toBeGreaterThan(0);
  const logs = (await (await call(`/lists/${list.id}/logs`, 'alice')).json()) as {
    logs: { id: string; amount: number }[];
  };
  expect(logs.logs).toContainEqual(expect.objectContaining({ id: log.id, amount: 6.1 }));
  await platform.env.DB.prepare('UPDATE lists SET updated_at = 0 WHERE id = ?').bind(list.id).run();
  expect((await call(`/logs/${log.id}`, 'alice', 'DELETE')).status).toBe(204);
  const listAfterLogDelete = (await (await call(`/lists/${list.id}`, 'alice')).json()) as {
    list: { updatedAt: number };
  };
  expect(listAfterLogDelete.list.updatedAt).toBeGreaterThan(0);
  expect(await call(`/lists/${list.id}/logs`, 'alice').then((response) => response.json())).toEqual({
    logs: [],
  });
});

test('Meh is explicit, reversible, owner-scoped, and independent of rank', async () => {
  const list = (
    (await (await call('/lists', 'neutral', 'POST', { name: 'Coffee', kind: 'collection' })).json()) as {
      list: { id: string };
    }
  ).list;
  const item = (
    (await (await call(`/lists/${list.id}/items`, 'neutral', 'POST', { title: 'Cold brew' })).json()) as {
      item: { id: string; decision: string | null };
    }
  ).item;
  expect(item.decision).toBeNull();
  expect((await call(`/items/${item.id}`, 'other', 'PATCH', { decision: 'meh' })).status).toBe(404);
  const updated = (
    (await (await call(`/items/${item.id}`, 'neutral', 'PATCH', { decision: 'meh' })).json()) as {
      item: { decision: string };
    }
  ).item;
  expect(updated.decision).toBe('meh');
  expect((await (await call(`/lists/${list.id}`, 'neutral')).json()) as unknown).toMatchObject({
    list: { rankedIds: [], rankRevision: 0 },
  });
  expect(
    (await call(`/lists/${list.id}/rank`, 'neutral', 'PUT', { itemIds: [item.id], expectedRevision: 0 }))
      .status,
  ).toBe(200);
  expect((await (await call('/overview', 'neutral')).json()) as unknown).toMatchObject({
    favorites: [],
    notAgain: [],
    recent: [expect.objectContaining({ itemId: item.id, decision: 'meh' })],
  });
  expect((await (await call('/patterns', 'neutral')).json()) as unknown).toMatchObject({
    mehCount: 1,
    favoriteCount: 0,
    notAgainCount: 0,
  });
  expect((await (await call('/export/records', 'neutral')).json()) as unknown).toMatchObject({
    items: [expect.objectContaining({ decision: 'meh' })],
  });
  const shared = (await (await call(`/lists/${list.id}/shares`, 'neutral', 'POST', { limit: 5 })).json()) as {
    share: { token: string };
    token: string;
  };
  // The existing share contract contains ranked names/types only, never calls.
  const token = shared.token ?? shared.share?.token;
  const snapshot = await call(`/public/${token}`, null);
  expect(snapshot.status).toBe(200);
  expect(JSON.stringify(await snapshot.json())).not.toContain('meh');
  expect((await call(`/items/${item.id}`, 'neutral', 'PATCH', { decision: null })).status).toBe(200);
  expect((await (await call(`/lists/${list.id}`, 'neutral')).json()) as unknown).toMatchObject({
    list: { rankedIds: [item.id], rankRevision: 1 },
  });
  expect((await (await call('/patterns', 'neutral')).json()) as unknown).toMatchObject({ mehCount: 0 });
});

test('collection artwork and exercise sets persist, patch independently, and export privately', async () => {
  const art = { object: 'snack', tone: 'clay' };
  const created = await call('/lists', 'tools', 'POST', {
    name: 'Small things',
    kind: 'collection',
    artwork: art,
  });
  expect(created.status).toBe(201);
  const { list } = (await created.json()) as { list: { id: string; artwork: unknown } };
  expect(list.artwork).toEqual(art);
  const renamed = await call(`/lists/${list.id}`, 'tools', 'PATCH', { name: 'Still small' });
  expect(((await renamed.json()) as { list: { artwork: unknown } }).list.artwork).toEqual(art);
  expect((await call(`/lists/${list.id}`, 'other', 'PATCH', { artwork: null })).status).toBe(404);
  expect(
    (await call(`/lists/${list.id}`, 'tools', 'PATCH', { artwork: { object: 'invalid', tone: 'sage' } }))
      .status,
  ).toBe(400);
  const cleared = await call(`/lists/${list.id}`, 'tools', 'PATCH', { artwork: null });
  expect(((await cleared.json()) as { list: { artwork: unknown } }).list.artwork).toBeNull();

  const gym = await call('/lists', 'tools', 'POST', { name: 'Gym', kind: 'activity' });
  const gymId = ((await gym.json()) as { list: { id: string } }).list.id;
  const exerciseSets = [
    { reps: 10, weight: 40 },
    { reps: 8, weight: 45 },
    { reps: 6, weight: null },
  ];
  const saved = await call(`/lists/${gymId}/logs`, 'tools', 'POST', {
    title: 'Bench press',
    happenedOn: '2026-10-10',
    exerciseSets,
    weightUnit: 'kg',
  });
  expect(saved.status).toBe(201);
  const { log } = (await saved.json()) as { log: { id: string; exerciseSets: unknown; weightUnit: string } };
  expect(log.exerciseSets).toEqual(exerciseSets);
  expect(log.weightUnit).toBe('kg');
  const noted = await call(`/logs/${log.id}`, 'tools', 'PATCH', { note: 'New note' });
  expect(((await noted.json()) as { log: { exerciseSets: unknown } }).log.exerciseSets).toEqual(exerciseSets);
  expect((await call(`/logs/${log.id}`, 'other', 'PATCH', { exerciseSets: [] })).status).toBe(404);
  for (const invalid of [[{ reps: -1, weight: 1 }], [{ reps: 2.5, weight: 1 }], [{ reps: 2, weight: -1 }]]) {
    expect((await call(`/logs/${log.id}`, 'tools', 'PATCH', { exerciseSets: invalid })).status).toBe(400);
  }
  const edited = await call(`/logs/${log.id}`, 'tools', 'PATCH', {
    exerciseSets: [{ reps: 12, weight: 0 }],
    weightUnit: 'lb',
  });
  expect(((await edited.json()) as { log: { exerciseSets: unknown; weightUnit: string } }).log).toMatchObject(
    { exerciseSets: [{ reps: 12, weight: 0 }], weightUnit: 'lb' },
  );
  const exported = await call('/export/records', 'tools');
  expect(exported.status).toBe(200);
  expect(((await exported.json()) as { logs: unknown[] }).logs).toContainEqual(
    expect.objectContaining({ id: log.id, exerciseSets: [{ reps: 12, weight: 0 }], weightUnit: 'lb' }),
  );
  const legacy = await call(`/lists/${gymId}/logs`, 'tools', 'POST', {
    title: 'Old style',
    happenedOn: '2026-10-10',
    sets: 3,
    reps: 8,
    amount: 50,
    unit: 'kg',
  });
  expect(((await legacy.json()) as { log: unknown }).log).toMatchObject({
    sets: 3,
    reps: 8,
    amount: 50,
    exerciseSets: [],
  });
});

test('workout visits are private, separate on the same date, and preserve exercises when ungrouped', async () => {
  const create = async (name: string, kind = 'activity') =>
    ((await (await call('/lists', 'workouts', 'POST', { name, kind })).json()) as { list: { id: string } })
      .list.id;
  const gymId = await create('Gym'),
    otherId = await create('Other gym'),
    collectionId = await create('Books', 'collection');
  expect(
    (await call(`/lists/${collectionId}/workouts`, 'workouts', 'POST', { happenedOn: '2026-10-10' })).status,
  ).toBe(400);
  expect(
    (await call(`/lists/${gymId}/workouts`, 'workouts', 'POST', { happenedOn: '2026-02-30' })).status,
  ).toBe(400);
  const makeWorkout = async (title: string) =>
    (
      (await (
        await call(`/lists/${gymId}/workouts`, 'workouts', 'POST', { title, happenedOn: '2026-10-10' })
      ).json()) as { workout: { id: string; title: string } }
    ).workout;
  const morning = await makeWorkout('Morning'),
    evening = await makeWorkout('Evening');
  expect(morning.id).not.toBe(evening.id);
  expect((await call(`/workouts/${morning.id}`, 'stranger', 'PATCH', { title: 'No' })).status).toBe(404);
  expect((await call(`/workouts/${morning.id}`, 'stranger', 'DELETE')).status).toBe(404);
  expect((await call(`/lists/${gymId}/workouts`, 'stranger')).status).toBe(404);
  const input = {
    title: 'Bench press',
    happenedOn: '2026-10-10',
    exerciseSets: [{ reps: 8, weight: 40 }],
    workoutId: morning.id,
  };
  expect((await call(`/lists/${otherId}/logs`, 'workouts', 'POST', input)).status).toBe(400);
  expect(
    (await call(`/lists/${gymId}/logs`, 'workouts', 'POST', { ...input, happenedOn: '2026-10-09' })).status,
  ).toBe(400);
  expect(
    (await call(`/lists/${gymId}/logs`, 'workouts', 'POST', { ...input, exerciseSets: [] })).status,
  ).toBe(400);
  const saved = await call(`/lists/${gymId}/logs`, 'workouts', 'POST', input);
  expect(saved.status).toBe(201);
  const { log } = (await saved.json()) as { log: { id: string; workoutId: string } };
  expect(log.workoutId).toBe(morning.id);
  const patched = await call(`/logs/${log.id}`, 'workouts', 'PATCH', { note: 'Preserve visit' });
  expect(((await patched.json()) as { log: { workoutId: string } }).log.workoutId).toBe(morning.id);
  const dated = await call(`/workouts/${morning.id}`, 'workouts', 'PATCH', {
    happenedOn: '2026-10-09',
    title: 'Push day',
  });
  expect(dated.status).toBe(200);
  const datedLogs = (
    (await (await call(`/lists/${gymId}/logs`, 'workouts')).json()) as {
      logs: { id: string; happenedOn: string }[];
    }
  ).logs;
  expect(datedLogs.find((entry) => entry.id === log.id)?.happenedOn).toBe('2026-10-09');
  const exported = (await (await call('/export/records', 'workouts')).json()) as {
    workoutSessions: unknown[];
    logs: unknown[];
  };
  expect(exported.workoutSessions).toHaveLength(2);
  expect(exported.logs).toContainEqual(expect.objectContaining({ id: log.id, workoutId: morning.id }));
  const privateExport = (await (await call('/export/records', 'stranger')).json()) as {
    workoutSessions: unknown[];
  };
  expect(privateExport.workoutSessions).toEqual([]);
  // Removing the grouping must leave the original exercise and measurements intact.
  expect((await call(`/workouts/${morning.id}`, 'workouts', 'DELETE')).status).toBe(204);
  const kept = ((await (await call(`/lists/${gymId}/logs`, 'workouts')).json()) as { logs: unknown[] }).logs;
  expect(kept).toContainEqual(
    expect.objectContaining({
      id: log.id,
      workoutId: null,
      exerciseSets: [{ reps: 8, weight: 40 }],
      happenedOn: '2026-10-09',
    }),
  );
  // Attach to another visit, then detach explicitly without changing measurements.
  expect(
    (await call(`/logs/${log.id}`, 'workouts', 'PATCH', { workoutId: evening.id, happenedOn: '2026-10-10' }))
      .status,
  ).toBe(200);
  const detached = await call(`/logs/${log.id}`, 'workouts', 'PATCH', { workoutId: null });
  expect(((await detached.json()) as { log: { workoutId: string | null } }).log.workoutId).toBeNull();
  expect((await call(`/lists/${gymId}`, 'workouts', 'DELETE')).status).toBe(204);
  expect((await call(`/workouts/${evening.id}`, 'workouts', 'PATCH', { title: 'Gone' })).status).toBe(404);
});

test('routines start blank visits, snapshot ordered names, and remain owner-scoped', async () => {
  const createList = async (name: string, kind = 'activity') =>
    ((await (await call('/lists', 'routines', 'POST', { name, kind })).json()) as { list: { id: string } })
      .list.id;
  const gym = await createList('Routine gym'),
    other = await createList('Other gym'),
    collection = await createList('Drinks', 'collection');
  const input = { title: 'Push day', exercises: ['Bench press', 'Shoulder press'] };
  expect((await call(`/lists/${collection}/routines`, 'routines', 'POST', input)).status).toBe(400);
  expect((await call(`/lists/${gym}/routines`, 'routines', 'POST', { ...input, exercises: [] })).status).toBe(
    400,
  );
  expect(
    (
      await call(`/lists/${gym}/routines`, 'routines', 'POST', {
        ...input,
        exercises: ['Bench press', ' BENCH  press '],
      })
    ).status,
  ).toBe(400);
  const created = await call(`/lists/${gym}/routines`, 'routines', 'POST', input);
  expect(created.status).toBe(201);
  const { routine } = (await created.json()) as { routine: { id: string; exercises: string[] } };
  expect(routine.exercises).toEqual(input.exercises);
  expect((await call(`/lists/${gym}/routines`, 'stranger')).status).toBe(404);
  expect((await call(`/routines/${routine.id}`, 'stranger', 'PUT', input)).status).toBe(404);
  expect((await call(`/routines/${routine.id}`, 'stranger', 'DELETE')).status).toBe(404);
  const start = { routineId: routine.id, happenedOn: '2026-10-10' };
  expect((await call(`/lists/${other}/workouts`, 'routines', 'POST', start)).status).toBe(400);
  const first = await call(`/lists/${gym}/workouts`, 'routines', 'POST', start);
  expect(first.status).toBe(201);
  const { workout } = (await first.json()) as {
    workout: { id: string; title: string; plannedExercises: string[] };
  };
  expect(workout.title).toBe(input.title);
  expect(workout.plannedExercises).toEqual(input.exercises);
  expect(((await (await call(`/lists/${gym}/logs`, 'routines')).json()) as { logs: unknown[] }).logs).toEqual(
    [],
  );
  const updated = { title: 'Upper body', exercises: ['Shoulder press', 'Bench press', 'Triceps extension'] };
  expect((await call(`/routines/${routine.id}`, 'routines', 'PUT', updated)).status).toBe(200);
  const next = (await (await call(`/lists/${gym}/workouts`, 'routines', 'POST', start)).json()) as {
    workout: { id: string; plannedExercises: string[] };
  };
  expect(next.workout.id).not.toBe(workout.id);
  expect(next.workout.plannedExercises).toEqual(updated.exercises);
  const visits = (await (await call(`/lists/${gym}/workouts`, 'routines')).json()) as {
    workouts: { id: string; plannedExercises: string[] }[];
  };
  expect(visits.workouts.find((w) => w.id === workout.id)?.plannedExercises).toEqual(input.exercises);
  const exported = (await (await call('/export/records', 'routines')).json()) as {
    workoutRoutines: unknown[];
    workoutSessions: unknown[];
  };
  expect(exported.workoutRoutines).toContainEqual(expect.objectContaining({ id: routine.id, ...updated }));
  expect(exported.workoutSessions).toContainEqual(
    expect.objectContaining({ id: workout.id, plannedExercises: input.exercises }),
  );
  const privateExport = (await (await call('/export/records', 'stranger')).json()) as {
    workoutRoutines: unknown[];
  };
  expect(privateExport.workoutRoutines).toEqual([]);
  expect((await call(`/routines/${routine.id}`, 'routines', 'DELETE')).status).toBe(204);
  expect((await call(`/lists/${gym}/workouts`, 'routines', 'POST', start)).status).toBe(404);
  expect(
    ((await (await call(`/lists/${gym}/workouts`, 'routines')).json()) as { workouts: unknown[] }).workouts,
  ).toHaveLength(2);
  const saved = (await (await call(`/lists/${gym}/routines`, 'routines', 'POST', input)).json()) as {
    routine: { id: string };
  };
  await call(`/lists/${gym}`, 'routines', 'DELETE');
  expect((await call(`/routines/${saved.routine.id}`, 'routines', 'PUT', input)).status).toBe(404);
});

const productRequest = call;
type ProductTestBody = {
  list: import('../src/shared/models').ListDetail;
  item: import('../src/shared/models').Item;
  workout: import('../src/shared/models').WorkoutSession;
  log: import('../src/shared/models').Log;
  logs: import('../src/shared/models').Log[];
  items: import('../src/shared/models').Item[];
  workoutSessions: import('../src/shared/models').WorkoutSession[];
  results: import('../src/shared/models').SearchResult[];
};
test('product flow preserves queue independence, workout plans, recovery keys and private search context', async () => {
  const call = (...args: Parameters<typeof productRequest>) =>
    productRequest(...args) as Promise<Omit<Response, 'json'> & { json: () => Promise<ProductTestBody> }>;
  const collection = (
    await (await call('/lists', 'alice', 'POST', { name: 'Coffee notes', kind: 'collection' })).json()
  ).list;
  const created = (
    await (
      await call(`/lists/${collection.id}/items`, 'alice', 'POST', {
        title: 'Cold brew',
        decision: 'meh',
        note: 'Citrus finish',
      })
    ).json()
  ).item;
  const queued = (
    await (await call(`/items/${created.id}`, 'alice', 'PATCH', { revisitQueued: true })).json()
  ).item;
  expect(queued).toMatchObject({ decision: 'meh', revisitQueued: true });
  expect((await (await call(`/lists/${collection.id}`, 'alice')).json()).list.rankedIds).toEqual([]);
  expect((await call(`/items/${created.id}`, 'bob', 'PATCH', { revisitQueued: false })).status).toBe(404);
  const search = (await (await call('/search?q=Citrus', 'alice')).json()).results;
  expect(search.find((result: { id: string }) => result.id === created.id)?.detail).toContain(
    'Citrus finish',
  );
  expect((await (await call('/search?q=Citrus', 'bob')).json()).results).toEqual([]);
  const gym = (await (await call('/lists', 'alice', 'POST', { name: 'Gym flow', kind: 'activity' })).json())
    .list;
  const visit = (
    await (
      await call(`/lists/${gym.id}/workouts`, 'alice', 'POST', { title: 'Today', happenedOn: '2026-10-10' })
    ).json()
  ).workout;
  expect(visit.status).toBe('active');
  const planned = (
    await (
      await call(`/workouts/${visit.id}`, 'alice', 'PATCH', {
        plannedExercises: ['Row', 'Press'],
        skippedExercises: ['Press'],
      })
    ).json()
  ).workout;
  expect(planned.skippedExercises).toEqual(['Press']);
  expect(
    (await call(`/workouts/${visit.id}`, 'alice', 'PATCH', { skippedExercises: ['Not in plan'] })).status,
  ).toBe(400);
  const swapped = (
    await (
      await call(`/workouts/${visit.id}`, 'alice', 'PATCH', { plannedExercises: ['Pull-up', 'Row'] })
    ).json()
  ).workout;
  expect(swapped.skippedExercises).toEqual([]);
  const key = crypto.randomUUID();
  const capture = () =>
    app.request(
      `https://worth.test/api/lists/${gym.id}/logs`,
      {
        method: 'POST',
        headers: {
          Cookie: 'preview_user=alice',
          Origin: 'https://worth.test',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          title: 'Row',
          workoutId: visit.id,
          happenedOn: '2026-10-10',
          note: 'Cable machine',
          exerciseSets: [{ reps: 8, weight: 0 }],
          weightUnit: 'kg',
        }),
      },
      platform.env,
      platform.ctx,
    );
  const first = ((await (await capture()).json()) as { log: import('../src/shared/models').Log }).log;
  const retry = ((await (await capture()).json()) as { log: import('../src/shared/models').Log }).log;
  expect(retry.id).toBe(first.id);
  expect((await (await call(`/lists/${gym.id}/logs`, 'alice')).json()).logs).toHaveLength(1);
  expect(
    (await (await call('/search?q=Cable', 'alice')).json()).results.find(
      (result: { id: string }) => result.id === first.id,
    ),
  ).toMatchObject({ exercise: true });
  expect((await call(`/workouts/${visit.id}`, 'bob', 'PATCH', { status: 'finished' })).status).toBe(404);
  const recap = (await (await call(`/workouts/${visit.id}`, 'alice', 'PATCH', { status: 'finished' })).json())
    .workout;
  expect(recap.status).toBe('finished');
  const exported = await (await call('/export/records', 'alice')).json();
  expect(exported.items.find((item: { id: string }) => item.id === created.id)?.revisitQueued).toBe(true);
  expect(exported.workoutSessions.find((workout: { id: string }) => workout.id === visit.id)).toMatchObject({
    status: 'finished',
    plannedExercises: ['Pull-up', 'Row'],
  });
});

test('product migration preserves earlier visits without marking all history active', async () => {
  const response = await call('/lists/pre-flow/workouts', 'migration');
  const value = (await response.json()) as { workouts: import('../src/shared/models').WorkoutSession[] };
  expect(value.workouts).toHaveLength(1);
  expect(value.workouts[0]).toMatchObject({
    title: 'Earlier visit',
    status: 'finished',
    plannedExercises: ['Row'],
    skippedExercises: [],
  });
});

test('backup restores relationships and photos privately, and all-data deletion is owner scoped', async () => {
  const owner = 'portable';
  const collection = (
    (await (await call('/lists', owner, 'POST', { name: 'Archive cup', kind: 'collection' })).json()) as {
      list: ListDetail;
    }
  ).list;
  const item = (
    (await (
      await call(`/lists/${collection.id}/items`, owner, 'POST', {
        title: 'Coffee',
        decision: 'meh',
        revisitQueued: true,
        note: 'Keep this note',
      })
    ).json()) as { item: Item }
  ).item;
  await call(`/lists/${collection.id}/rank`, owner, 'PUT', { itemIds: [item.id], expectedRevision: 0 });
  await call(`/lists/${collection.id}/logs`, owner, 'POST', {
    itemId: item.id,
    happenedOn: '2026-10-10',
    note: 'Second cup',
  });
  const activity = (
    (await (await call('/lists', owner, 'POST', { name: 'Gym', kind: 'activity' })).json()) as {
      list: ListDetail;
    }
  ).list;
  const routine = (
    (await (
      await call(`/lists/${activity.id}/routines`, owner, 'POST', { title: 'A', exercises: ['Row'] })
    ).json()) as { routine: WorkoutRoutine }
  ).routine;
  const workout = (
    (await (
      await call(`/lists/${activity.id}/workouts`, owner, 'POST', {
        title: 'Visit',
        happenedOn: '2026-10-10',
        routineId: routine.id,
      })
    ).json()) as { workout: WorkoutSession }
  ).workout;
  await call(`/lists/${activity.id}/logs`, owner, 'POST', {
    title: 'Row',
    happenedOn: '2026-10-10',
    workoutId: workout.id,
    exerciseSets: [{ reps: 8, weight: 40 }],
    weightUnit: 'lb',
  });
  const photo = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  expect(
    (await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), 0, new Uint8Array(photo))).status,
  ).toBe(200);
  const backupResponse = await call('/export/backup', owner);
  expect(backupResponse.status).toBe(200);
  const backup = (await backupResponse.json()) as ArchiveFile;
  expect(backup.photosExcluded).toBe(false);
  expect(backup.photos[0].data).toBe(photo.toString('base64'));
  const key = crypto.randomUUID();
  const restore = (body = backup, user = 'recipient') =>
    app.request(
      'https://worth.test/api/import',
      {
        method: 'POST',
        headers: {
          Cookie: `preview_user=${user}`,
          Origin: 'https://worth.test',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(body),
      },
      platform.env,
      platform.ctx,
    );
  const first = await restore();
  expect(first.status).toBe(201);
  const result = (await first.json()) as { ids: string[] };
  expect(result.ids).toHaveLength(2);
  expect((await restore()).status).toBe(201);
  const restored = (await (await call('/export/records', 'recipient')).json()) as ArchiveFile;
  expect(restored.lists).toHaveLength(2);
  expect(restored.items[0].decision).toBe('meh');
  expect(restored.items[0].revisitQueued).toBe(true);
  expect(restored.items[0].note).toBe('Keep this note');
  expect(restored.lists.find((l) => l.kind === 'collection')?.rankedIds).toEqual([restored.items[0].id]);
  expect(restored.logs.find((g) => g.title === 'Row')?.workoutId).toBe(restored.workoutSessions[0].id);
  expect(restored.logs.find((g) => g.title === 'Row')?.exerciseSets).toEqual([{ reps: 8, weight: 40 }]);
  expect((restored.items[0] as (typeof restored.items)[number] & { hasPhoto: boolean }).hasPhoto).toBe(true);
  expect(
    (await restore({ ...backup, items: [{ ...backup.items[0], listId: crypto.randomUUID() }] }, 'invalid'))
      .status,
  ).toBe(400);
  expect((await restore(backup, 'someone')).status).toBe(409);
  expect((await call('/data', 'recipient', 'DELETE')).status).toBe(400);
  const deleted = await app.request(
    'https://worth.test/api/data',
    {
      method: 'DELETE',
      headers: {
        Cookie: 'preview_user=recipient',
        Origin: 'https://worth.test',
        'X-Worth-Confirmation': 'delete-all-worth-data',
      },
    },
    platform.env,
    platform.ctx,
  );
  expect(deleted.status).toBe(204);
  expect(((await (await call('/lists', 'recipient')).json()) as { lists: ListSummary[] }).lists).toHaveLength(
    0,
  );
  expect(((await (await call('/lists', owner)).json()) as { lists: ListSummary[] }).lists).toHaveLength(2);
  expect(
    await platform.env.DB.prepare('SELECT COUNT(*) AS n FROM item_photos WHERE owner_id = ?')
      .bind('recipient')
      .first('n'),
  ).toBe(0);
  expect(
    await platform.env.DB.prepare('SELECT COUNT(*) AS n FROM capture_operations WHERE owner_id = ?')
      .bind('recipient')
      .first('n'),
  ).toBe(0);
});

test('batch retry keys are atomic and reject changed payloads', async () => {
  const owner = 'batches';
  const list = (
    (await (await call('/lists', owner, 'POST', { name: 'Batch', kind: 'collection' })).json()) as {
      list: ListDetail;
    }
  ).list;
  const key = crypto.randomUUID();
  const create = (titles = ['One', 'Two']) =>
    app.request(
      `https://worth.test/api/lists/${list.id}/items/batch`,
      {
        method: 'POST',
        headers: {
          Cookie: `preview_user=${owner}`,
          Origin: 'https://worth.test',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({ titles }),
      },
      platform.env,
      platform.ctx,
    );
  const [a, b] = await Promise.all([create(), create()]);
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  expect(((await a.json()) as { items: Item[] }).items.map((i) => i.id)).toEqual(
    ((await b.json()) as { items: Item[] }).items.map((i) => i.id),
  );
  expect((await create(['Changed'])).status).toBe(409);
  expect(
    ((await (await call(`/lists/${list.id}/items`, owner)).json()) as { items: Item[] }).items,
  ).toHaveLength(2);
});

test('authenticated write limits return retry information', async () => {
  const window = Math.floor(Date.now() / 60000);
  await platform.env.DB.prepare('INSERT INTO request_limits (owner_id,category,window,hits) VALUES (?,?,?,?)')
    .bind('limited', 'write', window, 120)
    .run();
  const r = await call('/lists', 'limited', 'POST', { name: 'No', kind: 'collection' });
  expect(r.status).toBe(429);
  expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(0);
  expect((await call('/lists', 'limited')).status).toBe(200);
});

test('restore validates photos before commit and batches a large archive without changing text', async () => {
  const listId = crypto.randomUUID();
  const file = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [
      { id: listId, name: 'Restored', kind: 'collection', description: '', rankedIds: [], updatedAt: 1 },
    ],
    items: Array.from({ length: 400 }, (_, n) => ({
      id: crypto.randomUUID(),
      listId,
      title: `Item ${n}`,
      type: '',
      note: '  ' + 'n'.repeat(3990) + '\n',
      createdAt: 1,
      updatedAt: 1,
    })),
    logs: [],
  };
  const send = (body: unknown, user: string) =>
    app.request(
      'https://worth.test/api/import',
      {
        method: 'POST',
        headers: {
          Cookie: `preview_user=${user}`,
          Origin: 'https://worth.test',
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      },
      platform.env,
      platform.ctx,
    );
  const invalid = await send(
    {
      ...file,
      photosExcluded: false,
      photos: [
        {
          kind: 'item',
          id: file.items[0].id,
          contentType: 'image/png',
          data: Buffer.from('not a photo').toString('base64'),
        },
      ],
    },
    'invalidphoto',
  );
  expect(invalid.status).toBe(415);
  expect(
    ((await (await call('/lists', 'invalidphoto')).json()) as { lists: ListSummary[] }).lists,
  ).toHaveLength(0);
  const response = await send(file, 'largerestore');
  expect(response.status).toBe(201);
  const restored = (await (await call('/export/records', 'largerestore')).json()) as ArchiveFile;
  expect(restored.items).toHaveLength(400);
  expect(restored.items[0].note).toBe(file.items[0].note);
  expect(restored.lists).toHaveLength(1);
});

async function importReviewed(
  listId: string,
  owner: string,
  body: unknown,
  key = crypto.randomUUID(),
  env = platform.env,
) {
  return app.request(
    `https://worth.test/api/lists/${listId}/items/import`,
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
    env,
    platform.ctx,
  );
}
test('reviewed captures preserve private fields and ranks and bind retries to the exact payload', async () => {
  const owner = 'csvowner';
  const list = await archiveCollection(owner, 'Imported finds');
  const existing = await archiveItem(owner, list.id, 'Existing', { decision: 'favorite' });
  await call(`/lists/${list.id}/rank`, owner, 'PUT', {
    itemIds: [existing.id],
    expectedRevision: list.rankRevision,
  });
  const key = crypto.randomUUID();
  const body = {
    items: [
      {
        title: 'A "quoted" find',
        type: 'Drink',
        note: 'First\nSecond',
        decision: 'meh',
        wantToTry: true,
        context: { sourceUrl: 'https://example.test/a?private=keep' },
        startedOn: '2026-10-01',
      },
      { title: 'The ordinary one', decision: 'would_not_again' },
    ],
  };
  const response = await importReviewed(list.id, owner, body, key);
  expect(response.status).toBe(201);
  const saved = ((await response.json()) as { items: Item[] }).items;
  expect(saved[0]).toMatchObject({
    title: 'A "quoted" find',
    note: 'First\nSecond',
    decision: 'meh',
    wantToTry: true,
    context: { sourceUrl: 'https://example.test/a?private=keep' },
    startedOn: '2026-10-01',
  });
  const retry = await importReviewed(list.id, owner, body, key);
  expect(retry.status).toBe(201);
  expect(((await retry.json()) as { items: Item[] }).items.map((item) => item.id)).toEqual(
    saved.map((item) => item.id),
  );
  expect((await importReviewed(list.id, owner, { items: [{ title: 'Changed' }] }, key)).status).toBe(409);
  expect((await importReviewed(list.id, 'csvother', body)).status).toBe(404);
  expect(
    (
      await importReviewed(list.id, owner, {
        items: [{ title: 'Invalid', context: { sourceUrl: 'javascript:alert(1)' } }],
      })
    ).status,
  ).toBe(400);
  expect(
    ((await (await call(`/lists/${list.id}/items`, owner)).json()) as { items: Item[] }).items,
  ).toHaveLength(3);
  expect(
    ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list.rankedIds,
  ).toEqual([existing.id]);
  await call(`/items/${saved[0].id}`, owner, 'DELETE');
  const changed = await importReviewed(list.id, owner, body, key);
  expect(changed.status).toBe(409);
  expect(await changed.json()).toMatchObject({ error: 'CAPTURE_RECORDS_CHANGED' });
});
test('one reviewed capture atomically supports 100 records and rejects a larger batch', async () => {
  const owner = 'csvlarge';
  const list = await archiveCollection(owner, 'Many finds');
  const body = { items: Array.from({ length: 100 }, (_, index) => ({ title: `Find ${index}` })) };
  const response = await importReviewed(list.id, owner, body);
  expect(response.status).toBe(201);
  const saved = ((await response.json()) as { items: Item[] }).items;
  expect(saved.map((item) => item.title)).toEqual(body.items.map((item) => item.title));
  expect(saved.every((item) => item.decision === null && !item.wantToTry && !item.revisitQueued)).toBe(true);
  expect((await importReviewed(list.id, owner, { items: [...body.items, { title: 'Excess' }] })).status).toBe(
    400,
  );
  const activity = await call('/lists', owner, 'POST', { name: 'Activity', kind: 'activity' });
  const activityId = ((await activity.json()) as { list: ListDetail }).list.id;
  expect((await importReviewed(activityId, owner, { items: [{ title: 'Wrong kind' }] })).status).toBe(400);
});
test('a collection trashed just before reviewed capture leaves no rows or retry receipt', async () => {
  const owner = 'csvrace';
  const list = await archiveCollection(owner, 'Concurrent deletion');
  const key = crypto.randomUUID();
  const db = platform.env.DB;
  const racingDB = new Proxy(db, {
    get(target, property) {
      if (property === 'batch')
        return async (statements: D1PreparedStatement[]) => {
          await db
            .prepare('UPDATE lists SET trashed_at = ? WHERE id = ? AND owner_id = ?')
            .bind(Date.now(), list.id, owner)
            .run();
          return db.batch(statements);
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  expect(
    (
      await importReviewed(list.id, owner, { items: [{ title: 'Never created' }] }, key, {
        ...platform.env,
        DB: racingDB,
      })
    ).status,
  ).toBe(409);
  expect(
    await platform.env.DB.prepare('SELECT id FROM items WHERE list_id = ?').bind(list.id).first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare('SELECT id FROM capture_operations WHERE id = ?').bind(key).first(),
  ).toBeNull();
});

test('archived collections leave everyday views but keep records, search, links and reversible Trash', async () => {
  const owner = 'archivist';
  const { list } = (await (
    await call('/lists', owner, 'POST', { name: 'Tucked coffee', kind: 'collection' })
  ).json()) as { list: ListDetail };
  const { item } = (await (
    await call(`/lists/${list.id}/items`, owner, 'POST', { title: 'Tucked coffee', decision: 'favorite' })
  ).json()) as { item: Item };
  await call(`/lists/${list.id}/rank`, owner, 'PUT', { itemIds: [item.id], expectedRevision: 0 });
  await call(`/lists/${list.id}/logs`, owner, 'POST', {
    itemId: item.id,
    title: item.title,
    happenedOn: '2026-10-15',
  });
  const shared = (await (
    await call(`/lists/${list.id}/shares`, owner, 'POST', {
      limit: 'all',
    })
  ).json()) as { token: string };
  expect(shared.token).toBeTruthy();
  expect((await call(`/lists/${list.id}`, 'intruder', 'PATCH', { archived: true })).status).toBe(404);
  const archived = await call(`/lists/${list.id}`, owner, 'PATCH', { archived: true });
  expect(archived.status).toBe(200);
  expect(await archived.json()).toMatchObject({ list: { archived: true, rankedIds: [item.id] } });
  expect(await (await call('/lists', owner)).json()).toMatchObject({ lists: [] });
  expect(await (await call('/lists?archived=1', owner)).json()).toMatchObject({
    lists: [{ id: list.id, archived: true }],
  });
  expect(await (await call('/lists?archived=1', 'intruder')).json()).toMatchObject({ lists: [] });
  expect((await call('/lists?archived=maybe', owner)).status).toBe(400);
  expect(await (await call('/overview', owner)).json()).toMatchObject({
    lists: [],
    recent: [],
    ranked: [],
    favorites: [],
    notAgain: [],
  });
  expect(await (await call('/patterns', owner)).json()).toMatchObject({
    totalCollections: 1,
    totalRecords: 2,
    rankedItemCount: 1,
    favoriteCount: 1,
    revisitCount: 1,
  });
  const found = (await (await call('/search?q=Tucked', owner)).json()) as {
    results: { listArchived: boolean }[];
  };
  expect(found.results.length).toBeGreaterThanOrEqual(2);
  expect(found.results.every((r) => r.listArchived)).toBe(true);
  expect(await (await call(`/lists/${list.id}/items`, owner)).json()).toMatchObject({
    items: [{ id: item.id, decision: 'favorite' }],
  });
  expect((await call(`/public/${shared.token}`, null)).status).toBe(200);
  expect(await (await call('/trash', owner)).json()).toMatchObject({ entries: [] });
  await call(`/lists/${list.id}`, owner, 'DELETE');
  expect((await call(`/lists/${list.id}`, owner, 'PATCH', { archived: false })).status).toBe(404);
  expect(await (await call('/lists?archived=1', owner)).json()).toMatchObject({ lists: [] });
  await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'list', id: list.id }] });
  expect(await (await call(`/lists/${list.id}`, owner)).json()).toMatchObject({ list: { archived: true } });
  await call(`/lists/${list.id}`, owner, 'PATCH', { archived: false });
  expect(await (await call('/lists', owner)).json()).toMatchObject({
    lists: [{ id: list.id, archived: false }],
  });
  expect((await call(`/public/${shared.token}`, null)).status).toBe(404);
});

test('backups preserve archived collections and old backups default to current', async () => {
  const owner = 'archivebackup';
  const { list } = (await (
    await call('/lists', owner, 'POST', { name: 'Old cameras', kind: 'collection' })
  ).json()) as { list: ListDetail };
  const { list: activity } = (await (
    await call('/lists', owner, 'POST', { name: 'Walks', kind: 'activity' })
  ).json()) as { list: ListDetail };
  expect((await call(`/lists/${activity.id}`, owner, 'PATCH', { archived: true })).status).toBe(400);
  await call(`/lists/${list.id}`, owner, 'PATCH', { archived: true });
  const file = archiveFile.parse(await (await call('/export/records', owner)).json());
  expect(file.lists.find((l) => l.id === list.id)?.archived).toBe(true);
  const imported = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=archiverestored',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(file),
    },
    platform.env,
    platform.ctx,
  );
  expect(imported.status).toBe(201);
  const restored = (await (await call('/lists?archived=1', 'archiverestored')).json()) as {
    lists: ListSummary[];
  };
  expect(restored.lists).toHaveLength(1);
  expect(restored.lists[0]).toMatchObject({ archived: true, name: 'Old cameras' });
  expect(restored.lists[0].id).not.toBe(list.id);
  const legacy = {
    ...file,
    lists: file.lists.map((l) => Object.fromEntries(Object.entries(l).filter(([key]) => key !== 'archived'))),
  };
  expect(archiveFile.parse(legacy).lists.every((l) => !l.archived)).toBe(true);
  expect(
    archiveFile.safeParse({ ...file, lists: file.lists.map((l) => ({ ...l, archived: true })) }).success,
  ).toBe(false);
});

test('archive-only updates do not overwrite settings changed after the initial read', async () => {
  const owner = 'archiveconcurrent';
  const { list } = (await (
    await call('/lists', owner, 'POST', { name: 'Earlier name', kind: 'collection' })
  ).json()) as { list: ListDetail };
  const db = platform.env.DB;
  let intercepted = false;
  const wrapped = new Proxy(db, {
    get(target, key) {
      if (key === 'prepare')
        return (sql: string) => {
          if (!sql.startsWith('UPDATE lists SET archived')) return target.prepare(sql);
          const prepared = target.prepare(sql);
          return {
            bind: (...values: (string | number | null)[]) => ({
              run: async () => {
                intercepted = true;
                await target
                  .prepare('UPDATE lists SET name = ?, description = ?, artwork = ? WHERE id = ?')
                  .bind(
                    'Concurrent name',
                    'Kept description',
                    JSON.stringify({ object: 'camera', tone: 'sage' }),
                    list.id,
                  )
                  .run();
                return prepared.bind(...values).run();
              },
            }),
          };
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const response = await app.request(
    `https://worth.test/api/lists/${list.id}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ archived: true }),
    },
    { ...platform.env, DB: wrapped },
    platform.ctx,
  );
  expect(intercepted).toBe(true);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    list: {
      archived: true,
      name: 'Concurrent name',
      description: 'Kept description',
      artwork: { object: 'camera', tone: 'sage' },
    },
  });
});

test('private visit context stays separate from overall calls, guards revisions and survives backup restore', async () => {
  const owner = 'visitcontext';
  const { list } = (await (
    await call('/lists', owner, 'POST', { name: 'Cafes', kind: 'collection' })
  ).json()) as { list: ListDetail };
  const { item } = (await (
    await call(`/lists/${list.id}/items`, owner, 'POST', { title: 'The cafe', decision: 'favorite' })
  ).json()) as { item: Item };
  await call(`/lists/${list.id}/rank`, owner, 'PUT', { itemIds: [item.id], expectedRevision: 0 });
  const context = {
    location: 'Brooklyn corner',
    version: 'Winter menu',
    order: 'Pistachio latte\nLess ice',
    reaction: 'would_not_again',
  };
  const created = await call(`/lists/${list.id}/logs`, owner, 'POST', {
    itemId: item.id,
    happenedOn: '2026-10-16',
    context,
  });
  expect(created.status).toBe(201);
  const { log } = (await created.json()) as { log: Log };
  expect(log).toMatchObject({ context, revision: 0 });
  expect(
    (
      await call(`/logs/${log.id}`, 'intruder', 'PATCH', {
        context: { reaction: 'meh' },
        expectedRevision: 0,
      })
    ).status,
  ).toBe(404);
  const saved = await call(`/logs/${log.id}`, owner, 'PATCH', {
    note: 'A quieter table',
    expectedRevision: 0,
  });
  expect(await saved.json()).toMatchObject({ log: { context, note: 'A quieter table', revision: 1 } });
  expect(
    (
      await call(`/logs/${log.id}`, owner, 'PATCH', {
        context: { location: 'Stale location' },
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
  expect(await (await call(`/lists/${list.id}/items`, owner)).json()).toMatchObject({
    items: [{ decision: 'favorite' }],
  });
  expect(await (await call(`/lists/${list.id}`, owner)).json()).toMatchObject({
    list: { rankedIds: [item.id], rankRevision: 1 },
  });
  const search = (await (await call('/search?q=Pistachio', owner)).json()) as {
    results: { id: string; detail: string }[];
  };
  expect(search.results.find((r) => r.id === log.id)?.detail).toContain('Pistachio latte');
  const shared = await (await call(`/lists/${list.id}/shares`, owner, 'POST', { limit: 'all' })).json();
  expect(JSON.stringify(shared)).not.toContain('Brooklyn');
  expect(JSON.stringify(shared)).not.toContain('Pistachio');
  const file = archiveFile.parse(await (await call('/export/records', owner)).json());
  expect(file.logs[0].context).toEqual(context);
  const restored = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=visitrestored',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(file),
    },
    platform.env,
    platform.ctx,
  );
  expect(restored.status).toBe(201);
  const copy = archiveFile.parse(await (await call('/export/records', 'visitrestored')).json());
  expect(copy.logs[0].context).toEqual(context);
  expect(copy.logs[0].id).not.toBe(log.id);
  expect(copy.logs[0].itemId).toBe(copy.items[0].id);
  expect((await call(`/logs/${log.id}`, owner, 'PATCH', { context: {}, expectedRevision: 1 })).status).toBe(
    200,
  );
  const cleared = (await (await call(`/lists/${list.id}/logs`, owner)).json()) as { logs: Log[] };
  expect(cleared.logs[0].context).toBeUndefined();
  const { list: activity } = (await (
    await call('/lists', owner, 'POST', { name: 'Walks', kind: 'activity' })
  ).json()) as { list: ListDetail };
  expect(
    (
      await call(`/lists/${activity.id}/logs`, owner, 'POST', {
        title: 'Walk',
        happenedOn: '2026-10-16',
        context,
      })
    ).status,
  ).toBe(400);
  const legacy = {
    ...file,
    logs: file.logs.map((g) => Object.fromEntries(Object.entries(g).filter(([key]) => key !== 'context'))),
  };
  expect(archiveFile.parse(legacy).logs[0].context).toEqual({
    location: '',
    version: '',
    order: '',
    reaction: null,
  });
});

test('visit context follows original records through merges, moves and Trash restoration', async () => {
  const owner = 'visitmoves';
  const createList = async (name: string) =>
    (
      (await (await call('/lists', owner, 'POST', { name, kind: 'collection' })).json()) as {
        list: ListDetail;
      }
    ).list;
  const source = await createList('Visits'),
    destination = await createList('Other visits');
  const createItem = async (title: string) =>
    ((await (await call(`/lists/${source.id}/items`, owner, 'POST', { title })).json()) as { item: Item })
      .item;
  const main = await createItem('Main'),
    original = await createItem('Original');
  const { log } = (await (
    await call(`/lists/${source.id}/logs`, owner, 'POST', {
      itemId: original.id,
      happenedOn: '2026-10-15',
      context: { location: 'Original location', reaction: 'meh' },
    })
  ).json()) as { log: Log };
  expect(
    (
      await archiveAction(source.id, owner, {
        action: 'merge',
        itemIds: [main.id, original.id],
        targetId: main.id,
      })
    ).status,
  ).toBe(200);
  expect(await (await call(`/lists/${source.id}/logs`, owner)).json()).toMatchObject({
    logs: [{ id: log.id, itemId: original.id, context: { location: 'Original location', reaction: 'meh' } }],
  });
  expect(
    (
      await archiveAction(source.id, owner, {
        action: 'move',
        itemIds: [main.id],
        destinationId: destination.id,
      })
    ).status,
  ).toBe(200);
  expect(await (await call(`/lists/${destination.id}/logs`, owner)).json()).toMatchObject({
    logs: [{ id: log.id, context: { location: 'Original location' } }],
  });
  await call(`/logs/${log.id}`, owner, 'DELETE');
  expect(await (await call(`/lists/${destination.id}/logs`, owner)).json()).toMatchObject({ logs: [] });
  await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'log', id: log.id }] });
  expect(await (await call(`/lists/${destination.id}/logs`, owner)).json()).toMatchObject({
    logs: [{ id: log.id, context: { reaction: 'meh' } }],
  });
});

test('a visit update refuses a parent trashed between its read and write', async () => {
  const owner = 'visitrace';
  const { list } = (await (
    await call('/lists', owner, 'POST', { name: 'Race', kind: 'collection' })
  ).json()) as { list: ListDetail };
  const { item } = (await (
    await call(`/lists/${list.id}/items`, owner, 'POST', { title: 'Record' })
  ).json()) as { item: Item };
  const { log } = (await (
    await call(`/lists/${list.id}/logs`, owner, 'POST', { itemId: item.id, happenedOn: '2026-10-16' })
  ).json()) as { log: Log };
  const db = platform.env.DB;
  let raced = false;
  const wrapped = new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return async (statements: D1PreparedStatement[]) => {
          raced = true;
          await target
            .prepare('UPDATE lists SET trashed_at = ? WHERE id = ?')
            .bind(Date.now(), list.id)
            .run();
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const response = await app.request(
    `https://worth.test/api/logs/${log.id}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: 'Must not save', expectedRevision: 0 }),
    },
    { ...platform.env, DB: wrapped },
    platform.ctx,
  );
  expect(raced).toBe(true);
  expect(response.status).toBe(409);
  expect(await db.prepare('SELECT note, revision FROM logs WHERE id = ?').bind(log.id).first()).toEqual({
    note: '',
    revision: 0,
  });
});

function templateInput(name = 'Tasting setup') {
  return {
    id: crypto.randomUUID(),
    name,
    collectionName: 'Coffee',
    description: 'Small cups',
    artwork: { object: 'cup', tone: 'sage' },
    detailFields: ['Roaster', 'Origin'],
  };
}
async function restoreWithTemplates(owner: string, file: unknown, key = crypto.randomUUID()) {
  return app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(file),
    },
    platform.env,
    platform.ctx,
  );
}

test('templates are private, scoped to their owner and safe to retry without resurrecting removals', async () => {
  const owner = 'templateowner',
    template = templateInput();
  expect((await call('/templates', null)).status).toBe(401);
  expect((await call('/templates', owner, 'POST', template, 'https://foreign.test')).status).toBe(403);
  expect((await call('/templates', owner, 'POST', { ...template, records: [] })).status).toBe(400);
  const writes = await Promise.all([
    call('/templates', owner, 'POST', template),
    call('/templates', owner, 'POST', template),
  ]);
  expect(writes.map((response) => response.status).sort()).toEqual([200, 201]);
  expect(await (await call('/templates', owner)).json()).toEqual({ templates: [template] });
  expect(await (await call('/templates', 'othertemplateowner')).json()).toEqual({ templates: [] });
  expect((await call('/templates', owner, 'POST', { ...template, name: 'Changed payload' })).status).toBe(
    409,
  );
  await call(`/templates/${template.id}`, 'othertemplateowner', 'DELETE');
  expect(
    ((await (await call('/templates', owner)).json()) as { templates: unknown[] }).templates,
  ).toHaveLength(1);
  expect((await call('/templates', 'othertemplateowner', 'POST', template)).status).toBe(201);
  await call(`/templates/${template.id}`, owner, 'DELETE');
  expect((await call('/templates', owner, 'POST', template)).status).toBe(409);
  expect(await (await call('/templates', owner)).json()).toEqual({ templates: [] });
});

test('collection fields stay optional, revision guarded and preserved in templates and backups', async () => {
  const owner = 'fieldowner';
  const response = await call('/lists', owner, 'POST', {
    name: 'Coffee setup',
    kind: 'collection',
    detailFields: ['Roaster', 'Origin'],
  });
  expect(response.status).toBe(201);
  const list = ((await response.json()) as { list: ListDetail }).list;
  const item = await archiveItem(owner, list.id, 'Name only');
  expect(item.context?.fields ?? []).toEqual([]);
  const saved = (await (await call(`/lists/${list.id}/workspace`, owner)).json()) as {
    workspace: { rankings: []; views: []; detailFields: string[] };
    revision: number;
  };
  expect(saved.workspace.detailFields).toEqual(['Roaster', 'Origin']);
  expect((await call(`/lists/${list.id}/workspace`, 'fieldstranger')).status).toBe(404);
  expect(
    (
      await call(`/lists/${list.id}/workspace`, owner, 'PUT', {
        workspace: { ...saved.workspace, detailFields: ['Origin', ' Ｏｒｉｇｉｎ '] },
        expectedRevision: 0,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call(`/lists/${list.id}/workspace`, owner, 'PUT', {
        workspace: { ...saved.workspace, detailFields: ['Origin'] },
        expectedRevision: 0,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(`/lists/${list.id}/workspace`, owner, 'PUT', {
        workspace: saved.workspace,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
  expect(
    (await call('/lists', owner, 'POST', { name: 'Activity', kind: 'activity', detailFields: ['Field'] }))
      .status,
  ).toBe(400);
  const template = templateInput();
  await call('/templates', owner, 'POST', template);
  const backup = (await (await call('/export/records', owner)).json()) as ArchiveFile;
  expect(backup.collectionTemplates).toEqual([template]);
  expect(backup.lists[0].workspace.detailFields).toEqual(['Origin']);
  const key = crypto.randomUUID();
  expect((await restoreWithTemplates('fieldrestore', backup, key)).status).toBe(201);
  expect((await restoreWithTemplates('fieldrestore', backup, key)).status).toBe(201);
  const restored = (await (await call('/export/records', 'fieldrestore')).json()) as ArchiveFile;
  expect(restored.collectionTemplates).toHaveLength(1);
  expect(restored.collectionTemplates[0]).toEqual({ ...template, id: expect.any(String) });
  expect(restored.collectionTemplates[0].id).not.toBe(template.id);
  expect(restored.lists[0].workspace.detailFields).toEqual(['Origin']);
  const invalid = structuredClone(backup);
  invalid.lists[0].kind = 'activity';
  invalid.items = [];
  invalid.lists[0].rankedIds = [];
  expect((await restoreWithTemplates('fieldbadrestore', invalid)).status).toBe(400);
});

test('template capacity is atomic under concurrent saves and rolls back the entire restore', async () => {
  const owner = 'templatecapacity';
  const seeded = Array.from({ length: 49 }, (_, index) => templateInput(`Setup ${index}`));
  await platform.env.DB.prepare(
    'INSERT INTO collection_template_sets (owner_id, templates_json) VALUES (?, ?)',
  )
    .bind(owner, JSON.stringify(seeded))
    .run();
  const a = templateInput('Last spot A'),
    b = templateInput('Last spot B');
  const responses = await Promise.all([
    call('/templates', owner, 'POST', a),
    call('/templates', owner, 'POST', b),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  const rejected = responses[0].status === 409 ? a : b;
  expect(await (responses[0].status === 409 ? responses[0] : responses[1]).json()).toMatchObject({
    error: 'TEMPLATE_LIMIT',
  });
  const source = await archiveCollection('templatebackupsource', 'Preserved source');
  await call('/templates', 'templatebackupsource', 'POST', templateInput('From backup'));
  const backup = await (await call('/export/records', 'templatebackupsource')).json();
  const key = crypto.randomUUID();
  const failed = await restoreWithTemplates(owner, backup, key);
  expect(failed.status).toBe(409);
  expect(await failed.json()).toMatchObject({ error: 'TEMPLATE_LIMIT' });
  expect(
    (
      await platform.env.DB.prepare('SELECT COUNT(*) AS n FROM lists WHERE owner_id = ?')
        .bind(owner)
        .first<{ n: number }>()
    )?.n,
  ).toBe(0);
  expect(
    await platform.env.DB.prepare('SELECT id FROM capture_operations WHERE id = ?').bind(key).first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare('SELECT id FROM collection_template_receipts WHERE owner_id = ? AND id = ?')
      .bind(owner, rejected.id)
      .first(),
  ).toBeNull();
  const current = (await (await call('/templates', owner)).json()) as { templates: { id: string }[] };
  expect(current.templates).toHaveLength(50);
  await call(`/templates/${current.templates[0].id}`, owner, 'DELETE');
  expect((await restoreWithTemplates(owner, backup, key)).status).toBe(201);
  const restored = (await (await call('/export/records', owner)).json()) as ArchiveFile;
  expect(restored.collectionTemplates).toHaveLength(50);
  expect(restored.lists[0].name).toBe(source.name);
});

test('template-only restore works and all-data deletion clears templates and their retry receipts', async () => {
  const owner = 'onlytemplates';
  const template = templateInput();
  const file = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    collectionTemplates: [template],
  };
  const restored = await restoreWithTemplates(owner, file);
  expect(restored.status).toBe(201);
  expect(await restored.json()).toEqual({ ids: [] });
  await call('/templates', owner, 'POST', templateInput('Direct save'));
  const removed = await app.request(
    'https://worth.test/api/data',
    {
      method: 'DELETE',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'X-Worth-Confirmation': 'delete-all-worth-data',
      },
    },
    platform.env,
    platform.ctx,
  );
  expect(removed.status).toBe(204);
  expect(await (await call('/templates', owner)).json()).toEqual({ templates: [] });
  expect(
    (
      await platform.env.DB.prepare(
        'SELECT COUNT(*) AS n FROM collection_template_receipts WHERE owner_id = ?',
      )
        .bind(owner)
        .first<{ n: number }>()
    )?.n,
  ).toBe(0);
});

test('an account-bound stale tab cannot read or write into a newly signed-in account', async () => {
  const stale = (method: string, path: string, body?: unknown) =>
    app.request(
      `https://worth.test/api${path}`,
      {
        method,
        headers: {
          Cookie: 'preview_user=newaccount',
          Origin: 'https://worth.test',
          'Content-Type': 'application/json',
          'X-Worth-Account': 'previousaccount',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      platform.env,
      platform.ctx,
    );
  for (const response of [
    await stale('GET', '/lists'),
    await stale('POST', '/lists', { name: 'Must not save', kind: 'collection' }),
    await stale('DELETE', '/data'),
  ]) {
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'ACCOUNT_CHANGED' });
  }
  expect(
    (
      await platform.env.DB.prepare('SELECT COUNT(*) AS n FROM lists WHERE owner_id = ?')
        .bind('newaccount')
        .first<{ n: number }>()
    )?.n,
  ).toBe(0);
  const metadata = await stale('GET', '/me');
  expect(metadata.status).toBe(200);
  expect(await metadata.json()).toMatchObject({ user: { id: 'newaccount' } });
});

async function inboxRequest(
  owner: string,
  path: string,
  body: unknown,
  key = crypto.randomUUID(),
  env = platform.env,
) {
  return app.request(
    `https://worth.test/api${path}`,
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
    env,
    platform.ctx,
  );
}
async function inboxFind(owner: string, title: string, extra = {}) {
  const response = await inboxRequest(owner, '/inbox', { item: { title, ...extra } });
  expect(response.status).toBe(201);
  return ((await response.json()) as { entry: InboxEntry }).entry;
}

test('Inbox capture is private, idempotent and revision guarded, with searchable context', async () => {
  const owner = 'inboxowner',
    key = crypto.randomUUID();
  const input = {
    item: {
      title: 'Pistachio Inbox',
      note: 'Private unfiled note',
      context: { sourceUrl: 'https://example.test/find', recommendedBy: 'Mina' },
      wantToTry: true,
    },
  };
  expect((await call('/inbox', null)).status).toBe(401);
  expect((await call('/inbox', owner, 'POST', input, 'https://foreign.test')).status).toBe(403);
  const responses = await Promise.all([
    inboxRequest(owner, '/inbox', input, key),
    inboxRequest(owner, '/inbox', input, key),
  ]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  const entry = ((await responses[0].json()) as { entry: InboxEntry }).entry;
  expect(((await (await call('/inbox', owner)).json()) as { entries: InboxEntry[] }).entries).toHaveLength(1);
  expect(entry.decision).toBeNull();
  expect(entry.wantToTry).toBe(true);
  expect((await call(`/inbox/${entry.id}`, 'inboxstranger')).status).toBe(404);
  expect(await (await call('/inbox', 'inboxstranger')).json()).toEqual({ entries: [] });
  expect((await inboxRequest(owner, '/inbox', { item: { title: 'Different body' } }, key)).status).toBe(409);
  const search = (await (await call('/search?q=Mina', owner)).json()) as {
    results: { id: string; kind: string }[];
  };
  expect(search.results).toContainEqual(expect.objectContaining({ id: entry.id, kind: 'inbox' }));
  const item = { ...itemInput.parse(entry), note: 'Saved new note' };
  expect((await call(`/inbox/${entry.id}`, owner, 'PUT', { item, expectedRevision: 0 })).status).toBe(200);
  expect((await call(`/inbox/${entry.id}`, owner, 'PUT', { item, expectedRevision: 0 })).status).toBe(200);
  expect(
    (
      await call(`/inbox/${entry.id}`, owner, 'PUT', {
        item: { ...item, note: 'Stale note' },
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
});

test('Inbox filing preserves saved context and calls, stays unranked and recovers the same receipt', async () => {
  const owner = 'inboxfiler';
  const target = await archiveCollection(owner, 'Filed drinks');
  const foreign = await archiveCollection('inboxforeign', 'Other collection');
  const entry = await inboxFind(owner, 'A found book', {
    decision: 'meh',
    wantToTry: true,
    note: 'PRIVATE',
    context: { sourceUrl: 'https://example.test/book', fields: [{ name: 'Edition', value: 'Second' }] },
  });
  const body = { targetListId: target.id, expectedRevision: entry.revision },
    key = crypto.randomUUID();
  expect(
    (await inboxRequest(owner, `/inbox/${entry.id}/file`, { ...body, targetListId: foreign.id })).status,
  ).toBe(404);
  expect(
    (await inboxRequest(owner, `/inbox/${entry.id}/file`, { ...body, expectedRevision: 42 })).status,
  ).toBe(409);
  const responses = await Promise.all([
    inboxRequest(owner, `/inbox/${entry.id}/file`, body, key),
    inboxRequest(owner, `/inbox/${entry.id}/file`, body, key),
  ]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  const item = ((await responses[0].json()) as { item: Item }).item;
  expect(item).toMatchObject({
    title: entry.title,
    decision: 'meh',
    wantToTry: true,
    note: 'PRIVATE',
    context: entry.context,
    createdAt: entry.createdAt,
  });
  expect(
    ((await (await call(`/lists/${target.id}`, owner)).json()) as { list: ListDetail }).list.rankedIds,
  ).toEqual([]);
  expect(
    ((await (await call(`/lists/${target.id}/items`, owner)).json()) as { items: Item[] }).items,
  ).toHaveLength(1);
  expect((await call(`/inbox/${entry.id}`, owner)).status).toBe(404);
  expect(
    (await inboxRequest(owner, `/inbox/${entry.id}/file`, { ...body, expectedRevision: 2 }, key)).status,
  ).toBe(409);
  await call(`/items/${item.id}`, owner, 'DELETE');
  expect((await inboxRequest(owner, `/inbox/${entry.id}/file`, body, key)).status).toBe(409);
  expect((await call('/inbox', owner)).status).toBe(200);
});

test('a trashed filing destination rolls back the Inbox source, item and receipt together', async () => {
  const owner = 'inboxrace',
    target = await archiveCollection(owner, 'Changing destination');
  const entry = await inboxFind(owner, 'Never lose this');
  const db = platform.env.DB,
    key = crypto.randomUUID();
  const wrapped = new Proxy(db, {
    get(original, property) {
      if (property === 'batch')
        return async (statements: D1PreparedStatement[]) => {
          await db
            .prepare('UPDATE lists SET trashed_at = ? WHERE id = ? AND owner_id = ?')
            .bind(Date.now(), target.id, owner)
            .run();
          return db.batch(statements);
        };
      const value = Reflect.get(original, property);
      return typeof value === 'function' ? value.bind(original) : value;
    },
  });
  const response = await inboxRequest(
    owner,
    `/inbox/${entry.id}/file`,
    { targetListId: target.id, expectedRevision: entry.revision },
    key,
    { ...platform.env, DB: wrapped },
  );
  expect(response.status).toBe(409);
  expect((await call(`/inbox/${entry.id}`, owner)).status).toBe(200);
  expect(await db.prepare('SELECT id FROM items WHERE list_id = ?').bind(target.id).first()).toBeNull();
  expect(await db.prepare('SELECT id FROM inbox_operations WHERE id = ?').bind(key).first()).toBeNull();
});

test('Inbox Trash restores unfiled finds, expires after thirty days and never replays a removed creation', async () => {
  const owner = 'inboxtrash',
    key = crypto.randomUUID(),
    input = { item: { title: 'Keep recoverable' } };
  const response = await inboxRequest(owner, '/inbox', input, key);
  const entry = ((await response.json()) as { entry: InboxEntry }).entry;
  expect((await call(`/inbox/${entry.id}`, owner, 'DELETE')).status).toBe(204);
  expect(await (await call('/inbox', owner)).json()).toEqual({ entries: [] });
  const trash = (await (await call('/trash', owner)).json()) as {
    entries: { id: string; kind: string; listName: string }[];
  };
  expect(trash.entries).toContainEqual(
    expect.objectContaining({ id: entry.id, kind: 'inbox', listName: 'Inbox' }),
  );
  expect((await inboxRequest(owner, '/inbox', input, key)).status).toBe(409);
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'inbox', id: entry.id }] })).status,
  ).toBe(200);
  expect((await call(`/inbox/${entry.id}`, owner)).status).toBe(200);
  await call(`/inbox/${entry.id}`, owner, 'DELETE');
  await platform.env.DB.prepare('UPDATE inbox_entries SET trashed_at = ? WHERE id = ?')
    .bind(Date.now() - 31 * 86400000, entry.id)
    .run();
  await call('/trash', owner);
  expect(
    await platform.env.DB.prepare('SELECT id FROM inbox_entries WHERE id = ?').bind(entry.id).first(),
  ).toBeNull();
  expect((await inboxRequest(owner, '/inbox', input, key)).status).toBe(409);
});

test('Inbox backups restore new private entries and exports never lose a find during filing', async () => {
  const owner = 'inboxbackup',
    entry = await inboxFind(owner, 'Atomic souvenir', {
      context: { recommendedBy: 'Mina', location: 'Brooklyn' },
    });
  const target = await archiveCollection(owner, 'Collection');
  const [filed, exporting] = await Promise.all([
    inboxRequest(owner, `/inbox/${entry.id}/file`, {
      targetListId: target.id,
      expectedRevision: entry.revision,
    }),
    call('/export/records', owner),
  ]);
  expect(filed.status).toBe(201);
  const snapshot = (await exporting.json()) as ArchiveFile;
  expect(
    snapshot.inbox.filter((find) => find.title === entry.title).length +
      snapshot.items.filter((item) => item.title === entry.title).length,
  ).toBe(1);
  const unfiled = await inboxFind(owner, 'Still unfiled', { note: 'Private text', wantToTry: true });
  const backup = (await (await call('/export/backup', owner)).json()) as ArchiveFile;
  expect(backup.inbox).toContainEqual(unfiled);
  const key = crypto.randomUUID();
  expect((await restoreWithTemplates('inboxrestored', backup, key)).status).toBe(201);
  expect((await restoreWithTemplates('inboxrestored', backup, key)).status).toBe(201);
  const restored = (await (await call('/inbox', 'inboxrestored')).json()) as { entries: InboxEntry[] };
  expect(restored.entries).toHaveLength(1);
  expect(restored.entries[0].id).not.toBe(unfiled.id);
  expect(restored.entries[0]).toMatchObject({
    title: unfiled.title,
    note: 'Private text',
    wantToTry: true,
    revision: 0,
  });
  const sourceOnly = {
    ...backup,
    lists: [],
    items: [],
    logs: [],
    workoutSessions: [],
    workoutRoutines: [],
    photos: [],
  };
  expect((await restoreWithTemplates('inboxonlyrestore', sourceOnly)).status).toBe(201);
  expect(
    ((await (await call('/inbox', 'inboxonlyrestore')).json()) as { entries: InboxEntry[] }).entries,
  ).toHaveLength(1);
});

test('Inbox capacity is atomic and a full destination rolls back every restored record and receipt', async () => {
  const owner = 'inboxcapacity',
    db = platform.env.DB;
  const item = itemInput.parse({ title: 'Seeded find' });
  const ids = Array.from({ length: 499 }, () => crypto.randomUUID());
  await db
    .prepare(
      'INSERT INTO inbox_entries (id, owner_id, payload_json, created_at, updated_at) SELECT value, ?, ?, 1, 1 FROM json_each(?)',
    )
    .bind(owner, JSON.stringify(item), JSON.stringify(ids))
    .run();
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const results = await Promise.all([
    inboxRequest(owner, '/inbox', { item: { title: 'Last spot A' } }, a),
    inboxRequest(owner, '/inbox', { item: { title: 'Last spot B' } }, b),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  const rejected = results[0].status === 409 ? a : b;
  expect(await db.prepare('SELECT id FROM inbox_operations WHERE id = ?').bind(rejected).first()).toBeNull();
  const source = await archiveCollection('inboxquotasource', 'Do not partially restore');
  await inboxFind('inboxquotasource', 'Extra Inbox record');
  const backup = await (await call('/export/records', 'inboxquotasource')).json();
  const key = crypto.randomUUID();
  expect((await restoreWithTemplates(owner, backup, key)).status).toBe(409);
  expect(await db.prepare('SELECT id FROM lists WHERE owner_id = ?').bind(owner).first()).toBeNull();
  expect(await db.prepare('SELECT id FROM capture_operations WHERE id = ?').bind(key).first()).toBeNull();
  await call(`/inbox/${ids[0]}`, owner, 'DELETE');
  expect((await restoreWithTemplates(owner, backup, key)).status).toBe(201);
  expect(((await (await call('/lists', owner)).json()) as { lists: ListDetail[] }).lists[0].name).toBe(
    source.name,
  );
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'inbox', id: ids[0] }] })).status,
  ).toBe(409);
});

test('all-data deletion clears Inbox records, Trash and Inbox retry receipts', async () => {
  const owner = 'inboxdelete';
  const entry = await inboxFind(owner, 'Remove this too');
  await call(`/inbox/${entry.id}`, owner, 'DELETE');
  const response = await app.request(
    'https://worth.test/api/data',
    {
      method: 'DELETE',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'X-Worth-Confirmation': 'delete-all-worth-data',
      },
    },
    platform.env,
    platform.ctx,
  );
  expect(response.status).toBe(204);
  expect(
    await platform.env.DB.prepare('SELECT id FROM inbox_entries WHERE owner_id = ?').bind(owner).first(),
  ).toBeNull();
  expect(
    await platform.env.DB.prepare('SELECT id FROM inbox_operations WHERE owner_id = ?').bind(owner).first(),
  ).toBeNull();
});

test('retrospectives preserve local saved-day bounds, explicit log dates, scope and owner boundaries', async () => {
  const owner = 'retroowner',
    list = await archiveCollection(owner, 'Current pages'),
    archived = await archiveCollection(owner, 'Earlier pages'),
    foreign = await archiveCollection('retroforeign', 'Foreign pages');
  const gym = (
    (await (await call('/lists', owner, 'POST', { name: 'Movement', kind: 'activity' })).json()) as {
      list: ListDetail;
    }
  ).list;
  await platform.env.DB.prepare('UPDATE lists SET archived = 1 WHERE id = ?').bind(archived.id).run();
  const ids = Array.from({ length: 7 }, () => crypto.randomUUID());
  const add = (
    id: string,
    listId: string,
    who: string,
    title: string,
    date: string,
    trashed: number | null = null,
  ) =>
    platform.env.DB.prepare(
      'INSERT INTO items (id, list_id, owner_id, title, note, created_at, updated_at, trashed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, listId, who, title, 'PRIVATE retrospective note', Date.parse(date), Date.parse(date), trashed);
  const log = (id: string, listId: string, who: string, itemId: string | null, day: string) =>
    platform.env.DB.prepare(
      'INSERT INTO logs (id, list_id, owner_id, item_id, title, happened_on, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      id,
      listId,
      who,
      itemId,
      'An actual log',
      day,
      'PRIVATE dated note',
      Date.parse('2026-11-02T12:00:00Z'),
      Date.parse('2026-11-02T12:00:00Z'),
    );
  const inboxId = crypto.randomUUID(),
    payload = itemInput.parse({ title: 'An unfiled find' });
  await platform.env.DB.batch([
    add(ids[0], list.id, owner, 'First local day', '2026-10-01T04:00:00Z'),
    add(ids[1], list.id, owner, 'Last local minute', '2026-11-01T03:59:59Z'),
    add(ids[2], list.id, owner, 'Before local period', '2026-10-01T03:59:59Z'),
    add(ids[3], list.id, owner, 'After local period', '2026-11-01T04:00:00Z'),
    add(ids[4], archived.id, owner, 'Archived find', '2026-10-15T12:00:00Z'),
    add(ids[5], list.id, owner, 'Trashed find', '2026-10-15T12:00:00Z', 1),
    add(ids[6], foreign.id, 'retroforeign', 'Foreign find', '2026-10-15T12:00:00Z'),
    log(crypto.randomUUID(), list.id, owner, ids[0], '2026-10-20'),
    log(crypto.randomUUID(), gym.id, owner, null, '2026-10-10'),
    log(crypto.randomUUID(), gym.id, owner, null, '2026-09-30'),
    log(crypto.randomUUID(), archived.id, owner, ids[4], '2026-10-20'),
    log(crypto.randomUUID(), list.id, owner, ids[5], '2026-10-20'),
    log(crypto.randomUUID(), foreign.id, 'retroforeign', ids[6], '2026-10-20'),
    platform.env.DB.prepare(
      'INSERT INTO inbox_entries (id, owner_id, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(
      inboxId,
      owner,
      JSON.stringify(payload),
      Date.parse('2026-10-14T12:00:00Z'),
      Date.parse('2026-10-14T12:00:00Z'),
    ),
  ]);
  const query = '/retrospective?from=2026-10-01&to=2026-10-31&startOffset=240&endOffset=240&archived=0';
  const reply = await call(query, owner);
  expect(reply.status).toBe(200);
  expect(reply.headers.get('cache-control')).toContain('no-store');
  const data = (await reply.json()) as import('../src/shared/retrospective').Retrospective;
  expect(data.counts).toEqual({ kept: 3, revisits: 1, activity: 1 });
  expect(data.kept.map((record) => record.title)).toEqual([
    'Last local minute',
    'An unfiled find',
    'First local day',
  ]);
  expect(JSON.stringify(data)).not.toMatch(
    /Foreign find|Trashed find|Archived find|Before local period|After local period/,
  );
  expect(data.logs).toHaveLength(2);
  expect(data.logs.find((record) => record.kind === 'visit')).toMatchObject({
    title: 'First local day',
    happenedOn: '2026-10-20',
    note: 'PRIVATE dated note',
  });
  const all = (await (await call(query.replace('archived=0', 'archived=1'), owner)).json()) as typeof data;
  expect(all.counts).toEqual({ kept: 4, revisits: 2, activity: 1 });
  const scoped = (await (await call(query + `&list=${list.id}`, owner)).json()) as typeof data;
  expect(scoped.counts).toEqual({ kept: 2, revisits: 1, activity: 0 });
  expect((await call(query + `&list=${foreign.id}`, owner)).status).toBe(404);
  expect((await call(query + `&list=${archived.id}`, owner)).status).toBe(400);
  expect((await call(query, null)).status).toBe(401);
  expect((await call(query.replace('2026-10-01', '2026-02-30'), owner)).status).toBe(400);
  expect(
    (
      await app.request(
        `https://worth.test/api${query}`,
        { headers: { Cookie: `preview_user=${owner}`, 'X-Worth-Account': 'retroforeign' } },
        platform.env,
        platform.ctx,
      )
    ).status,
  ).toBe(409);
  const entry = ((await (await call(`/items/${ids[0]}`, owner)).json()) as { item: Item }).item;
  expect(entry.decision).toBeNull();
  expect(entry.note).toBe('PRIVATE retrospective note');
  const filed = await app.request(
    `https://worth.test/api/inbox/${inboxId}/file`,
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({ targetListId: list.id, expectedRevision: 0 }),
    },
    platform.env,
    platform.ctx,
  );
  expect(filed.status).toBe(201);
  const afterFile = (await (await call(query, owner)).json()) as typeof data;
  expect(afterFile.counts.kept).toBe(3);
  expect(afterFile.kept.find((record) => record.title === 'An unfiled find')).toMatchObject({
    kind: 'item',
    listId: list.id,
    createdAt: Date.parse('2026-10-14T12:00:00Z'),
  });
});

test('retrospective counts remain complete while record groups have explicit display bounds', async () => {
  const owner = 'retrolimit',
    list = await archiveCollection(owner, 'Many pages');
  await platform.env.DB.batch(
    Array.from({ length: 55 }, (_, index) =>
      platform.env.DB.prepare(
        'INSERT INTO items (id, list_id, owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(
        crypto.randomUUID(),
        list.id,
        owner,
        `Find ${index}`,
        Date.parse('2026-10-15T12:00:00Z') + index,
        Date.parse('2026-10-15T12:00:00Z') + index,
      ),
    ),
  );
  const reply = await call(
    '/retrospective?from=2026-10-01&to=2026-10-31&startOffset=0&endOffset=0&archived=0',
    owner,
  );
  expect(reply.status).toBe(200);
  const data = (await reply.json()) as import('../src/shared/retrospective').Retrospective;
  expect(data.counts).toEqual({ kept: 55, revisits: 0, activity: 0 });
  expect(data.kept).toHaveLength(50);
  expect(data.kept[0].title).toBe('Find 54');
  expect(data.kept[49].title).toBe('Find 5');
});

test('taste history records future changes atomically, preserves gaps, and follows opinions through moves', async () => {
  const owner = 'historyowner';
  const list = await archiveCollection(owner, 'Taste');
  const other = await archiveCollection(owner, 'Elsewhere');
  const item = await archiveItem(owner, list.id, 'First', { decision: 'meh' });
  const second = await archiveItem(owner, list.id, 'Second');
  const history = async (listId = list.id) =>
    (await (
      await call(`/lists/${listId}/history`, owner)
    ).json()) as import('../src/shared/taste-history').HistoryPage;
  expect((await history()).events).toEqual([]); // no invented initial change
  expect(
    (
      await call(`/lists/${list.id}/rank`, owner, 'PUT', {
        itemIds: [item.id, second.id],
        expectedRevision: 0,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(`/lists/${list.id}/rank`, owner, 'PUT', {
        itemIds: [item.id, second.id],
        expectedRevision: 1,
      })
    ).status,
  ).toBe(200);
  expect((await history()).events).toHaveLength(1); // identical order is not a new taste change
  const changed = await call(`/items/${item.id}`, owner, 'PATCH', { decision: 'favorite' });
  expect(changed.status).toBe(200);
  await call(`/items/${item.id}`, owner, 'PATCH', { decision: null });
  await call(`/items/${item.id}`, owner, 'PATCH', { note: 'Unrelated note' });
  const events = (await history()).events;
  expect(events).toHaveLength(3);
  expect(events.filter((e) => e.kind === 'opinion').map((e) => [e.before, e.after])).toEqual(
    expect.arrayContaining([
      ['meh', 'favorite'],
      ['favorite', null],
    ]),
  );
  expect((await call(`/lists/${list.id}/history`, 'historyother')).status).toBe(404);
  expect((await call(`/lists/${list.id}/history`, null)).status).toBe(401);
  expect((await call(`/lists/${list.id}/history?cursor=bad`, owner)).status).toBe(400);
  expect((await call(`/lists/${list.id}/history?until=NaN`, owner)).status).toBe(400);
  const opinion = events.find((e) => e.kind === 'opinion')!;
  expect((await call(`/history/${opinion.id}`, 'historyother')).status).toBe(404);
  expect((await call(`/history/${opinion.id}`, owner)).status).toBe(200);
  expect(
    (
      await call(`/history/${opinion.id}/note`, 'historyother', 'PUT', {
        reason: 'Bad',
        logId: null,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(404);
  const visit = (await (
    await call(`/lists/${list.id}/logs`, owner, 'POST', {
      itemId: item.id,
      happenedOn: '2026-10-01',
      note: 'Changed my mind',
    })
  ).json()) as { log: Log };
  expect(
    (
      await call(`/history/${opinion.id}/note`, owner, 'PUT', {
        reason: 'A second visit',
        logId: visit.log.id,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(`/history/${opinion.id}/note`, owner, 'PUT', {
        reason: 'Stale',
        logId: null,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
  const rank = events.find((e) => e.kind === 'rank')!;
  expect(
    (
      await call(`/history/${rank.id}/note`, owner, 'PUT', {
        reason: 'A visit',
        logId: visit.log.id,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(400);
  expect(
    (await archiveAction(list.id, owner, { action: 'move', itemIds: [item.id], destinationId: other.id }))
      .status,
  ).toBe(200);
  expect((await history()).events.filter((e) => e.kind === 'opinion')).toEqual([]);
  const moved = (await history(other.id)).events;
  expect(moved).toHaveLength(2);
  expect(moved.find((e) => e.id === opinion.id)).toMatchObject({
    reason: 'A second visit',
    logId: visit.log.id,
  });
  await call(`/items/${second.id}`, owner, 'DELETE');
  const remaining = await history();
  expect(
    remaining.events.every(
      (e) => e.kind !== 'rank' || [...e.before, ...e.after].every((id) => id !== second.id),
    ),
  ).toBe(true);
  expect(remaining.events.some((e) => e.kind === 'rank' && e.after.includes(null))).toBe(true);
  await call(`/logs/${visit.log.id}`, owner, 'DELETE');
  expect((await history(other.id)).events.find((e) => e.id === opinion.id)?.logId).toBeNull();
  const exported = archiveFile.parse(await (await call('/export/records', owner)).json());
  expect(exported.schemaVersion).toBe(8);
  expect(exported.tasteHistory).toHaveLength(remaining.events.length + 2);
  expect(exported.tasteHistory.find((e) => e.id === opinion.id)?.logId).toBeNull();
  const restored = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=historyrestore',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(exported),
    },
    platform.env,
    platform.ctx,
  );
  expect(restored.status).toBe(201);
  const roundTrip = archiveFile.parse(await (await call('/export/records', 'historyrestore')).json());
  expect(roundTrip.tasteHistory).toHaveLength(exported.tasteHistory.length);
  expect(roundTrip.tasteHistory.some((e) => exported.tasteHistory.some((old) => old.id === e.id))).toBe(
    false,
  );
  expect(roundTrip.tasteHistory.map((e) => [e.kind, e.reason, e.createdAt])).toEqual(
    exported.tasteHistory.map((e) => [e.kind, e.reason, e.createdAt]),
  );
  expect(roundTrip.tasteHistory.some((e) => e.kind === 'rank' && e.after.includes(null))).toBe(true);
});

test('history pagination retains tied dates, hides unavailable parents and guards visit ownership', async () => {
  const owner = 'historypages',
    list = await archiveCollection(owner, 'History pages');
  const item = await archiveItem(owner, list.id, 'A find'),
    other = await archiveItem(owner, list.id, 'Another find');
  const created = (await (
    await call(`/lists/${list.id}/logs`, owner, 'POST', { itemId: other.id, happenedOn: '2026-10-01' })
  ).json()) as { log: Log };
  await platform.env.DB.prepare("UPDATE items SET decision='favorite' WHERE id=?").bind(item.id).run();
  const first = (await (
    await call(`/lists/${list.id}/history`, owner)
  ).json()) as import('../src/shared/taste-history').HistoryPage;
  expect(
    (
      await call(`/history/${first.events[0].id}/note`, owner, 'PUT', {
        reason: 'Wrong visit',
        logId: created.log.id,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
  await platform.env.DB.batch(
    Array.from({ length: 55 }, (_, i) =>
      platform.env.DB.prepare(
        "INSERT INTO taste_history (id,owner_id,kind,item_id,before_json,after_json,created_at) VALUES(?,?,'opinion',?,'null','\"meh\"',?)",
      ).bind(i.toString(16).padStart(32, '0'), owner, item.id, 100),
    ),
  );
  const read = async (cursor = '') =>
    (await (
      await call(`/lists/${list.id}/history?cursor=${cursor}`, owner)
    ).json()) as import('../src/shared/taste-history').HistoryPage;
  const a = await read(),
    b = await read(a.next!);
  expect(a.events).toHaveLength(50);
  expect(b.events).toHaveLength(6);
  expect(b.next).toBeNull();
  expect(new Set([...a.events, ...b.events].map((e) => e.id)).size).toBe(56);
  const older = (await (
    await call(`/lists/${list.id}/history?until=101`, owner)
  ).json()) as import('../src/shared/taste-history').HistoryPage;
  expect(older.events.every((e) => e.createdAt === 100)).toBe(true);
  await call(`/lists/${list.id}`, owner, 'DELETE');
  expect((await call(`/lists/${list.id}/history`, owner)).status).toBe(404);
  expect(
    (
      await call(`/history/${first.events[0].id}/note`, owner, 'PUT', {
        reason: 'Trashed',
        logId: null,
        expectedRevision: 0,
      })
    ).status,
  ).toBe(404);
});

test('history exports report their bounds without omitting excess events', async () => {
  const owner = 'historycapacity',
    list = await archiveCollection(owner, 'Long history'),
    item = await archiveItem(owner, list.id, 'One');
  await platform.env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<10001)
 INSERT INTO taste_history (id,owner_id,kind,item_id,before_json,after_json,created_at)
 SELECT lower(hex(randomblob(16))),?,'opinion',?,'null','"meh"',i FROM n`,
  )
    .bind(owner, item.id)
    .run();
  const tooMany = await call('/export/records', owner);
  expect(tooMany.status).toBe(413);
  expect(await tooMany.json()).toMatchObject({ error: 'HISTORY_EXPORT_TOO_LARGE' });
  await platform.env.DB.prepare('DELETE FROM taste_history WHERE owner_id=? AND created_at>9999')
    .bind(owner)
    .run();
  await platform.env.DB.prepare('UPDATE taste_history SET reason=? WHERE owner_id=?')
    .bind('a'.repeat(2000), owner)
    .run();
  expect((await call('/export/backup', owner)).status).toBe(413);
  await platform.env.DB.prepare('DELETE FROM lists WHERE owner_id=?').bind(owner).run();
});

async function connectRecords(owner: string, body: unknown, key = crypto.randomUUID()) {
  return app.request(
    'https://worth.test/api/connections',
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
    platform.env,
    platform.ctx,
  );
}
test('private connections retry exactly, reject duplicate pairs and stale reasons, and follow records', async () => {
  const owner = 'connectionowner',
    list = await archiveCollection(owner, 'Books'),
    other = await archiveCollection(owner, 'Editions');
  const a = await archiveItem(owner, list.id, 'First edition', {
      decision: 'meh',
      context: { location: 'Bookshop', version: 'Hardback' },
    }),
    b = await archiveItem(owner, other.id, 'Second edition');
  const payload = { fromId: a.id, toId: b.id, kind: 'edition', reason: 'Same story' },
    key = crypto.randomUUID();
  const response = await connectRecords(owner, payload, key);
  expect(response.status).toBe(201);
  const { connection } = (await response.json()) as {
    connection: import('../src/shared/connections').ConnectionView;
  };
  expect((await connectRecords(owner, payload, key)).status).toBe(201);
  expect((await connectRecords(owner, { ...payload, reason: 'Changed' }, key)).status).toBe(409);
  expect((await connectRecords(owner, { ...payload, fromId: b.id, toId: a.id })).status).toBe(409);
  expect((await call('/connections', null)).status).toBe(401);
  expect(await (await call('/connections', 'connectionother')).json()).toEqual({ connections: [] });
  expect((await call(`/connections/${connection.id}`, 'connectionother')).status).toBe(404);
  expect(
    (
      await call(`/connections/${connection.id}`, owner, 'PUT', {
        reason: 'Private reason',
        expectedRevision: 0,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call(`/connections/${connection.id}`, owner, 'PUT', {
        reason: 'Stale reason',
        expectedRevision: 0,
      })
    ).status,
  ).toBe(409);
  await call(`/lists/${other.id}`, owner, 'PATCH', { archived: true });
  const read = (await (await call('/connections', owner)).json()) as {
    connections: import('../src/shared/connections').ConnectionView[];
  };
  expect(read.connections[0].from.archived || read.connections[0].to.archived).toBe(true);
  expect(read.connections[0].reason).toBe('Private reason');
  expect([read.connections[0].from, read.connections[0].to].find((node) => node.id === a.id)?.detail).toBe(
    'Bookshop · Hardback',
  );
  await call(`/items/${a.id}`, owner, 'DELETE');
  expect(await (await call('/connections', owner)).json()).toEqual({ connections: [] });
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'item', id: a.id }] })).status,
  ).toBe(200);
  expect(
    (await archiveAction(list.id, owner, { action: 'move', itemIds: [a.id], destinationId: other.id }))
      .status,
  ).toBe(200);
  const moved = (await (await call('/connections', owner)).json()) as {
    connections: import('../src/shared/connections').ConnectionView[];
  };
  expect(moved.connections).toHaveLength(1);
  expect(moved.connections[0].from.listId).toBe(other.id);
  expect(moved.connections[0].to.listId).toBe(other.id);
  expect((await call(`/connections/${connection.id}`, owner, 'DELETE', { expectedRevision: 0 })).status).toBe(
    409,
  );
  expect((await call(`/connections/${connection.id}`, owner, 'DELETE', { expectedRevision: 1 })).status).toBe(
    204,
  );
  expect((await connectRecords(owner, payload, key)).status).toBe(410);
  expect((await connectRecords(owner, payload)).status).toBe(201);
  expect(((await (await call(`/items/${a.id}`, owner)).json()) as { item: Item }).item.decision).toBe('meh');
});

test('replacement chains reject loops and backup remapping preserves directions and reasons', async () => {
  const owner = 'replacementowner',
    list = await archiveCollection(owner, 'Equipment');
  const a = await archiveItem(owner, list.id, 'New'),
    b = await archiveItem(owner, list.id, 'Middle'),
    d = await archiveItem(owner, list.id, 'Old');
  expect(
    (await connectRecords(owner, { fromId: a.id, toId: b.id, kind: 'replaces', reason: '' })).status,
  ).toBe(400);
  expect(
    (await connectRecords(owner, { fromId: a.id, toId: b.id, kind: 'replaces', reason: 'Lighter' })).status,
  ).toBe(201);
  expect(
    (await connectRecords(owner, { fromId: b.id, toId: d.id, kind: 'replaces', reason: 'Quieter' })).status,
  ).toBe(201);
  expect(
    (await connectRecords(owner, { fromId: d.id, toId: a.id, kind: 'replaces', reason: 'Would loop' }))
      .status,
  ).toBe(409);
  const exported = archiveFile.parse(await (await call('/export/records', owner)).json());
  expect(exported.connections).toHaveLength(2);
  expect(exported.schemaVersion).toBe(8);
  const restored = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=connectionrestore',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(exported),
    },
    platform.env,
    platform.ctx,
  );
  expect(restored.status).toBe(201);
  const round = archiveFile.parse(await (await call('/export/records', 'connectionrestore')).json());
  expect(round.connections).toHaveLength(2);
  for (const connection of round.connections) {
    expect(exported.connections.some((c) => c.id === connection.id)).toBe(false);
    expect(round.items.some((i) => i.id === connection.fromId)).toBe(true);
    expect(round.items.some((i) => i.id === connection.toId)).toBe(true);
  }
  expect(round.connections.map((c) => c.reason).sort()).toEqual(['Lighter', 'Quieter']);
  const invalid = {
    ...exported,
    connections: [
      ...exported.connections,
      { ...exported.connections[0], id: crypto.randomUUID(), fromId: d.id, toId: a.id },
    ],
  };
  expect(archiveFile.safeParse(invalid).success).toBe(false);
});

test('connection capacity is atomic and a failed restore retries without partial records', async () => {
  const owner = 'connectioncapacity',
    list = await archiveCollection(owner, 'Many links'),
    first = '00000000-0000-4000-8000-000000000001';
  await platform.env.DB.prepare(
    "INSERT INTO items(id,list_id,owner_id,title,created_at,updated_at) VALUES(?,?,?,'Center',1,1)",
  )
    .bind(first, list.id, owner)
    .run();
  await platform.env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1001)
 INSERT INTO items(id,list_id,owner_id,title,created_at,updated_at) SELECT '10000000-0000-4000-8000-'||printf('%012d',i),?,?,'Linked '||i,1,1 FROM n`,
  )
    .bind(list.id, owner)
    .run();
  await platform.env.DB.prepare(
    `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<1000)
 INSERT INTO record_connections(id,owner_id,from_id,to_id,kind,reason,fingerprint,created_at)
 SELECT '60000000-0000-4000-8000-'||printf('%012d',i),?,?,'10000000-0000-4000-8000-'||printf('%012d',i),'related','','seeded',i FROM n`,
  )
    .bind(owner, first)
    .run();
  const tooMany = await connectRecords(owner, {
    fromId: first,
    toId: '10000000-0000-4000-8000-000000001001',
    kind: 'related',
    reason: '',
  });
  expect(tooMany.status).toBe(409);
  expect(await tooMany.json()).toMatchObject({ error: 'CONNECTION_LIMIT' });
  const sourceOwner = 'connectionsource',
    sourceList = await archiveCollection(sourceOwner, 'Source');
  const a = await archiveItem(sourceOwner, sourceList.id, 'A'),
    b = await archiveItem(sourceOwner, sourceList.id, 'B');
  expect(
    (await connectRecords(sourceOwner, { fromId: a.id, toId: b.id, kind: 'related', reason: '' })).status,
  ).toBe(201);
  const file = await (await call('/export/records', sourceOwner)).json(),
    key = crypto.randomUUID();
  const restore = () =>
    app.request(
      'https://worth.test/api/import',
      {
        method: 'POST',
        headers: {
          Cookie: `preview_user=${owner}`,
          Origin: 'https://worth.test',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(file),
      },
      platform.env,
      platform.ctx,
    );
  expect((await restore()).status).toBe(409);
  expect(((await (await call('/lists', owner)).json()) as { lists: ListDetail[] }).lists).toHaveLength(1);
  expect(
    (
      await call('/connections/60000000-0000-4000-8000-000000000001', owner, 'DELETE', {
        expectedRevision: 0,
      })
    ).status,
  ).toBe(204);
  expect((await restore()).status).toBe(201);
  expect((await restore()).status).toBe(201);
  expect(((await (await call('/lists', owner)).json()) as { lists: ListDetail[] }).lists).toHaveLength(2);
  const count = await platform.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM record_connections WHERE owner_id=? AND removed_at IS NULL',
  )
    .bind(owner)
    .first<{ n: number }>();
  expect(count?.n).toBe(1000);
  await platform.env.DB.prepare('DELETE FROM lists WHERE owner_id=?').bind(owner).run();
});

test('calendar separates owner plans from actual logs, uses snoozed days and retains dates in backups', async () => {
  const owner = 'calendarowner',
    list = await archiveCollection(owner, 'Things to revisit');
  const item = await archiveItem(owner, list.id, 'A plan', {
    context: { revisit: { on: '2026-10-17', snoozedUntil: '2026-11-03' } },
  });
  const logResponse = await call(`/lists/${list.id}/logs`, owner, 'POST', {
    itemId: item.id,
    happenedOn: '2026-10-17',
  });
  expect(logResponse.status).toBe(201);
  const read = async (month: string, day: string, archived = '0') => {
    const response = await call(`/calendar?month=${month}&day=${day}&archived=${archived}`, owner);
    expect(response.status).toBe(200);
    return (await response.json()) as import('../src/shared/activity-calendar').ActivityCalendar;
  };
  const activity = (await call('/lists', owner, 'POST', { name: 'Walks', kind: 'activity' }).then((r) =>
    r.json(),
  )) as { list: ListDetail };
  expect(
    (
      await call(`/lists/${activity.list.id}/logs`, owner, 'POST', {
        title: 'A logged walk',
        happenedOn: '2026-10-17',
      })
    ).status,
  ).toBe(201);
  const october = await read('2026-10', '2026-10-17');
  expect(october.days).toEqual([{ day: '2026-10-17', planned: 0, visits: 1, activities: 1 }]);
  expect(october.entries.map((entry) => entry.kind).sort()).toEqual(['activity', 'visit']);
  const november = await read('2026-11', '2026-11-03');
  expect(november.entries).toMatchObject([
    { id: item.id, kind: 'revisit', originalDay: '2026-10-17', day: '2026-11-03' },
  ]);
  expect((await call('/calendar?month=2026-02&day=2026-02-30&archived=0', owner)).status).toBe(400);
  expect(
    (
      (await call('/calendar?month=2026-11&day=2026-11-03&archived=0', 'calendarstranger').then((r) =>
        r.json(),
      )) as { entries: unknown[] }
    ).entries,
  ).toEqual([]);
  expect((await call('/calendar?month=2026-11&day=2026-11-03&archived=0', null)).status).toBe(401);
  const exported = (await call('/export/records', owner).then((r) => r.json())) as ArchiveFile;
  expect(exported.items[0].context.revisit).toEqual({ on: '2026-10-17', snoozedUntil: '2026-11-03' });
  const restore = await app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: 'preview_user=calendarrestore',
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(exported),
    },
    platform.env,
    platform.ctx,
  );
  expect(restore.status).toBe(201);
  const restored = (await call('/calendar?month=2026-11&day=2026-11-03&archived=0', 'calendarrestore').then(
    (r) => r.json(),
  )) as import('../src/shared/activity-calendar').ActivityCalendar;
  expect(restored.entries[0]).toMatchObject({
    originalDay: '2026-10-17',
    day: '2026-11-03',
    title: 'A plan',
  });
  expect(restored.entries[0].id).not.toBe(item.id);
  await call(`/lists/${list.id}`, owner, 'PATCH', { archived: true });
  expect((await read('2026-11', '2026-11-03')).entries).toEqual([]);
  expect((await read('2026-11', '2026-11-03', '1')).entries[0].archived).toBe(true);
  await call(`/items/${item.id}`, owner, 'DELETE');
  expect((await read('2026-11', '2026-11-03', '1')).entries).toEqual([]);
  expect((await read('2026-10', '2026-10-17', '1')).entries.map((entry) => entry.kind)).toEqual(['activity']);
});

test('calendar counts complete days while paging entries and follows Inbox filing without duplicated plans', async () => {
  const owner = 'calendarpages',
    list = await archiveCollection(owner, 'Many plans');
  const find = await inboxFind(owner, 'Unfiled plan', { context: { revisit: { on: '2026-11-03' } } });
  const now = Date.now();
  await platform.env.DB.batch(
    Array.from({ length: 55 }, (_, i) =>
      platform.env.DB.prepare(
        'INSERT INTO items(id,owner_id,list_id,title,context_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
      ).bind(
        crypto.randomUUID(),
        owner,
        list.id,
        `Plan ${i}`,
        JSON.stringify(itemContext.parse({ revisit: { on: '2026-11-03' } })),
        now,
        now,
      ),
    ),
  );
  const response = await call('/calendar?month=2026-11&day=2026-11-03&archived=0', owner);
  const first = (await response.json()) as import('../src/shared/activity-calendar').ActivityCalendar;
  expect(first.days).toEqual([{ day: '2026-11-03', planned: 56, visits: 0, activities: 0 }]);
  expect(first.entries).toHaveLength(50);
  expect(first.entries.some((entry) => entry.kind === 'inbox' && entry.id === find.id)).toBe(true);
  const second = (await call(
    `/calendar?month=2026-11&day=2026-11-03&archived=0&after=${encodeURIComponent(first.next!)}`,
    owner,
  ).then((r) => r.json())) as import('../src/shared/activity-calendar').ActivityCalendar;
  expect(second.entries).toHaveLength(6);
  expect(second.next).toBeNull();
  expect(new Set([...first.entries, ...second.entries].map((e) => `${e.kind}:${e.id}`)).size).toBe(56);
  const filing = await inboxRequest(owner, `/inbox/${find.id}/file`, {
    targetListId: list.id,
    expectedRevision: find.revision,
  });
  expect(filing.status).toBe(201);
  const after = (await call('/calendar?month=2026-11&day=2026-11-03&archived=0', owner).then((r) =>
    r.json(),
  )) as import('../src/shared/activity-calendar').ActivityCalendar;
  expect(after.days[0].planned).toBe(56);
  expect(after.entries.every((entry) => entry.kind !== 'inbox')).toBe(true);
});

test('photo gallery migration retains existing item, visit and trashed source originals', async () => {
  const owner = 'gallerymigration';
  for (const [kind, recordId] of [
    ['items', 'a2222222-2222-4222-8222-222222222222'],
    ['logs', 'a3333333-3333-4333-8333-333333333333'],
  ] as const) {
    const response = await call(`/${kind}/${recordId}/photos`, owner);
    expect(response.status).toBe(200);
    const { gallery } = (await response.json()) as {
      gallery: import('../src/shared/photo-gallery').PhotoGallery;
    };
    expect(gallery.entries).toHaveLength(1);
    expect(gallery.coverId).toBe(gallery.entries[0].id);
    expect(gallery.entries[0].source.available).toBe(true);
    expect((await call(`/${kind}/${recordId}/photos/${gallery.coverId}`, owner)).status).toBe(200);
    expect((await call(`/${kind}/${recordId}/photos/${gallery.coverId}`, 'gallerystranger')).status).toBe(
      404,
    );
  }
  const trashedId = 'a4444444-4444-4444-8444-444444444444';
  expect((await call(`/items/${trashedId}/photos`, owner)).status).toBe(404);
  await platform.env.DB.prepare('UPDATE items SET trashed_at=NULL WHERE id=?').bind(trashedId).run();
  expect(
    (
      (await call(`/items/${trashedId}/photos`, owner).then((r) => r.json())) as {
        gallery: import('../src/shared/photo-gallery').PhotoGallery;
      }
    ).gallery.entries,
  ).toHaveLength(1);
});

async function galleryUpload(
  owner: string,
  kind: 'items' | 'logs',
  recordId: string,
  key: string,
  revision: number,
  bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
) {
  return app.request(
    `https://worth.test/api/${kind}/${recordId}/photos/${key}`,
    {
      method: 'PUT',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'image/png',
        'X-Worth-Gallery-Revision': String(revision),
      },
      body: bytes,
    },
    platform.env,
    platform.ctx,
  );
}
test('galleries preserve original bytes while captions, arrows, order and cover have revision checks', async () => {
  const owner = 'galleryowner',
    list = await archiveCollection(owner, 'Photos'),
    item = await archiveItem(owner, list.id, 'A memory'),
    a = crypto.randomUUID(),
    b = crypto.randomUUID();
  const first = await galleryUpload(owner, 'items', item.id, a, 0);
  expect(first.status).toBe(200);
  const second = await galleryUpload(
    owner,
    'items',
    item.id,
    b,
    1,
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 2]),
  );
  expect(second.status).toBe(200);
  const album = ((await second.json()) as { gallery: import('../src/shared/photo-gallery').PhotoGallery })
    .gallery;
  expect(album.entries.map((entry) => entry.id)).toEqual([a, b]);
  expect(album.coverId).toBe(b);
  const entries = album.entries.map(({ id, caption, arrows }) => ({ id, caption, arrows })).reverse();
  entries[1].caption = 'A separate caption';
  entries[1].arrows = [
    { id: crypto.randomUUID(), fromX: 0.1, fromY: 0.2, toX: 0.8, toY: 0.9, label: 'This corner' },
  ];
  expect(
    (await call(`/items/${item.id}/photos`, owner, 'PUT', { expectedRevision: 2, entries, coverId: a }))
      .status,
  ).toBe(200);
  expect(
    (await call(`/items/${item.id}/photos`, owner, 'PUT', { expectedRevision: 2, entries, coverId: b }))
      .status,
  ).toBe(409);
  // A guessed future revision must never apply a stale snapshot across another write.
  expect(
    (await call(`/items/${item.id}/photos`, owner, 'PUT', { expectedRevision: 4, entries, coverId: b }))
      .status,
  ).toBe(409);
  expect((await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), 4)).status).toBe(409);
  const original = await call(`/items/${item.id}/photos/${a}`, owner);
  expect(Array.from(new Uint8Array(await original.arrayBuffer()))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(
    Array.from(new Uint8Array(await (await call(`/items/${item.id}/photo`, owner)).arrayBuffer())),
  ).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const saved = (await call(`/items/${item.id}/photos`, owner).then((r) => r.json())) as {
    gallery: import('../src/shared/photo-gallery').PhotoGallery;
  };
  expect(saved.gallery.entries[1]).toMatchObject({
    id: a,
    caption: 'A separate caption',
    arrows: entries[1].arrows,
  });
  expect(
    ((await call(`/items/${item.id}`, owner).then((r) => r.json())) as { item: Item }).item.decision,
  ).toBeNull();
  expect((await call(`/items/${item.id}/photos`, 'galleryother')).status).toBe(404);
  expect((await call(`/items/${item.id}/photos`, null)).status).toBe(401);
  expect(
    (
      await call(`/items/${item.id}/photos`, owner, 'PUT', {
        expectedRevision: 3,
        entries: entries.slice(1),
        coverId: a,
      })
    ).status,
  ).toBe(409);
});

test('photo uploads retry immutably, removed originals cannot resurrect, and capacity is atomic', async () => {
  const owner = 'galleryretries',
    list = await archiveCollection(owner, 'Retry photos'),
    item = await archiveItem(owner, list.id, 'A memory'),
    key = crypto.randomUUID();
  const responses = await Promise.all([
    galleryUpload(owner, 'items', item.id, key, 0),
    galleryUpload(owner, 'items', item.id, key, 0),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(
    (
      await galleryUpload(
        owner,
        'items',
        item.id,
        key,
        0,
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]),
      )
    ).status,
  ).toBe(409);
  expect(
    (await call(`/items/${item.id}/photos/${key}`, owner, 'DELETE', { expectedRevision: 0 })).status,
  ).toBe(409);
  expect(
    (await call(`/items/${item.id}/photos/${key}`, owner, 'DELETE', { expectedRevision: 1 })).status,
  ).toBe(200);
  expect((await galleryUpload(owner, 'items', item.id, key, 0)).status).toBe(410);
  expect((await call(`/items/${item.id}/photo`, owner)).status).toBe(404);
  let revision = 2;
  for (let i = 0; i < 11; i++) {
    expect((await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), revision++)).status).toBe(200);
  }
  const race = await Promise.all([
    galleryUpload(owner, 'items', item.id, crypto.randomUUID(), revision),
    galleryUpload(owner, 'items', item.id, crypto.randomUUID(), revision),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
  const album = (
    (await call(`/items/${item.id}/photos`, owner).then((r) => r.json())) as {
      gallery: import('../src/shared/photo-gallery').PhotoGallery;
    }
  ).gallery;
  expect(album.entries).toHaveLength(12);
  await expect(
    platform.env.DB.prepare(
      'INSERT INTO photo_assets(id,owner_id,item_id,content_type,created_at) VALUES(?,?,?,?,?)',
    )
      .bind(crypto.randomUUID(), owner, item.id, 'image/png', Date.now())
      .run(),
  ).rejects.toThrow('photo gallery full');
  await expect(
    platform.env.DB.prepare(
      'INSERT INTO photo_assets(id,owner_id,item_id,content_type,created_at) VALUES(?,?,?,?,?)',
    )
      .bind(crypto.randomUUID(), 'gallerywrongowner', item.id, 'image/png', Date.now())
      .run(),
  ).rejects.toThrow('photo owner changed');

  expect((await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), album.revision)).status).toBe(
    409,
  );
  await call(`/items/${item.id}`, owner, 'DELETE');
  expect((await call(`/items/${item.id}/photos/${album.entries[0].id}`, owner)).status).toBe(404);
});

async function importGalleryFile(owner: string, file: unknown) {
  return app.request(
    'https://worth.test/api/import',
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(file),
    },
    platform.env,
    platform.ctx,
  );
}
test('version 5 gallery backups preserve all originals and independent metadata, while records-only restores retain missing-source recovery', async () => {
  const owner = 'gallerybackup',
    list = await archiveCollection(owner, 'Photo keepsakes'),
    item = await archiveItem(owner, list.id, 'A memory'),
    a = crypto.randomUUID(),
    b = crypto.randomUUID();
  expect((await galleryUpload(owner, 'items', item.id, a, 0)).status).toBe(200);
  expect(
    (await galleryUpload(owner, 'items', item.id, b, 1, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 2])))
      .status,
  ).toBe(200);
  const entries = [
    { id: b, caption: 'Second first', arrows: [] },
    {
      id: a,
      caption: 'Earlier original',
      arrows: [{ id: crypto.randomUUID(), fromX: 0.2, fromY: 0.2, toX: 0.8, toY: 0.8, label: 'Look here' }],
    },
  ];
  expect(
    (await call(`/items/${item.id}/photos`, owner, 'PUT', { expectedRevision: 2, entries, coverId: a }))
      .status,
  ).toBe(200);
  const response = await call('/export/backup', owner);
  expect(response.status).toBe(200);
  const backup = archiveFile.parse(await response.json());
  expect(backup.schemaVersion).toBe(8);
  expect(backup.photoAssets).toHaveLength(2);
  expect(backup.photos.map((p) => p.kind)).toEqual(['asset', 'asset']);
  expect(backup.items[0].gallery.map((entry) => entry.caption)).toEqual(['Second first', 'Earlier original']);
  expect((await importGalleryFile('galleryrecipient', backup)).status).toBe(201);
  const round = archiveFile.parse(await call('/export/backup', 'galleryrecipient').then((r) => r.json()));
  expect(round.photoAssets).toHaveLength(2);
  expect(
    round.photoAssets.every(
      (source) => source.available && !backup.photoAssets.some((old) => old.id === source.id),
    ),
  ).toBe(true);
  expect(round.items[0].gallery.map((entry) => entry.caption)).toEqual(['Second first', 'Earlier original']);
  expect(round.items[0].gallery[1].arrows[0]).toMatchObject({ fromX: 0.2, toX: 0.8, label: 'Look here' });
  expect(round.items[0].coverPhotoId).toBe(round.items[0].gallery[1].id);
  expect(
    Array.from(
      new Uint8Array(
        await (await call(`/items/${round.items[0].id}/photo`, 'galleryrecipient')).arrayBuffer(),
      ),
    ),
  ).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const records = archiveFile.parse(await call('/export/records', owner).then((r) => r.json()));
  expect((await importGalleryFile('gallerytext', records)).status).toBe(201);
  const text = archiveFile.parse(await call('/export/backup', 'gallerytext').then((r) => r.json()));
  expect(text.photoAssets.every((source) => !source.available)).toBe(true);
  expect(text.photos).toEqual([]);
  expect(text.items[0].gallery[1].caption).toBe('Earlier original');
  expect(
    (await call(`/items/${text.items[0].id}/photos/${text.items[0].gallery[0].id}`, 'gallerytext')).status,
  ).toBe(404);
  expect((await call(`/items/${text.items[0].id}/photo`, 'gallerytext')).status).toBe(404);
  const corrupt = {
    ...backup,
    photos: backup.photos.map((photo, index) =>
      index ? photo : { ...photo, data: btoa(String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10, 99)) },
    ),
  };
  expect((await importGalleryFile('gallerycorrupt', corrupt)).status).toBe(400);
  expect(
    ((await call('/lists', 'gallerycorrupt').then((r) => r.json())) as { lists: unknown[] }).lists,
  ).toEqual([]);
  const legacy = {
    ...backup,
    schemaVersion: 1,
    photoAssets: [],
    items: backup.items.map((record) => ({ ...record, gallery: [], coverPhotoId: null })),
    photos: [{ ...backup.photos.find((photo) => photo.id === a)!, kind: 'item', id: item.id }],
  };
  expect((await importGalleryFile('gallerylegacy', legacy)).status).toBe(201);
  const oldRound = archiveFile.parse(await call('/export/backup', 'gallerylegacy').then((r) => r.json()));
  expect(oldRound.photoAssets).toHaveLength(1);
  expect(oldRound.items[0].coverPhotoId).toBe(oldRound.photoAssets[0].id);
  expect((await call(`/items/${oldRound.items[0].id}/photo`, 'gallerylegacy', 'DELETE')).status).toBe(204);
  expect((await call(`/items/${oldRound.items[0].id}/photo`, 'gallerylegacy')).status).toBe(404);
  const after = archiveFile.parse(await call('/export/backup', 'gallerylegacy').then((r) => r.json()));
  expect(after.photoAssets).toEqual([]);
  expect(after.items[0].gallery).toEqual([]);
});

test('a full gallery can save every allowed Unicode caption and arrow label without an accidental body-size limit', async () => {
  const owner = 'gallerytextbounds',
    list = await archiveCollection(owner, 'Many captions'),
    item = await archiveItem(owner, list.id, 'A memory');
  for (let revision = 0; revision < 12; revision++)
    expect((await galleryUpload(owner, 'items', item.id, crypto.randomUUID(), revision)).status).toBe(200);
  const { gallery } = (await call(`/items/${item.id}/photos`, owner).then((r) => r.json())) as {
    gallery: import('../src/shared/photo-gallery').PhotoGallery;
  };
  const entries = gallery.entries.map(({ id }) => ({
    id,
    caption: '눈'.repeat(500),
    arrows: Array.from({ length: 6 }, () => ({
      id: crypto.randomUUID(),
      fromX: 0.2,
      fromY: 0.2,
      toX: 0.7,
      toY: 0.7,
      label: '너'.repeat(120),
    })),
  }));
  const body = { expectedRevision: 12, entries, coverId: entries[0].id };
  expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(32768);
  const response = await call(`/items/${item.id}/photos`, owner, 'PUT', body);
  expect(response.status).toBe(200);
  const saved = (await response.json()) as { gallery: import('../src/shared/photo-gallery').PhotoGallery };
  expect(
    saved.gallery.entries.every(
      (entry) =>
        entry.caption.length === 500 &&
        entry.arrows.length === 6 &&
        entry.arrows.every((arrow) => arrow.label.length === 120),
    ),
  ).toBe(true);
});

test('collection cover versions reject stale replacements and removals while exact retries cannot resurrect a removed cover', async () => {
  const owner = 'collageowner';
  const list = (
    (await (await call('/lists', owner, 'POST', { name: 'Collage', kind: 'collection' })).json()) as {
      list: ListDetail;
    }
  ).list;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pJ8AAAAASUVORK5CYII=',
    'base64',
  );
  const other = Buffer.concat([png, Buffer.from('other')]);
  const put = (bytes: Buffer, version: string, user = owner, method = 'PUT') =>
    app.request(
      `https://worth.test/api/lists/${list.id}/cover`,
      {
        method,
        headers: {
          Cookie: `preview_user=${user}`,
          Origin: 'https://worth.test',
          'Content-Type': 'image/png',
          'X-Worth-Cover-Revision': version,
        },
        ...(method === 'PUT' ? { body: new Uint8Array(bytes) } : {}),
      },
      platform.env,
      platform.ctx,
    );
  const start = String(list.coverRevision ?? 0);
  expect((await put(png, 'NaN')).status).toBe(400);
  expect((await put(png, start, 'collagestranger')).status).toBe(404);
  const initial = await put(png, start);
  expect(initial.status).toBe(200);
  const saved = (await initial.json()) as { revision: number };
  expect(saved.revision).toBe(1);
  expect((await put(png, start)).status).toBe(200);
  expect((await put(other, start)).status).toBe(409);
  expect((await put(png, start, owner, 'DELETE')).status).toBe(409);
  // A collection timestamp may repeat after other writes or clock changes; its cover counter cannot.
  await platform.env.DB.prepare('UPDATE lists SET updated_at=? WHERE id=?')
    .bind(list.updatedAt, list.id)
    .run();
  expect((await put(other, start)).status).toBe(409);
  await call(`/lists/${list.id}`, owner, 'PATCH', { name: 'Renamed while arranging' });
  expect(
    ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list.coverRevision,
  ).toBe(1);
  const concurrent = await Promise.all([
    put(other, String(saved.revision)),
    put(Buffer.concat([png, Buffer.from('third')]), String(saved.revision)),
  ]);
  expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
  const current = ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list;
  const staleGet = await app.request(
    `https://worth.test/api/lists/${list.id}/cover`,
    { headers: { Cookie: `preview_user=${owner}`, 'X-Worth-Cover-Revision': start } },
    platform.env,
    platform.ctx,
  );
  expect(staleGet.status).toBe(404);
  expect((await put(png, String(current.coverRevision ?? 0), owner, 'DELETE')).status).toBe(204);
  expect((await put(png, start)).status).toBe(409);
  expect((await call(`/lists/${list.id}/cover`, owner)).status).toBe(404);
  expect((await put(png, String((current.coverRevision ?? 0) + 100000))).status).toBe(409);
  const latest = ((await (await call(`/lists/${list.id}`, owner)).json()) as { list: ListDetail }).list;
  expect((await put(png, String(latest.coverRevision ?? 0))).status).toBe(200);
  const backup = (await (await call('/export/backup', owner)).json()) as ArchiveFile;
  // Cover bytes already use the existing full-backup representation.
  expect(backup.photos.some((p) => p.kind === 'list' && p.id === list.id)).toBe(true);
  await call(`/lists/${list.id}`, owner, 'DELETE');
  expect((await put(png, String(latest.coverRevision ?? 0))).status).toBe(404);
  expect((await call(`/lists/${list.id}/cover`, owner)).status).toBe(404);
});

test('a cover write rolls back if its collection is trashed between the owner read and transaction', async () => {
  const owner = 'collagerace';
  const list = (
    (await (await call('/lists', owner, 'POST', { name: 'Cover race', kind: 'collection' })).json()) as {
      list: ListDetail;
    }
  ).list;
  const db = platform.env.DB;
  let raced = false;
  const wrapped = new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return async (statements: D1PreparedStatement[]) => {
          raced = true;
          await target.prepare('UPDATE lists SET trashed_at=1 WHERE id=?').bind(list.id).run();
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const response = await app.request(
    `https://worth.test/api/lists/${list.id}/cover`,
    {
      method: 'PUT',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'image/png',
        'X-Worth-Cover-Revision': String(list.coverRevision ?? 0),
      },
      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    },
    { ...platform.env, DB: wrapped },
    platform.ctx,
  );
  expect(raced).toBe(true);
  expect(response.status).toBe(409);
  expect(await db.prepare('SELECT 1 FROM list_photos WHERE list_id=?').bind(list.id).first()).toBeNull();
});

function boardBody(reference?: { kind: 'item' | 'log'; id: string }) {
  return {
    kind: 'trip' as const,
    name: 'My trip',
    introduction: 'PRIVATE introduction',
    from: '2026-10-01',
    until: '2026-10-02',
    archived: false,
    entries: [
      {
        id: crypto.randomUUID(),
        name: 'My entered stop',
        note: 'PRIVATE stop note',
        day: '2026-10-02',
        time: '19:00',
        location: 'Entered location',
        reference: reference ?? null,
        referenceMissing: false,
        photo: false,
      },
    ],
  };
}
async function createTestBoard(
  owner: string,
  body: unknown,
  key: string = crypto.randomUUID(),
  db = platform.env.DB,
) {
  return app.request(
    'https://worth.test/api/boards',
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
    { ...platform.env, DB: db },
    platform.ctx,
  );
}
type BoardResult = { board: import('../src/shared/memory-boards').BoardView };

test('boards are owner scoped, exactly retryable and never change linked calls, notes or ranks', async () => {
  const owner = 'boardowner',
    list = await archiveCollection(owner, 'Places'),
    item = await archiveItem(owner, list.id, 'Current source', {
      note: 'Source private note',
      decision: 'meh',
    }),
    foreignList = await archiveCollection('boardother', 'Other'),
    foreign = await archiveItem('boardother', foreignList.id, 'Foreign'),
    body = boardBody({ kind: 'item', id: item.id }),
    key = crypto.randomUUID();
  expect((await call('/boards', null)).status).toBe(401);
  const creates = await Promise.all([createTestBoard(owner, body, key), createTestBoard(owner, body, key)]);
  expect(creates.map((r) => r.status)).toEqual([201, 201]);
  const { board } = (await creates[0].json()) as BoardResult;
  expect(board.entries[0].name).toBe('My entered stop');
  expect(board.sources).toHaveLength(1);
  expect(board.sources[0]).toMatchObject({ id: item.id, title: 'Current source', listId: list.id });
  expect(JSON.stringify(board.sources)).not.toContain('Source private note');
  expect((await call(`/boards/${key}`, 'boardother')).status).toBe(404);
  expect(await call('/boards', 'boardother').then((r) => r.json())).toEqual({ boards: [] });
  expect((await createTestBoard('boardother', body, key)).status).toBe(409);
  expect((await createTestBoard(owner, { ...body, name: 'Different' }, key)).status).toBe(409);
  expect((await createTestBoard(owner, boardBody({ kind: 'item', id: foreign.id }))).status).toBe(409);
  const changed = { ...body, name: 'Reviewed name' };
  expect((await call(`/boards/${key}`, owner, 'PUT', { board: changed, expectedRevision: 0 })).status).toBe(
    200,
  );
  expect((await call(`/boards/${key}`, owner, 'PUT', { board: body, expectedRevision: 0 })).status).toBe(409);
  expect((await call(`/boards/${key}`, owner, 'PUT', { board: body, expectedRevision: 500 })).status).toBe(
    409,
  );
  const original = ((await call(`/items/${item.id}`, owner).then((r) => r.json())) as { item: Item }).item;
  expect(original).toMatchObject({ decision: 'meh', note: 'Source private note' });
  expect(await call('/boards', owner).then((r) => r.json())).toMatchObject({
    boards: [{ id: key, revision: 1, name: 'Reviewed name', entryCount: 1, updatedAt: expect.any(Number) }],
  });
  expect((await call(`/boards/${key}`, owner, 'DELETE', { expectedRevision: 0 })).status).toBe(409);
  expect((await call(`/boards/${key}`, owner, 'DELETE', { expectedRevision: 1 })).status).toBe(204);
  expect((await call(`/boards/${key}`, owner, 'DELETE', { expectedRevision: 1 })).status).toBe(204);
  expect((await createTestBoard(owner, body, key)).status).toBe(410);
  expect((await call(`/items/${item.id}`, owner)).status).toBe(200);
  const visit = (
    (await call(`/lists/${list.id}/logs`, owner, 'POST', {
      itemId: item.id,
      title: 'Entered visit',
      happenedOn: '2026-10-02',
      note: 'PRIVATE visit note',
    }).then((r) => r.json())) as { log: Log }
  ).log;
  const visitBoard = (
    (await (await createTestBoard(owner, boardBody({ kind: 'log', id: visit.id }))).json()) as BoardResult
  ).board;
  expect(visitBoard.sources[0]).toMatchObject({
    kind: 'log',
    id: visit.id,
    title: 'Entered visit',
    listId: list.id,
  });
  expect(JSON.stringify(visitBoard.sources)).not.toContain('PRIVATE visit note');
  expect((await createTestBoard('boardother', boardBody({ kind: 'log', id: visit.id }))).status).toBe(409);
});

test('boards retain entered stops through source moves and Trash while rejecting new unavailable references', async () => {
  const owner = 'boardmissing',
    list = await archiveCollection(owner, 'First'),
    other = await archiveCollection(owner, 'Second'),
    item = await archiveItem(owner, list.id, 'Saved source'),
    body = boardBody({ kind: 'item', id: item.id });
  const { board } = (await (await createTestBoard(owner, body)).json()) as BoardResult;
  expect(
    (await archiveAction(list.id, owner, { action: 'move', itemIds: [item.id], destinationId: other.id }))
      .status,
  ).toBe(200);
  let view = ((await call(`/boards/${board.id}`, owner).then((r) => r.json())) as BoardResult).board;
  expect(view.sources[0].listId).toBe(other.id);
  await call(`/items/${item.id}`, owner, 'DELETE');
  view = ((await call(`/boards/${board.id}`, owner).then((r) => r.json())) as BoardResult).board;
  expect(view.sources).toEqual([]);
  expect(view.entries).toEqual(body.entries);
  expect(
    (
      await call(`/boards/${board.id}`, owner, 'PUT', {
        board: { ...body, introduction: 'Still editable' },
        expectedRevision: 0,
      })
    ).status,
  ).toBe(200);
  expect((await createTestBoard(owner, body)).status).toBe(409);
  const altered = { ...body, entries: [{ ...body.entries[0], id: crypto.randomUUID() }] };
  expect(
    (await call(`/boards/${board.id}`, owner, 'PUT', { board: altered, expectedRevision: 1 })).status,
  ).toBe(409);
  expect(
    (await call('/trash/restore', owner, 'POST', { entries: [{ kind: 'item', id: item.id }] })).status,
  ).toBe(200);
  expect(
    ((await call(`/boards/${board.id}`, owner).then((r) => r.json())) as BoardResult).board.sources[0].id,
  ).toBe(item.id);
});

test('version six backup remaps boards and row identities and preserves missing-source text and old files', async () => {
  const owner = 'boardbackup',
    list = await archiveCollection(owner, 'Board originals'),
    item = await archiveItem(owner, list.id, 'Linked source'),
    missing = await archiveItem(owner, list.id, 'Unavailable'),
    body = boardBody({ kind: 'item', id: item.id });
  body.entries.push({
    ...body.entries[0],
    id: crypto.randomUUID(),
    name: 'Missing but entered',
    reference: { kind: 'item', id: missing.id },
  });
  const { board } = (await (await createTestBoard(owner, body)).json()) as BoardResult;
  await call(`/items/${missing.id}`, owner, 'DELETE');
  const backup = (await call('/export/records', owner).then((r) => r.json())) as ArchiveFile;
  expect(backup.schemaVersion).toBe(8);
  expect(archiveFile.safeParse(backup).success).toBe(true);
  expect(backup.boards[0].entries[1]).toMatchObject({
    reference: null,
    referenceMissing: true,
    name: 'Missing but entered',
  });
  const old = { ...backup, schemaVersion: 5, boards: undefined };
  expect(archiveFile.parse(old).boards).toEqual([]);
  const invalid = structuredClone(backup);
  invalid.boards[0].entries[0].reference!.id = crypto.randomUUID();
  expect(archiveFile.safeParse(invalid).success).toBe(false);
  const key = crypto.randomUUID();
  expect((await restoreWithTemplates('boardrestored', backup, key)).status).toBe(201);
  expect((await restoreWithTemplates('boardrestored', backup, key)).status).toBe(201);
  const round = (await call('/export/records', 'boardrestored').then((r) => r.json())) as ArchiveFile;
  expect(round.boards).toHaveLength(1);
  expect(round.boards[0].id).not.toBe(board.id);
  expect(round.boards[0].entries[0].id).not.toBe(body.entries[0].id);
  expect(round.boards[0].entries[0].reference?.id).toBe(round.items[0].id);
  expect(round.boards[0].revision).toBe(0);
  expect(round.boards[0].entries[1]).toMatchObject({ reference: null, referenceMissing: true });
  expect(
    (
      await app.request(
        'https://worth.test/api/data',
        {
          method: 'DELETE',
          headers: {
            Cookie: 'preview_user=boardrestored',
            Origin: 'https://worth.test',
            'X-Worth-Confirmation': 'delete-all-worth-data',
          },
        },
        platform.env,
        platform.ctx,
      )
    ).status,
  ).toBe(204);
  expect(await call('/boards', 'boardrestored').then((r) => r.json())).toEqual({ boards: [] });
});

test('board restore capacity rolls back every record and can retry the same receipt after space is freed', async () => {
  const owner = 'boardcapacity',
    db = platform.env.DB,
    body = boardBody(),
    now = Date.now();
  const ids = Array.from({ length: 96 }, () => crypto.randomUUID());
  await db.batch(
    ids.map((id) =>
      db
        .prepare(
          'INSERT INTO memory_boards(id,owner_id,body_json,revision,create_hash,created_at,updated_at) VALUES(?,?,?,0,?,?,?)',
        )
        .bind(id, owner, JSON.stringify(body), 'capacity', now, now),
    ),
  );
  const source = 'boardcapacitysource';
  for (let i = 0; i < 5; i++)
    expect((await createTestBoard(source, { ...body, name: `Restore ${i}` })).status).toBe(201);
  await archiveCollection(source, 'Atomic collection');
  const file = (await call('/export/records', source).then((r) => r.json())) as ArchiveFile,
    key = crypto.randomUUID();
  expect((await restoreWithTemplates(owner, file, key)).status).toBe(409);
  expect(((await call('/lists', owner).then((r) => r.json())) as { lists: unknown[] }).lists).toHaveLength(0);
  expect(((await call('/boards', owner).then((r) => r.json())) as { boards: unknown[] }).boards).toHaveLength(
    96,
  );
  await call(`/boards/${ids[0]}`, owner, 'DELETE', { expectedRevision: 0 });
  expect((await restoreWithTemplates(owner, file, key)).status).toBe(201);
  expect((await restoreWithTemplates(owner, file, key)).status).toBe(201);
  expect(((await call('/boards', owner).then((r) => r.json())) as { boards: unknown[] }).boards).toHaveLength(
    100,
  );
  expect((await createTestBoard(owner, body)).status).toBe(409);
});

test('board source ownership is rechecked inside the transaction and large Unicode drafts fit the bounded request', async () => {
  const owner = 'boardrace',
    list = await archiveCollection(owner, 'Race'),
    item = await archiveItem(owner, list.id, 'Source'),
    db = platform.env.DB;
  let raced = false;
  const wrapped = new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return async (statements: D1PreparedStatement[]) => {
          raced = true;
          await target.prepare('UPDATE items SET trashed_at=1 WHERE id=?').bind(item.id).run();
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const body = boardBody({ kind: 'item', id: item.id });
  expect((await createTestBoard(owner, body, crypto.randomUUID(), wrapped)).status).toBe(409);
  expect(raced).toBe(true);
  expect(await call('/boards', owner).then((r) => r.json())).toEqual({ boards: [] });
  const wide = {
    ...boardBody(),
    name: '界'.repeat(80),
    introduction: '界'.repeat(2000),
    entries: Array.from({ length: 40 }, () => ({
      ...boardBody().entries[0],
      name: '界'.repeat(120),
      note: '界'.repeat(1000),
      location: '界'.repeat(240),
    })),
  };
  expect((await createTestBoard(owner, wide)).status).toBe(201);
});

test('client-chosen board and gallery identities cannot collide with other backup records', async () => {
  const owner = 'boardidentities',
    list = await archiveCollection(owner, 'Identity'),
    item = await archiveItem(owner, list.id, 'Kept');
  expect((await createTestBoard(owner, boardBody(), list.id)).status).toBe(409);
  expect((await createTestBoard(owner, boardBody(), item.id)).status).toBe(409);
  expect((await galleryUpload(owner, 'items', item.id, list.id, 0)).status).toBe(409);
  expect((await galleryUpload(owner, 'items', item.id, item.id, 0)).status).toBe(409);
  const id = crypto.randomUUID();
  expect((await galleryUpload(owner, 'items', item.id, id, 0)).status).toBe(200);
  expect((await createTestBoard(owner, boardBody(), id)).status).toBe(409);
  expect(archiveFile.safeParse(await call('/export/records', owner).then((r) => r.json())).success).toBe(
    true,
  );
});

// Add receiptInput, emptyReceipt, receiptLineSuggestions, receiptDigest imports from shared/receipts.
function receiptBodyForTest() {
  return receiptInput.parse({
    ...emptyReceipt().current,
    name: 'Reviewed receipt',
    day: '2026-10-01',
    lines: receiptLineSuggestions('Coffee 4.00\nA book 18.00'),
  });
}
async function receiptPost(
  owner: string,
  input: unknown,
  key: string = crypto.randomUUID(),
  file: File | null = null,
  db = platform.env.DB,
) {
  const form = new FormData();
  form.set('receipt', JSON.stringify(input));
  if (file) form.set('attachment', file);
  return app.request(
    'https://worth.test/api/receipts',
    {
      method: 'POST',
      headers: { Cookie: `preview_user=${owner}`, Origin: 'https://worth.test', 'Idempotency-Key': key },
      body: form,
    },
    { ...platform.env, DB: db },
    platform.ctx,
  );
}
const receiptTestImage = () =>
  new File(
    [
      Uint8Array.from(
        atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD/UAAAAASUVORK5CYII='),
        (c) => c.charCodeAt(0),
      ),
    ],
    'reviewed.png',
    { type: 'image/png' },
  );
type ReceiptResult = { receipt: import('../src/shared/receipts').ReceiptView };

test('receipt reviews atomically link existing records and create only explicitly named unranked records, with exact concurrent retries', async () => {
  const owner = 'receiptowner',
    list = await archiveCollection(owner, 'Kept'),
    existing = await archiveItem(owner, list.id, 'Existing', {
      decision: 'meh',
      note: 'PRIVATE source note',
    }),
    input = receiptBodyForTest(),
    created = crypto.randomUUID(),
    key = crypto.randomUUID(),
    file = receiptTestImage();
  input.lines[0].mapping = { mode: 'existing', itemId: existing.id };
  input.lines[0].amount = '$4.00 as written';
  input.lines[1].mapping = {
    mode: 'create',
    itemId: created,
    listId: list.id,
    title: 'My entered book name',
  };
  input.attachment = { contentType: 'image/png', digest: await receiptDigest(file), available: true };
  const responses = await Promise.all([
    receiptPost(owner, input, key, file),
    receiptPost(owner, input, key, file),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  const { receipt } = (await responses[0].json()) as ReceiptResult;
  expect(receipt.id).toBe(key);
  expect(receipt.sources).toHaveLength(2);
  expect(JSON.stringify(receipt.sources)).not.toContain('PRIVATE source note');
  expect(receipt.lines[0].amount).toBe('$4.00 as written');
  const item = ((await call(`/items/${created}`, owner).then((r) => r.json())) as { item: Item }).item;
  expect(item).toMatchObject({
    title: 'My entered book name',
    decision: null,
    note: '',
    type: '',
    hasPhoto: false,
  });
  expect(
    ((await call(`/lists/${list.id}`, owner).then((r) => r.json())) as { list: ListDetail }).list.rankedIds,
  ).toEqual([]);
  expect(
    ((await call(`/items/${existing.id}`, owner).then((r) => r.json())) as { item: Item }).item,
  ).toMatchObject({ decision: 'meh', note: 'PRIVATE source note' });
  const attachment = await call(`/receipts/${key}/attachment`, owner);
  expect(attachment.status).toBe(200);
  expect(new Uint8Array(await attachment.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()));
  expect((await receiptPost(owner, { ...input, name: 'Changed metadata' }, key, file)).status).toBe(409);
  expect((await receiptPost('receiptother', input, key, file)).status).toBe(409);
  expect((await call(`/receipts/${key}`, 'receiptother')).status).toBe(404);
  expect((await call(`/receipts/${key}/attachment`, 'receiptother')).status).toBe(404);
  expect(await call('/receipts', 'receiptother').then((r) => r.json())).toEqual({ receipts: [] });
  expect((await call(`/receipts/${key}`, owner, 'DELETE')).status).toBe(204);
  expect((await call(`/receipts/${key}`, owner, 'DELETE')).status).toBe(204);
  expect((await receiptPost(owner, input, key, file)).status).toBe(410);
  expect((await call(`/items/${created}`, owner)).status).toBe(200);
  expect((await call(`/items/${existing.id}`, owner)).status).toBe(200);
});

test('receipt uploads reject unreviewed, changed, oversized and invalid image copies and unavailable record choices', async () => {
  const owner = 'receiptvalidation',
    other = await archiveCollection('receiptforeign', 'Foreign'),
    foreign = await archiveItem('receiptforeign', other.id, 'Foreign'),
    input = receiptBodyForTest(),
    file = receiptTestImage();
  expect((await receiptPost(owner, input, crypto.randomUUID(), file)).status).toBe(400);
  input.attachment = { contentType: 'image/png', digest: '0'.repeat(64), available: true };
  expect((await receiptPost(owner, input, crypto.randomUUID(), file)).status).toBe(400);
  input.attachment.digest = await receiptDigest(file);
  expect((await receiptPost(owner, input)).status).toBe(400);
  input.attachment.available = false;
  expect((await receiptPost(owner, input, crypto.randomUUID(), file)).status).toBe(400);
  input.attachment = null;
  input.lines[0].mapping = { mode: 'existing', itemId: foreign.id };
  expect((await receiptPost(owner, input)).status).toBe(409);
  input.lines[0].mapping = {
    mode: 'create',
    itemId: crypto.randomUUID(),
    listId: other.id,
    title: 'Wrong owner',
  };
  expect((await receiptPost(owner, input)).status).toBe(409);
  const own = await archiveCollection(owner, 'Own');
  input.lines[0].mapping = {
    mode: 'create',
    itemId: crypto.randomUUID(),
    listId: own.id,
    title: 'No inferred dates',
  };
  await call(`/lists/${own.id}`, owner, 'PATCH', { archived: true });
  expect((await receiptPost(owner, input)).status).toBe(409);
  const identity = receiptBodyForTest();
  expect((await receiptPost(owner, identity, own.id)).status).toBe(409);
  const key = crypto.randomUUID();
  identity.lines[0].mapping = {
    mode: 'create',
    itemId: key,
    listId: own.id,
    title: 'Duplicate cross-kind identity',
  };
  expect((await receiptPost(owner, identity, key)).status).toBe(409);
  const huge = new File([new Uint8Array(900001)], 'too-large.png', { type: 'image/png' }),
    big = receiptBodyForTest();
  big.attachment = { contentType: 'image/png', digest: await receiptDigest(huge), available: true };
  expect((await receiptPost(owner, big, crypto.randomUUID(), huge)).status).toBe(400);
  expect(await call('/receipts', owner).then((r) => r.json())).toEqual({ receipts: [] });
});

test('receipt source checks share the transaction with every created record and attachment', async () => {
  const owner = 'receiptrace',
    list = await archiveCollection(owner, 'Race'),
    existing = await archiveItem(owner, list.id, 'Existing'),
    input = receiptBodyForTest(),
    created = crypto.randomUUID(),
    db = platform.env.DB;
  input.lines[0].mapping = { mode: 'existing', itemId: existing.id };
  input.lines[1].mapping = { mode: 'create', itemId: created, listId: list.id, title: 'Must roll back' };
  let raced = false;
  const wrapped = new Proxy(db, {
    get(target, key) {
      if (key === 'batch')
        return async (statements: D1PreparedStatement[]) => {
          if (!raced) {
            raced = true;
            await target.prepare('UPDATE items SET trashed_at=1 WHERE id=?').bind(existing.id).run();
          }
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  expect((await receiptPost(owner, input, crypto.randomUUID(), null, wrapped)).status).toBe(409);
  expect(raced).toBe(true);
  expect(await db.prepare('SELECT id FROM items WHERE id=?').bind(created).first()).toBeNull();
  expect(await call('/receipts', owner).then((r) => r.json())).toEqual({ receipts: [] });
});

test('version seven receipt backups preserve exact attachments, creation provenance and moved or missing source text', async () => {
  const owner = 'receiptbackup',
    list = await archiveCollection(owner, 'Original destination'),
    target = await archiveCollection(owner, 'Current destination'),
    input = receiptBodyForTest(),
    created = crypto.randomUUID(),
    missing = await archiveItem(owner, list.id, 'Later unavailable'),
    file = receiptTestImage();
  input.lines[0].mapping = { mode: 'create', itemId: created, listId: list.id, title: 'Created from review' };
  input.lines[1].mapping = { mode: 'existing', itemId: missing.id };
  input.attachment = { contentType: 'image/png', digest: await receiptDigest(file), available: true };
  const { receipt } = (await (
    await receiptPost(owner, input, crypto.randomUUID(), file)
  ).json()) as ReceiptResult;
  await archiveAction(list.id, owner, { action: 'move', itemIds: [created], destinationId: target.id });
  await call(`/items/${created}`, owner, 'PATCH', { title: 'Renamed after the receipt review' });
  await call(`/items/${missing.id}`, owner, 'DELETE');
  await call(`/lists/${list.id}`, owner, 'DELETE');
  const backup = archiveFile.parse(await call('/export/backup', owner).then((r) => r.json()));
  expect(backup.schemaVersion).toBe(8);
  expect(backup.photos.filter((p) => p.kind === 'receipt')).toHaveLength(1);
  expect(backup.receipts[0].lines[0]).toMatchObject({
    createdHere: true,
    createdName: 'Created from review',
    mapping: { mode: 'existing', itemId: created },
  });
  expect(backup.receipts[0].lines[1]).toMatchObject({
    referenceMissing: true,
    mapping: { mode: 'none' },
    label: 'A book 18.00',
  });
  const key = crypto.randomUUID();
  expect((await restoreWithTemplates('receiptrestored', backup, key)).status).toBe(201);
  expect((await restoreWithTemplates('receiptrestored', backup, key)).status).toBe(201);
  const round = archiveFile.parse(await call('/export/backup', 'receiptrestored').then((r) => r.json()));
  expect(round.receipts).toHaveLength(1);
  expect(round.receipts[0].id).not.toBe(receipt.id);
  expect(round.receipts[0].lines[0].id).not.toBe(input.lines[0].id);
  expect(round.receipts[0].lines[0].mapping).toEqual({ mode: 'existing', itemId: round.items[0].id });
  expect(round.receipts[0].lines[0].createdHere).toBe(true);
  expect(round.receipts[0].lines[0].createdName).toBe('Created from review');
  expect(round.items[0].title).toBe('Renamed after the receipt review');
  expect(round.photos.find((p) => p.kind === 'receipt')?.data).toBe(
    backup.photos.find((p) => p.kind === 'receipt')?.data,
  );
  const records = archiveFile.parse(await call('/export/records', owner).then((r) => r.json()));
  expect((await restoreWithTemplates('receipttextrestore', records)).status).toBe(201);
  const textOnly = archiveFile.parse(
    await call('/export/records', 'receipttextrestore').then((r) => r.json()),
  );
  expect(textOnly.receipts[0].attachment?.available).toBe(false);
  expect(textOnly.receipts[0].lines[1].referenceMissing).toBe(true);
  expect((await call(`/receipts/${textOnly.receipts[0].id}/attachment`, 'receipttextrestore')).status).toBe(
    404,
  );
  const old = { ...records, schemaVersion: 6, receipts: undefined };
  expect(archiveFile.parse(old).receipts).toEqual([]);
  expect(archiveFile.safeParse({ ...records, schemaVersion: 6 }).success).toBe(false);
});

test('receipt capacity rolls back a whole restore and its receipt, allowing the same retry after removal', async () => {
  const owner = 'receiptcapacity',
    db = platform.env.DB,
    input = receiptBodyForTest(),
    ids = Array.from({ length: 96 }, () => crypto.randomUUID());
  await db.batch(
    ids.map((id) =>
      db
        .prepare('INSERT INTO receipts(id,owner_id,body_json,creation_hash,created_at) VALUES(?,?,?,?,1)')
        .bind(id, owner, JSON.stringify(input), 'capacity'),
    ),
  );
  const source = 'receiptcapacitysource';
  for (let i = 0; i < 5; i++)
    expect((await receiptPost(source, { ...input, name: `Copy ${i}` })).status).toBe(201);
  await archiveCollection(source, 'Atomic collection');
  const file = archiveFile.parse(await call('/export/records', source).then((r) => r.json())),
    key = crypto.randomUUID();
  expect((await restoreWithTemplates(owner, file, key)).status).toBe(409);
  expect(((await call('/lists', owner).then((r) => r.json())) as { lists: unknown[] }).lists).toHaveLength(0);
  await call(`/receipts/${ids[0]}`, owner, 'DELETE');
  expect((await restoreWithTemplates(owner, file, key)).status).toBe(201);
  expect((await restoreWithTemplates(owner, file, key)).status).toBe(201);
  expect(
    ((await call('/receipts', owner).then((r) => r.json())) as { receipts: unknown[] }).receipts,
  ).toHaveLength(100);
  expect(
    (
      await app.request(
        'https://worth.test/api/data',
        {
          method: 'DELETE',
          headers: {
            Cookie: `preview_user=${owner}`,
            Origin: 'https://worth.test',
            'X-Worth-Confirmation': 'delete-all-worth-data',
          },
        },
        platform.env,
        platform.ctx,
      )
    ).status,
  ).toBe(204);
  expect(await call('/receipts', owner).then((r) => r.json())).toEqual({ receipts: [] });
});

async function planCreate(path: string, owner: string, body: unknown, key: string = crypto.randomUUID()) {
  return app.request(
    `https://worth.test/api${path}`,
    {
      method: 'POST',
      headers: {
        Cookie: `preview_user=${owner}`,
        Origin: 'https://worth.test',
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
    platform.env,
    platform.ctx,
  );
}
async function activityPlanList(owner: string) {
  const response = await call('/lists', owner, 'POST', { name: 'Training notes', kind: 'activity' });
  expect(response.status).toBe(201);
  return ((await response.json()) as { list: ListDetail }).list;
}
test('activity plans snapshot future targets, guard revisions and replay exactly without resurrecting removed records', async () => {
  const owner = 'planowner',
    list = await activityPlanList(owner),
    key = crypto.randomUUID();
  const targets = [
    {
      exercise: 'Run',
      sets: null,
      reps: null,
      weight: null,
      weightUnit: 'kg',
      restSeconds: 75,
      durationSeconds: 600,
      distance: 0,
      distanceUnit: 'km',
      note: 'Keep this a reference.',
    },
  ];
  const body = { title: 'A small loop', exercises: ['Run'], targets };
  const created = await planCreate(`/lists/${list.id}/routines`, owner, body, key);
  expect(created.status).toBe(201);
  const routine = ((await created.json()) as { routine: WorkoutRoutine }).routine;
  expect(routine.id).toBe(key);
  expect(routine.targets).toEqual(targets);
  expect(routine.revision).toBe(0);
  expect((await planCreate(`/lists/${list.id}/routines`, owner, body, key)).status).toBe(201);
  expect(
    (await planCreate(`/lists/${list.id}/routines`, owner, { ...body, title: 'Changed retry' }, key)).status,
  ).toBe(409);
  expect((await planCreate(`/lists/${list.id}/routines`, 'otherplanowner', body, key)).status).toBe(404);
  const start = {
      title: 'Morning',
      happenedOn: '2026-10-19',
      routineId: routine.id,
      expectedRoutineRevision: 0,
    },
    workoutKey = crypto.randomUUID();
  const first = await planCreate(`/lists/${list.id}/workouts`, owner, start, workoutKey);
  expect(first.status).toBe(201);
  const workout = ((await first.json()) as { workout: WorkoutSession }).workout;
  expect(workout.targets).toEqual(targets);
  expect(((await (await call(`/lists/${list.id}/logs`, owner)).json()) as { logs: Log[] }).logs).toHaveLength(
    0,
  );
  const updated = await call(`/routines/${routine.id}`, owner, 'PUT', {
    ...body,
    targets: [{ ...targets[0], durationSeconds: 900 }],
    expectedRevision: 0,
  });
  expect(updated.status).toBe(200);
  expect((await call(`/routines/${routine.id}`, owner, 'PUT', { ...body, expectedRevision: 0 })).status).toBe(
    409,
  );
  // Exact old creation retries resolve before reading today's source routine.
  const retry = await planCreate(`/lists/${list.id}/workouts`, owner, start, workoutKey);
  expect(retry.status).toBe(201);
  expect(((await retry.json()) as { workout: WorkoutSession }).workout.targets).toEqual(targets);
  const staleKey = crypto.randomUUID();
  expect((await planCreate(`/lists/${list.id}/workouts`, owner, start, staleKey)).status).toBe(409);
  expect(
    await platform.env.DB.prepare('SELECT id FROM activity_plan_receipts WHERE id=?').bind(staleKey).first(),
  ).toBeNull();
  const future = await planCreate(`/lists/${list.id}/workouts`, owner, {
    ...start,
    expectedRoutineRevision: 1,
  });
  expect(future.status).toBe(201);
  expect(((await future.json()) as { workout: WorkoutSession }).workout.targets?.[0].durationSeconds).toBe(
    900,
  );
  // An old client that omits targets preserves them.
  expect(
    (
      await call(`/routines/${routine.id}`, owner, 'PUT', {
        title: 'Renamed',
        exercises: ['Run'],
        expectedRevision: 1,
      })
    ).status,
  ).toBe(200);
  expect((await call(`/routines/${routine.id}?revision=1`, owner, 'DELETE')).status).toBe(409);
  expect((await call(`/routines/${routine.id}?revision=2`, owner, 'DELETE')).status).toBe(204);
  expect((await planCreate(`/lists/${list.id}/routines`, owner, body, key)).status).toBe(410);
  expect((await call(`/workouts/${workout.id}?revision=0`, owner, 'DELETE')).status).toBe(204);
  expect((await planCreate(`/lists/${list.id}/workouts`, owner, start, workoutKey)).status).toBe(410);
});

test('activity plans keep measurement-only exercises explicit and date changes invalidate old log editors', async () => {
  const owner = 'measurementowner',
    list = await activityPlanList(owner);
  const workoutResponse = await planCreate(`/lists/${list.id}/workouts`, owner, {
    title: 'Time only',
    happenedOn: '2026-10-19',
  });
  const workout = ((await workoutResponse.json()) as { workout: WorkoutSession }).workout;
  const input = {
    title: 'Walk',
    happenedOn: workout.happenedOn,
    workoutId: workout.id,
    exercise: true,
    measurements: [
      { name: 'Duration', value: 0, unit: 'seconds' },
      { name: 'Elevation', value: -4, unit: 'm' },
    ],
  };
  expect((await call(`/lists/${list.id}/logs`, owner, 'POST', { ...input, exercise: false })).status).toBe(
    400,
  );
  const created = await call(`/lists/${list.id}/logs`, owner, 'POST', input);
  expect(created.status).toBe(201);
  const log = ((await created.json()) as { log: Log }).log;
  expect(log.exercise).toBe(true);
  expect(log.exerciseSets).toEqual([]);
  expect(log.measurements).toEqual(input.measurements);
  const changed = await call(`/workouts/${workout.id}`, owner, 'PATCH', {
    happenedOn: '2026-10-20',
    expectedRevision: 0,
  });
  expect(changed.status).toBe(200);
  const moved = ((await (await call(`/lists/${list.id}/logs`, owner)).json()) as { logs: Log[] }).logs[0];
  expect(moved.happenedOn).toBe('2026-10-20');
  expect(moved.revision).toBe((log.revision ?? 0) + 1);
  expect(
    (await call(`/logs/${log.id}`, owner, 'PATCH', { note: 'Old edit', expectedRevision: log.revision }))
      .status,
  ).toBe(409);
  const patch = await call(`/logs/${log.id}`, owner, 'PATCH', {
    note: 'Preserve measurements',
    expectedRevision: moved.revision,
  });
  expect(patch.status).toBe(200);
  expect(((await patch.json()) as { log: Log }).log.measurements).toEqual(input.measurements);
  expect(
    (await call(`/workouts/${workout.id}`, owner, 'PATCH', { status: 'finished', expectedRevision: 0 }))
      .status,
  ).toBe(409);
  expect((await call(`/workouts/${workout.id}?revision=1`, owner, 'DELETE')).status).toBe(204);
  const retained = ((await (await call(`/lists/${list.id}/logs`, owner)).json()) as { logs: Log[] }).logs[0];
  expect(retained.workoutId).toBeNull();
  expect(retained.measurements).toEqual(input.measurements);
  const collection = await archiveCollection(owner, 'Private things'),
    item = await archiveItem(owner, collection.id, 'A thing');
  expect(
    (
      await call(`/lists/${collection.id}/logs`, owner, 'POST', {
        itemId: item.id,
        happenedOn: '2026-10-19',
        measurements: input.measurements,
      })
    ).status,
  ).toBe(400);
});

test('activity plans and aliases survive fresh-ID restore with literal measurements and separate snapshots', async () => {
  const owner = 'aliasowner',
    list = await activityPlanList(owner),
    group = { id: crypto.randomUUID(), name: 'Run', aliases: ['Jog', 'Easy run'] };
  expect(
    (
      await call(`/lists/${list.id}/exercise-aliases`, 'someoneelse', 'PUT', {
        expectedRevision: 0,
        groups: [group],
      })
    ).status,
  ).toBe(404);
  const first = await call(`/lists/${list.id}/exercise-aliases`, owner, 'PUT', {
    expectedRevision: 0,
    groups: [group],
  });
  expect(first.status).toBe(200);
  // Lost response, exact current content: acknowledge without incrementing the revision.
  const repeat = await call(`/lists/${list.id}/exercise-aliases`, owner, 'PUT', {
    expectedRevision: 0,
    groups: [group],
  });
  expect(repeat.status).toBe(200);
  expect(((await repeat.json()) as { list: ListDetail }).list.exerciseAliasRevision).toBe(1);
  expect(
    (await call(`/lists/${list.id}/exercise-aliases`, owner, 'PUT', { expectedRevision: 0, groups: [] }))
      .status,
  ).toBe(409);
  expect(
    (
      await call(`/lists/${list.id}/exercise-aliases`, owner, 'PUT', {
        expectedRevision: 1,
        groups: [group, { id: crypto.randomUUID(), name: 'Other', aliases: [' JOG '] }],
      })
    ).status,
  ).toBe(400);
  const targets = [{ exercise: 'Run', durationSeconds: 600, restSeconds: 75, note: 'Only a plan' }];
  const routineResponse = await planCreate(`/lists/${list.id}/routines`, owner, {
    title: 'Plan',
    exercises: ['Run'],
    targets,
  });
  expect(routineResponse.status).toBe(201);
  const routine = ((await routineResponse.json()) as { routine: WorkoutRoutine }).routine;
  const visitResponse = await planCreate(`/lists/${list.id}/workouts`, owner, {
    title: 'Visit',
    happenedOn: '2026-10-19',
    routineId: routine.id,
  });
  const workout = ((await visitResponse.json()) as { workout: WorkoutSession }).workout;
  const measurements = [{ name: 'Distance', value: 0, unit: 'mi' }];
  const logResponse = await call(`/lists/${list.id}/logs`, owner, 'POST', {
    title: 'Jog',
    exercise: true,
    happenedOn: '2026-10-19',
    workoutId: workout.id,
    measurements,
  });
  expect(logResponse.status).toBe(201);
  const backup = archiveFile.parse(await (await call('/export/backup', owner)).json());
  expect(backup.schemaVersion).toBe(8);
  expect(backup.lists[0].exerciseAliases).toEqual([group]);
  expect(backup.logs[0].measurements).toEqual(measurements);
  const restoreKey = crypto.randomUUID(),
    restored = await planCreate('/import', owner, backup, restoreKey);
  expect(restored.status).toBe(201);
  expect((await planCreate('/import', owner, backup, restoreKey)).status).toBe(201);
  const exported = archiveFile.parse(await (await call('/export/backup', owner)).json()),
    copy = exported.lists.find((row) => row.id !== list.id)!;
  expect(copy.exerciseAliases[0].id).not.toBe(group.id);
  expect(copy.exerciseAliases[0].aliases).toEqual(group.aliases);
  const newRoutine = exported.workoutRoutines.find((row) => row.listId === copy.id)!,
    newWorkout = exported.workoutSessions.find((row) => row.listId === copy.id)!,
    newLog = exported.logs.find((row) => row.listId === copy.id)!;
  expect(newRoutine.targets).toEqual(routine.targets);
  expect(newWorkout.targets).toEqual(workout.targets);
  expect(newLog.workoutId).toBe(newWorkout.id);
  expect(newLog.title).toBe('Jog');
  expect(newLog.measurements).toEqual(measurements);
  expect(newLog.exercise).toBe(true);
  expect(
    (
      await app.request(
        'https://worth.test/api/data',
        {
          method: 'DELETE',
          headers: {
            Cookie: `preview_user=${owner}`,
            Origin: 'https://worth.test',
            'X-Worth-Confirmation': 'delete-all-worth-data',
          },
        },
        platform.env,
        platform.ctx,
      )
    ).status,
  ).toBe(204);
  expect(
    await platform.env.DB.prepare('SELECT id FROM activity_plan_receipts WHERE owner_id=?')
      .bind(owner)
      .first(),
  ).toBeNull();
});

test('activity plans accept bounded Unicode target plans and keep creation IDs disjoint from other record kinds', async () => {
  const owner = 'planboundsowner',
    list = await activityPlanList(owner),
    collection = await archiveCollection(owner, 'Things'),
    item = await archiveItem(owner, collection.id, 'Existing identity');
  expect(
    (
      await planCreate(
        `/lists/${list.id}/routines`,
        owner,
        { title: 'Collision', exercises: ['Run'] },
        item.id,
      )
    ).status,
  ).toBe(409);
  expect(
    await platform.env.DB.prepare('SELECT id FROM activity_plan_receipts WHERE id=?').bind(item.id).first(),
  ).toBeNull();
  const exercises = Array.from({ length: 40 }, (_, i) => `Exercise ${i} ${'界'.repeat(100)}`),
    targets = exercises.map((exercise) => ({
      exercise,
      note: '界'.repeat(300),
      sets: 100,
      reps: 10000,
      weight: 100000,
      weightUnit: 'lb',
      durationSeconds: 86400,
      distance: 1000000,
      distanceUnit: 'mi',
      restSeconds: 86400,
    }));
  const response = await planCreate(`/lists/${list.id}/routines`, owner, {
    title: 'Large explicit plan',
    exercises,
    targets,
  });
  expect(response.status).toBe(201);
  expect(((await response.json()) as { routine: WorkoutRoutine }).routine.targets).toHaveLength(40);
  expect(
    (
      await planCreate(`/lists/${list.id}/routines`, owner, {
        title: 'Wrong names',
        exercises: ['Run'],
        targets: [{ exercise: 'Walk', sets: 2 }],
      })
    ).status,
  ).toBe(400);
  expect(
    (await planCreate(`/lists/${collection.id}/routines`, owner, { title: 'Wrong kind', exercises: ['Run'] }))
      .status,
  ).toBe(400);
});

test('activity plans keep concurrent exercise writes on the workout date', async () => {
  const owner = 'plandateowner',
    list = await activityPlanList(owner);
  const created = await planCreate(`/lists/${list.id}/workouts`, owner, {
    title: 'Date boundary',
    happenedOn: '2026-10-19',
  });
  let workout = ((await created.json()) as { workout: WorkoutSession }).workout;
  for (let index = 0; index < 3; index++) {
    const nextDay = `2026-10-${20 + index}`;
    const [entryResponse, moveResponse] = await Promise.all([
      call(`/lists/${list.id}/logs`, owner, 'POST', {
        title: `Timed entry ${index}`,
        exercise: true,
        workoutId: workout.id,
        happenedOn: workout.happenedOn,
        measurements: [{ name: 'Duration', value: 30, unit: 'seconds' }],
      }),
      call(`/workouts/${workout.id}`, owner, 'PATCH', {
        happenedOn: nextDay,
        expectedRevision: workout.revision,
      }),
    ]);
    expect([201, 400, 409]).toContain(entryResponse.status);
    expect(moveResponse.status).toBe(200);
    workout = ((await moveResponse.json()) as { workout: WorkoutSession }).workout;
    const logs = ((await (await call(`/lists/${list.id}/logs`, owner)).json()) as { logs: Log[] }).logs;
    expect(logs.every((log) => log.happenedOn === workout.happenedOn)).toBe(true);
  }
});
