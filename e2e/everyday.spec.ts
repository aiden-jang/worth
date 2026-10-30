import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list, item } from './fixtures';
import { itemInput } from '../src/shared/validation';
import { experienceInput } from '../src/shared/memories';
import { today } from '../src/format';
import type { Page } from '@playwright/test';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_EVERYDAY_QA) return;
  await mkdir(process.env.WORTH_EVERYDAY_QA, { recursive: true });
  await page.screenshot({
    path: `${process.env.WORTH_EVERYDAY_QA}/${name}-${project}.png`,
    fullPage: !(await page.locator('dialog[open]').count()),
  });
  if (name === 'home')
    await page.screenshot({
      path: `${process.env.WORTH_EVERYDAY_QA}/home-viewport-${project}.png`,
      fullPage: false,
    });
}
async function openAdd(page: Page) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  return page.getByRole('dialog', { name: 'Keep something.', exact: true });
}

test('a first name can be saved without creating a collection, found from Home, and undone', async ({
  page,
  archive,
}, info) => {
  archive.items = [];
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  await page.route('**/api/overview', (route) =>
    route.fulfill({
      json: { lists: [], recent: [], ranked: [], favorites: [], notAgain: [], lastTimes: [] },
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good to keep.', exact: true })).toBeVisible();
  await capture(page, 'home-empty', info.project.name);
  const dialog = await openAdd(page);
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('Save in')).toHaveValue('inbox');
  await dialog.getByLabel('Name', { exact: true }).fill('That little bookshop');
  await capture(page, 'add', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Recent', exact: true })
      .getByRole('link', { name: /That little bookshop/ }),
  ).toBeVisible();
  expect(archive.inbox).toHaveLength(1);
  expect(archive.inbox[0]).toMatchObject({ title: 'That little bookshop', decision: null });
  expect(archive.logs).toHaveLength(0);
  expect(archive.writes.some((write) => write.path === '/lists')).toBe(false);
  await capture(page, 'home-saved', info.project.name);
  await page.locator('.entry-saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => archive.inbox.length).toBe(0);
  await expect(page.getByRole('link', { name: /That little bookshop/ })).toHaveCount(0);
});

test('a lost global save keeps its exact destination and payload across reload', async ({
  page,
  archive,
}) => {
  archive.failInboxCreateReply = true;
  await page.goto('/');
  let dialog = await openAdd(page);
  await dialog.getByLabel('Name', { exact: true }).fill('Corner ramen');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Name', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Save in')).toBeDisabled();
  const first = structuredClone(archive.writes.find((write) => write.path === '/inbox'));
  await page.reload();
  dialog = await openAdd(page);
  await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Corner ramen');
  await expect(dialog.getByLabel('Save in')).toHaveValue('inbox');
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.inbox.filter((entry) => entry.title === 'Corner ramen')).toHaveLength(1);
  expect(archive.writes.filter((write) => write.path === '/inbox')[1]).toEqual(first);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Keep something.' }).getByLabel('Name', { exact: true }),
  ).toHaveValue('');
});

test('collection capture stays compact and item selection does not push other entries down on phones', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  const coffee = page.locator('.collection-index-row button').filter({ hasText: 'Coffee' });
  await expect(coffee).toBeVisible();
  expect((await coffee.boundingBox())!.y).toBeLessThan(600);
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeHidden();
  await capture(page, 'collection', info.project.name);
  const tea = page.locator('.collection-index-row button').filter({ hasText: 'Tea' });
  const before = await tea.boundingBox();
  await coffee.click();
  const phone = info.project.name === 'phone';
  if (phone) {
    await expect(page.getByRole('dialog', { name: 'Saved item: Coffee' })).toBeVisible();
    expect((await tea.boundingBox())!.y).toBe(before!.y);
  }
  const slip = phone
    ? page.getByRole('dialog', { name: 'Saved item: Coffee' })
    : page.locator('.cabinet-collection-body > .opinion-slip');
  await slip.getByRole('button', { name: 'Meh', exact: true }).click();
  await expect.poll(() => archive.items[0].decision).toBe('meh');
  await capture(page, 'item', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  if (phone) await expect(coffee).toBeFocused();
  const name = page.getByRole('textbox', { name: 'Add a name', exact: true });
  await name.fill('Saturday market');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(name).toHaveValue('');
  await expect(name).toBeFocused();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(archive.items.find((entry) => entry.title === 'Saturday market')?.decision).toBeNull();
  await page.getByLabel('Collection options', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Collection options', { exact: true })).toBeFocused();
  for (const width of [320, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('collection experiences preserve overall calls and Undo reverses only the new records', async ({
  page,
  archive,
}) => {
  const undone: string[] = [];
  await page.route(/\/api\/(items|logs)\/[^/?]+$/, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const path = new URL(route.request().url()).pathname;
    const id = path.split('/').at(-1)!;
    undone.push(path);
    if (path.includes('/items/')) {
      archive.items = archive.items.filter((entry) => entry.id !== id);
      archive.logs = archive.logs.filter((entry) => entry.itemId !== id);
    } else archive.logs = archive.logs.filter((entry) => entry.id !== id);
    await route.fulfill({ status: 204 });
  });
  await page.route('**/api/lists/*/experiences', async (route) => {
    const body = experienceInput.parse(route.request().postDataJSON());
    archive.writes.push({ path: '/experiences', body });
    const created = body.itemId
      ? archive.items.find((entry) => entry.id === body.itemId)!
      : { ...item, id: crypto.randomUUID(), title: body.title, decision: null };
    if (!body.itemId) archive.items.push(created);
    const log = {
      id: crypto.randomUUID(),
      listId: list.id,
      itemId: created.id,
      title: body.title,
      happenedOn: body.happenedOn,
      note: body.note,
      context: body.context,
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    archive.logs.push(log);
    return route.fulfill({ json: { item: created, log } });
  });
  await page.goto(`/lists/${list.id}`);
  const dialog = await openAdd(page);
  await expect(dialog.getByLabel('Save in')).toHaveValue(list.id);
  await dialog.getByLabel('Name', { exact: true }).fill('Ramen by the station');
  await dialog.locator('summary').filter({ hasText: 'Add details' }).click();
  await dialog.getByLabel('Record a dated experience').check();
  await expect(dialog.getByLabel('When', { exact: true })).toHaveValue(today());
  await dialog.getByLabel('When', { exact: true }).fill('2025-04-12');
  await dialog
    .getByRole('group', { name: 'This time', exact: true })
    .getByRole('button', { name: 'Meh', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.logs.at(-1)).toMatchObject({ happenedOn: '2025-04-12', context: { reaction: 'meh' } });
  expect(archive.items.at(-1)?.decision).toBeNull();
  const savedId = archive.items.at(-1)!.id;
  const again = await openAdd(page);
  await again.getByLabel('Name', { exact: true }).fill('Ramen by the station');
  await again.locator('summary').filter({ hasText: 'Add details' }).click();
  await again.getByLabel('Record a dated experience').check();
  await again.getByRole('button', { name: 'Use saved Ramen by the station', exact: false }).click();
  await again.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(again).toHaveCount(0);
  expect(archive.items.filter((entry) => entry.title === 'Ramen by the station')).toHaveLength(1);
  expect(archive.logs.at(-1)?.itemId).toBe(savedId);
  const repeatId = archive.logs.at(-1)!.id;
  await page.locator('.entry-saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.entry-saved')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Deletion recovery' })).toBeVisible();
  expect(undone).toEqual([`/api/logs/${repeatId}`]);
  expect(archive.items.some((entry) => entry.id === savedId)).toBe(true);
  expect(archive.logs).toHaveLength(1);
  const newName = await openAdd(page);
  await newName.getByLabel('Name', { exact: true }).fill('Another noodle shop');
  await newName.locator('summary').filter({ hasText: 'Add details' }).click();
  await newName.getByLabel('Record a dated experience').check();
  await newName.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(newName).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Deletion recovery' })).toHaveCount(0);
  const newId = archive.items.at(-1)!.id;
  await page.locator('.entry-saved').getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.entry-saved')).toHaveCount(0);
  expect(undone.at(-1)).toBe(`/api/items/${newId}`);
  expect(archive.items.some((entry) => entry.id === newId)).toBe(false);
  expect(archive.logs).toHaveLength(1);
  await page.goto('/');
  const fresh = await openAdd(page);
  await expect(fresh.getByLabel('Save in')).toHaveValue('inbox');
});

test('Look back brings memories and insights together and retains direct memory links', async ({
  page,
}, info) => {
  await page.goto('/patterns');
  await expect(page.getByRole('heading', { name: 'Look back.', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Memories', exact: true })).toBeVisible();
  await capture(page, 'look-back', info.project.name);
  await page.getByRole('button', { name: 'Insights', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Insights', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What you like.', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, 'insights', info.project.name);
  await page.goto('/patterns/remember?mode=saved&q=Coffee');
  await expect(page.getByRole('heading', { name: 'Memories.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved things', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Gym puts the active workout before optional tools and past filters cannot hide it', async ({
  page,
  archive,
}, info) => {
  archive.list = { ...archive.list, kind: 'activity', name: 'Gym', rankedIds: [], itemCount: 0 };
  const workout = {
    id: crypto.randomUUID(),
    listId: list.id,
    title: 'Push day',
    happenedOn: today(),
    status: 'active',
    plannedExercises: ['Bench press', 'Shoulder press'],
    skippedExercises: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await page.route('**/api/lists/*/workouts', (route) => route.fulfill({ json: { workouts: [workout] } }));
  await page.route('**/api/lists/*/routines', (route) => route.fulfill({ json: { routines: [] } }));
  await page.goto(`/lists/${list.id}`);
  await expect(page.getByRole('heading', { name: 'Push day', exact: true })).toBeVisible();
  expect((await page.getByRole('heading', { name: 'Push day', exact: true }).boundingBox())!.y).toBeLessThan(
    500,
  );
  await expect(page.getByRole('button', { name: 'New routine', exact: true })).toBeHidden();
  await capture(page, 'gym', info.project.name);
  await page.locator('.activity-secondary > summary').filter({ hasText: 'Search past activity' }).click();
  await page.getByRole('textbox', { name: 'Search activity', exact: true }).fill('not in this workout');
  await expect(page.getByRole('heading', { name: 'Push day', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Exercise', exact: true })).toHaveValue('Bench press');
});

test('unfiled recall keeps its scope across memory types and opens the original find', async ({
  page,
  archive,
}, info) => {
  const id = crypto.randomUUID();
  archive.inbox = [
    {
      ...itemInput.parse({ title: 'The window-seat bookshop', decision: 'favorite' }),
      memory: { happenedOn: '2025-04-10', reaction: 'favorite' },
      id,
      revision: 0,
      createdAt: Date.UTC(2025, 3, 12),
      updatedAt: Date.UTC(2025, 3, 12),
    },
  ];
  await page.route('**/api/memories?*', (route) => {
    const saved = new URL(route.request().url()).searchParams.get('mode') === 'saved';
    return route.fulfill({
      json: {
        total: 1,
        records: [
          {
            id,
            itemId: null,
            listId: null,
            listName: 'Unfiled',
            title: 'The window-seat bookshop',
            note: '',
            date: saved ? '2025-04-12' : '2025-04-10',
            kind: saved ? 'unfiled' : 'unfiled-visit',
            location: '',
            order: '',
            reaction: 'favorite',
            hasPhoto: false,
          },
        ],
        nextOffset: null,
      },
    });
  });
  await page.goto('/patterns?mode=saved&list=inbox');
  await expect(page.locator('.memory-timeline')).toContainText('SAVED / UNFILED');
  await expect(page.locator('.memory-timeline time')).toHaveAttribute('datetime', '2025-04-12');
  await page.getByRole('button', { name: 'Experiences', exact: true }).click();
  await expect(page).toHaveURL(/list=inbox/);
  const sourceFilter = page.getByRole('combobox', { name: 'Collection or activity', exact: true });
  await expect(sourceFilter).toHaveValue('inbox');
  await expect(page.locator('.memory-timeline')).toContainText('VISIT / UNFILED');
  await expect(page.locator('.memory-timeline time')).toHaveAttribute('datetime', '2025-04-10');
  await sourceFilter.selectOption(list.id);
  await sourceFilter.selectOption('inbox');
  await capture(page, 'recall-unfiled', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const source = page.getByRole('link', { name: 'The window-seat bookshop ↗', exact: true });
  await expect(source).toHaveAttribute('href', `/inbox?focus=${id}`);
  await source.click();
  await expect(
    page
      .getByRole('dialog', { name: 'Keep the details.', exact: true })
      .getByRole('textbox', { name: 'Name', exact: true }),
  ).toHaveValue('The window-seat bookshop');
  expect(archive.writes).toHaveLength(0);
});

test('empty recall distinguishes undated names from filtered results and offers a next step', async ({
  page,
}, info) => {
  await page.route('**/api/memories?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const records =
      params.get('mode') === 'saved' && !params.get('q')
        ? [
            {
              id: 'coffee',
              itemId: 'coffee',
              listId: list.id,
              listName: list.name,
              title: 'Coffee',
              note: '',
              date: '2025-04-12',
              kind: 'saved',
              location: '',
              order: '',
              reaction: null,
              hasPhoto: false,
            },
          ]
        : [];
    return route.fulfill({ json: { records, total: records.length, nextOffset: null } });
  });
  await page.goto('/patterns');
  const empty = page.locator('.memory-page .workspace-empty');
  await expect(empty).toContainText('No dated experiences yet.');
  await capture(page, 'recall-no-experiences', info.project.name);
  await empty.getByRole('button', { name: 'See saved things', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved things', exact: true })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Coffee ↗', exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('not in my archive');
  await expect(empty).toContainText('No matches for these filters.');
  await capture(page, 'recall-no-matches', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await empty.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Saved things', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Coffee ↗', exact: true })).toBeVisible();
  await page.unroute('**/api/memories?*');
  await page.reload();
  await expect(empty).toContainText('No saved names yet.');
  await capture(page, 'recall-no-names', info.project.name);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await empty.getByRole('button', { name: 'Add a name', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await expect(dialog.getByLabel('Save in')).toHaveValue('inbox');
  await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
});

test('global activity capture saves one dated entry without inventing exercise sets or a workout', async ({
  page,
  archive,
}) => {
  archive.list = { ...archive.list, kind: 'activity', name: 'Walks', rankedIds: [], itemCount: 0 };
  await page.route('**/api/lists/*/workouts', (route) => route.fulfill({ json: { workouts: [] } }));
  await page.route('**/api/lists/*/routines', (route) => route.fulfill({ json: { routines: [] } }));
  await page.goto(`/lists/${list.id}`);
  const dialog = await openAdd(page);
  await expect(dialog.getByLabel('Save in')).toHaveValue(list.id);
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('The long way home');
  await dialog.getByLabel('When', { exact: true }).fill('2025-04-12');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.logs).toHaveLength(1);
  expect(archive.logs[0]).toMatchObject({
    title: 'The long way home',
    happenedOn: '2025-04-12',
    exercise: false,
    workoutId: null,
    exerciseSets: [],
  });
});

test('populated Home keeps recent names, Unfiled and activity within reach', async ({
  page,
  archive,
}, info) => {
  const gym = {
    ...list,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Gym',
    kind: 'activity',
    rankedIds: [],
    itemCount: 0,
    logCount: 2,
  };
  archive.inbox = [
    {
      ...itemInput.parse({ title: 'The little bookshop' }),
      id: crypto.randomUUID(),
      revision: 0,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    },
  ];
  await page.route('**/api/overview', (route) =>
    route.fulfill({
      json: {
        lists: [archive.list, gym],
        recent: [
          {
            id: 'coffee',
            itemId: 'coffee',
            listId: list.id,
            listName: 'My drinks',
            kind: 'collection',
            recordKind: 'item',
            title: 'Coffee',
            decision: 'favorite',
            happenedOn: null,
            recordedAt: Date.now(),
            amount: null,
            unit: '',
            sets: null,
            reps: null,
          },
        ],
        ranked: [],
        favorites: [],
        notAgain: [],
        lastTimes: [],
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Recent', exact: true })).toContainText(
    'The little bookshop',
  );
  await expect(
    page.getByRole('region', { name: 'Your activity', exact: true }).getByRole('link', { name: /Gym/ }),
  ).toBeVisible();
  await capture(page, 'home', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
