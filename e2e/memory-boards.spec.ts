import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import { boardInput, boardPayload, boardForm, type BoardView } from '../src/shared/memory-boards';
const first = '22222222-2222-4222-8222-222222222222',
  second = '33333333-3333-4333-8333-333333333333',
  other = '44444444-4444-4444-8444-444444444444';
async function setup(page: Page, state: State) {
  state.items[0].id = first;
  state.items[1].id = second;
  state.items[1].listId = other;
  state.list.rankedIds = [first];
  state.extraLists.push({ ...state.list, id: other, name: 'Bookshops', rankedIds: [], itemCount: 1 });
  const rows = new Map<string, BoardView>(),
    hashes = new Map<string, string>(),
    removed = new Set<string>();
  let lost = false,
    missing = false;
  const sources = (board: BoardView) =>
    missing
      ? []
      : board.entries.flatMap((e) => {
          const item = state.items.find((i) => e.reference?.kind === 'item' && i.id === e.reference.id);
          return item
            ? [
                {
                  id: item.id,
                  kind: 'item' as const,
                  currentId: item.id,
                  merged: false,
                  title: item.title,
                  listId: item.listId,
                  listName: item.listId === other ? 'Bookshops' : list.name,
                  archived: false,
                  hasPhoto: false,
                  updatedAt: item.updatedAt,
                },
              ]
            : [];
        });
  await page.route('**/api/boards**', async (route) => {
    const req = route.request(),
      id = new URL(req.url()).pathname.split('/')[3],
      method = req.method();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (method === 'GET') {
      if (!id)
        return reply({ boards: [...rows.values()].map((b) => ({ ...b, entryCount: b.entries.length })) });
      const board = rows.get(id);
      return board && !removed.has(id)
        ? reply({ board: { ...board, sources: sources(board) } })
        : reply({ message: 'Board not found.' }, 404);
    }
    const body = req.postDataJSON(),
      key = id ?? req.headers()['idempotency-key'];
    if (method === 'DELETE') {
      const board = rows.get(key);
      if (!board) return reply({ message: 'Missing' }, 404);
      if (board.revision !== body.expectedRevision)
        return reply({ message: 'Board changed elsewhere.' }, 409);
      rows.delete(key);
      removed.add(key);
      state.writes.push({ path: '/boards/remove', body: key });
      return route.fulfill({ status: 204 });
    }
    const board = boardInput.parse(method === 'POST' ? body : body.board),
      before = rows.get(key);
    if (removed.has(key)) return reply({ message: 'This board was removed.', error: 'BOARD_REMOVED' }, 410);
    if (method === 'POST' && before) {
      if (hashes.get(key) !== JSON.stringify(board))
        return reply({ message: 'This retry differs from the saved board.' }, 409);
      return reply({ board: { ...before, sources: sources(before) } }, 201);
    }
    if (method === 'PUT' && (!before || before.revision !== body.expectedRevision))
      return reply(
        { message: 'This board changed elsewhere. Load saved details to compare; your draft is kept.' },
        409,
      );
    const saved: BoardView = {
      ...board,
      id: key,
      revision: before ? before.revision + 1 : 0,
      createdAt: before?.createdAt ?? 1,
      updatedAt: (before?.updatedAt ?? 1) + 1,
      sources: [],
    };
    rows.set(key, saved);
    if (!before) hashes.set(key, JSON.stringify(board));
    state.writes.push({ path: '/boards/save', body: { key, board, revision: body.expectedRevision } });
    if (lost) {
      lost = false;
      return route.abort('failed');
    }
    return reply({ board: { ...saved, sources: sources(saved) } }, method === 'POST' ? 201 : 200);
  });
  // The shared fixture serves the principal collection only; this source is another owned collection.
  await page.route(`**/api/lists/${other}/items`, (r) =>
    r.fulfill({ json: { items: state.items.filter((i) => i.listId === other) } }),
  );
  await page.route(`**/api/lists/${other}/logs`, (r) => r.fulfill({ json: { logs: [] } }));
  return {
    rows,
    setLost: () => (lost = true),
    setMissing: (value: boolean) => (missing = value),
    change: (id: string) => {
      const board = rows.get(id)!;
      rows.set(id, {
        ...board,
        name: 'Elsewhere name',
        revision: board.revision + 1,
        updatedAt: board.updatedAt + 1,
      });
    },
    seed: () => {
      const id = crypto.randomUUID();
      rows.set(id, {
        id,
        revision: 0,
        createdAt: 1,
        updatedAt: 1,
        kind: 'trip',
        name: 'A little trip',
        introduction: 'A day kept together.',
        from: '2026-10-01',
        until: '2026-10-02',
        archived: false,
        sources: [],
        entries: [
          {
            id: crypto.randomUUID(),
            name: 'Morning cup',
            note: 'My note survives source changes.',
            day: '2026-10-02',
            time: '09:00',
            location: 'The small corner table',
            reference: { kind: 'item', id: first },
            referenceMissing: false,
            photo: false,
          },
          {
            id: crypto.randomUUID(),
            name: 'The bookshop',
            note: 'Stay a while.',
            day: '2026-10-01',
            time: '',
            location: 'Second floor',
            reference: { kind: 'item', id: second },
            referenceMissing: false,
            photo: false,
          },
        ],
      });
      return id;
    },
  };
}
async function capture(page: Page, name: string, project: string, target?: string) {
  if (!process.env.WORTH_BOARDS_QA) return;
  await mkdir(process.env.WORTH_BOARDS_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (target)
    await page
      .locator(target)
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_BOARDS_QA}/${name}-${project}.png` });
}
async function newBoard(page: Page) {
  await page.goto('/patterns/boards');
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  return page.getByRole('dialog', { name: 'New board', exact: true });
}
async function saveNamed(page: Page, name = 'My weekend') {
  const dialog = await newBoard(page);
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true, level: 1 })).toBeVisible();
  return page.url().split('/').pop()!;
}

test('boards gather records across collections with explicit text and order, and replay never logs a visit', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  const dialog = await newBoard(page);
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('A small weekend');
  await dialog.getByRole('combobox', { name: 'Kind', exact: true }).selectOption('trip');
  await capture(page, 'editor-top', info.project.name);
  await dialog.getByText('Add a linked record or visit', { exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Collection or activity', exact: true }).selectOption(list.id);
  await dialog.getByRole('button', { name: 'Load records and visits', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add record Coffee · Drink', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Collection or activity', exact: true }).selectOption(other);
  await dialog.getByRole('button', { name: 'Load records and visits', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add record Tea · Drink', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Name for entry 1', exact: true }).fill('Morning cup');
  await dialog
    .getByRole('textbox', { name: 'Note for entry 1 · optional', exact: true })
    .fill('My entered note');
  await dialog.getByLabel('Date for entry 1 · optional', { exact: true }).fill('2026-10-02');
  await dialog
    .getByRole('textbox', { name: 'Location for entry 1 · optional', exact: true })
    .fill('My entered location');
  await expect(dialog.getByLabel('Show its current saved cover for entry 1')).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Earlier entry 2', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Name for entry 2', exact: true })).toHaveValue(
    'Morning cup',
  );
  await capture(page, 'editor', info.project.name, '.board-entry-editors');
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A small weekend', exact: true, level: 1 })).toBeVisible();
  const board = [...fixture.rows.values()][0];
  expect(board.entries.map((e) => e.reference?.id)).toEqual([second, first]);
  expect(board.entries[0].day).toBeNull();
  expect(board.entries[1].day).toBe('2026-10-02');
  await expect(page.getByRole('status').filter({ hasText: 'Stop 1 of 2: Tea' })).toBeVisible();
  await page.getByRole('button', { name: 'Next stop', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Stop 2: Morning cup', exact: true })).toContainText(
    'My entered location',
  );
  await capture(page, 'replay', info.project.name, '.board-replay');
  expect(archive.logs).toHaveLength(0);
  expect(archive.writes).toHaveLength(1);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual([first]);
  await page.getByRole('link', { name: 'Back to Boards →', exact: true }).click();
  await capture(page, 'directory', info.project.name);
  await capture(page, 'board-cards', info.project.name, '.board-directory');
  await expect(page.getByRole('link', { name: /A small weekend/ })).toBeVisible();
});

test('lost board replies freeze a retry through reload and saved checks avoid duplicate creation', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  let dialog = await newBoard(page);
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('My pending board');
  fixture.setLost();
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Couldn’t connect');
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled();
  await capture(page, 'pending', info.project.name, '.board-pending');
  await page.reload();
  dialog = page.getByRole('dialog', { name: 'New board', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('My pending board');
  await dialog.getByRole('button', { name: 'Load saved board to compare', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My pending board', exact: true, level: 1 })).toBeVisible();
  expect(fixture.rows.size).toBe(1);
  expect(archive.writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Edit board', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit board', exact: true });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Pending update');
  fixture.setLost();
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Couldn’t connect');
  await dialog.getByRole('button', { name: 'Load saved board to compare', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pending update', exact: true, level: 1 })).toBeVisible();
  expect(fixture.rows.size).toBe(1);
  expect(archive.writes).toHaveLength(2);
});

test('stale drafts require a saved review and preserve a previous copy', async ({ page, archive }, info) => {
  const fixture = await setup(page, archive),
    id = await saveNamed(page);
  await page.getByRole('button', { name: 'Edit board', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit board', exact: true });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('My stale notes');
  fixture.change(id);
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed elsewhere');
  await dialog.getByRole('button', { name: 'Load saved board to compare', exact: true }).click();
  await expect(dialog.locator('.board-saved-review')).toContainText('Elsewhere name');
  await capture(page, 'conflict', info.project.name, '.board-saved-review');
  await dialog.getByRole('button', { name: 'Use saved board', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Use the saved board?', exact: true })
    .getByRole('button', { name: 'Use saved board', exact: true })
    .click();
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Elsewhere name');
  await dialog.getByText('Previous draft kept for copying', { exact: true }).click();
  await expect(dialog.locator('.board-previous')).toContainText('My stale notes');
  expect(archive.writes).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Restore previous draft for review', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Restore the previous draft?', exact: true })
    .getByRole('button', { name: 'Restore draft', exact: true })
    .click();
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('My stale notes');
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed elsewhere');
  expect(archive.writes).toHaveLength(1);
});

test('missing sources retain readable entered stops, with keyboard replay, reduced motion and responsive accessibility', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    id = fixture.seed();
  fixture.setMissing(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/patterns/boards/${id}`);
  await expect(page.getByRole('list', { name: 'Entries in saved order' })).toContainText(
    'My note survives source changes.',
  );
  await expect(
    page
      .getByRole('list', { name: 'Entries in saved order' })
      .getByText('Linked record unavailable.', { exact: false }),
  ).toHaveCount(2);
  await page.getByText('All 2 stops in saved order', { exact: true }).click();
  const stop = page.getByRole('button', { name: /Stop 2 · The bookshop/ });
  await stop.focus();
  await stop.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Stop 2 of 2: The bookshop' })).toBeVisible();
  expect(
    await page.locator('.board-replay-ticket').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none');
  await capture(page, 'unavailable', info.project.name, '.board-stop-list');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(archive.writes).toHaveLength(0);
});

test('boards archive deliberately and removal leaves source records unchanged', async ({ page, archive }) => {
  const fixture = await setup(page, archive),
    id = fixture.seed();
  await page.goto(`/patterns/boards/${id}`);
  await page.getByRole('button', { name: 'Edit board', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit board', exact: true });
  await dialog.getByText('Dates and archiving · optional', { exact: true }).click();
  await dialog.getByLabel('Archive this board', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save board', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to Boards →', exact: true }).click();
  await expect(page.getByRole('link', { name: /A little trip/ })).toHaveCount(0);
  await page.getByText('Find and filter boards', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('archived');
  await page.getByRole('link', { name: /A little trip/ }).click();
  await page.getByRole('button', { name: 'Remove board', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Remove A little trip?', exact: true })
    .getByRole('button', { name: 'Remove board', exact: true })
    .click();
  await expect(page).toHaveURL(/\/patterns\/boards$/);
  expect(fixture.rows.size).toBe(0);
  expect(archive.items).toHaveLength(2);
});

test('blocked storage asks before leaving and account changes remove private board drafts', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('blocked');
    };
  });
  await page.goto('/patterns');
  await page.getByRole('link', { name: 'Boards & trips →', exact: true }).click();
  await page.getByRole('button', { name: 'New board', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New board', exact: true });
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Copy before leaving');
  await expect(dialog.getByRole('status').filter({ hasText: 'Draft could not be saved' })).toBeVisible();
  await page.evaluate(() => history.back());
  const confirm = page.getByRole('dialog', { name: 'Leave this page?', exact: true });
  await expect(confirm).toBeVisible();
  await expect(confirm).toHaveCSS('opacity', '1');
  for (const button of await confirm.getByRole('button').all()) {
    // Read the settled DOM rectangle; protocol quads can round translated 44px controls below 44.
    const height = await button.evaluate((node) => node.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(44);
  }
  await capture(page, 'navigation', info.project.name);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Copy before leaving');
  await page.route('**/api/me', (r) =>
    r.fulfill({ json: { user: { id: 'other', email: 'other@example.test', displayName: 'Other' } } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await expect(dialog).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});

test('a board-only backup previews and restores without requiring a collection', async ({
  page,
  archive,
}) => {
  const fixture = await setup(page, archive),
    id = fixture.seed(),
    board = fixture.rows.get(id)!;
  const file = {
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    boards: [
      {
        ...boardPayload(boardForm(board)),
        id: board.id,
        revision: board.revision,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        entries: [],
      },
    ],
  };
  let imported: unknown;
  await page.route('**/api/import', (route) => {
    imported = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ids: [] } });
  });
  await page.goto('/settings');
  await page.getByLabel('Choose backup', { exact: false }).setInputFiles({
    name: 'board-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole('region', { name: 'Boards to restore', exact: true })).toContainText(
    'A little trip',
  );
  await page.getByRole('button', { name: 'Restore previewed data', exact: true }).click();
  await expect(
    page.getByText('0 lists and 0 templates and 1 board restored. Existing data was kept.', { exact: true }),
  ).toBeVisible();
  expect(imported).toMatchObject({ schemaVersion: 6, boards: [{ id, entries: [] }] });
});

test('an unavailable saved board keeps its recovered notes available for copying', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    id = fixture.seed();
  await page.goto(`/patterns/boards/${id}`);
  await page.getByRole('button', { name: 'Edit board', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Edit board', exact: true });
  await dialog
    .getByRole('textbox', { name: 'Introduction · optional', exact: true })
    .fill('Copy this missing-board draft');
  await expect(dialog.getByRole('status').filter({ hasText: 'Draft saved on this device.' })).toBeVisible();
  fixture.rows.delete(id);
  await page.reload();
  dialog = page.getByRole('dialog', { name: 'Edit board', exact: true });
  await expect(dialog.locator('.board-draft-readout')).toContainText('Copy this missing-board draft');
  await dialog.getByRole('button', { name: 'Close board editor', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Close this board editor?', exact: true })
    .getByRole('button', { name: 'Close editor', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open device draft for copying', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Edit board', exact: true });
  await expect(dialog.locator('.board-draft-readout')).toContainText('Copy this missing-board draft');
  await expect(dialog.getByRole('button', { name: 'Save board', exact: true })).toBeDisabled();
  await capture(page, 'missing-board-draft', info.project.name, '.board-draft-readout');
  expect(archive.writes).toHaveLength(0);
});
