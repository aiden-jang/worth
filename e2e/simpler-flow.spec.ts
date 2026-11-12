import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, list, test } from './fixtures';

test('create a collection while adding an item and save its call in the same flow', async ({
  page,
  archive,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add item', exact: true });
  await add.getByLabel('Name', { exact: true }).fill('The little ramen place');
  await add.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(add.locator('.quick-entry-details')).not.toHaveAttribute('open');
  await add.getByRole('button', { name: 'New collection', exact: true }).click();
  await add.getByLabel('Collection name', { exact: true }).fill('Places');
  await add.getByRole('button', { name: 'Create collection', exact: true }).click();
  await expect(add.getByLabel('Save in')).toHaveValue(list.id);
  await expect(add.getByLabel('Name', { exact: true })).toHaveValue('The little ramen place');
  await expect(add.getByRole('button', { name: 'Favorite', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  if (process.env.WORTH_FLOW_QA) {
    await mkdir(process.env.WORTH_FLOW_QA, { recursive: true });
    await page.screenshot({ path: `${process.env.WORTH_FLOW_QA}/add-${info.project.name}.png` });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(add).toHaveCount(0);
  expect(archive.list.name).toBe('Places');
  expect(archive.items.at(-1)).toMatchObject({ title: 'The little ramen place', decision: 'favorite' });
  expect(archive.logs).toHaveLength(0);
});

test('direct capture, call filters and a stable preview avoid extra editors', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  const capture = page.getByRole('textbox', { name: 'Add a name', exact: true });
  await capture.fill('A very average tea');
  await page
    .getByRole('group', { name: 'Call for new item', exact: true })
    .getByRole('button', { name: 'Meh', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(capture).toHaveValue('');
  await expect(capture).toBeFocused();
  expect(archive.items.at(-1)).toMatchObject({ title: 'A very average tea', decision: 'meh' });
  expect(archive.list.rankedIds).toEqual(['coffee']);
  const filters = page.getByRole('group', { name: 'Filter by personal call', exact: true });
  for (const [label, expected] of [
    ['Favorite', 'Coffee'],
    ['Meh', 'A very average tea'],
    ['No call', 'Tea'],
  ]) {
    await filters.getByRole('button', { name: new RegExp('^' + label) }).click();
    await expect(page.locator('.collection-index-row')).toHaveCount(1);
    await expect(page.locator('.collection-index-row strong')).toHaveText(expected);
  }
  await filters.getByRole('button', { name: /^All calls/ }).click();
  const row = page.locator('.collection-index-row > button').filter({ hasText: 'Coffee' });
  const before = await row.boundingBox();
  await row.click();
  const preview = page.getByRole('region', { name: 'Your call for Coffee', exact: true });
  const after = await row.boundingBox();
  expect(after?.x).toBeCloseTo(before!.x, 0);
  expect(after?.width).toBeCloseTo(before!.width, 0);
  if (info.project.name === 'desktop')
    expect((await preview.boundingBox())!.x).toBeGreaterThan(before!.x + before!.width);
  await preview.getByRole('button', { name: 'Not again', exact: true }).click();
  await expect(preview.getByText('Not again.', { exact: true })).toBeVisible();
  expect(archive.items[0].decision).toBe('would_not_again');
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await preview.getByRole('button', { name: 'Not again', exact: true }).click();
  await expect(preview.getByText('Undecided.', { exact: true })).toBeVisible();
  if (process.env.WORTH_FLOW_QA) {
    await mkdir(process.env.WORTH_FLOW_QA, { recursive: true });
    await page.screenshot({ path: `${process.env.WORTH_FLOW_QA}/collection-${info.project.name}.png` });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('saved banner pauses for interaction and dismisses automatically', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add item', exact: true });
  await add.getByLabel('Name', { exact: true }).fill('Remember this');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  const banner = page.locator('.entry-saved');
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Undo', exact: true }).focus();
  await page.clock.fastForward(7000);
  await expect(banner).toBeVisible();
  await page.getByRole('heading', { level: 1 }).click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6100);
  await expect(banner).toHaveCount(0);
});

test('Home rediscovers actual favorites beyond the first page', async ({ page }, info) => {
  await page.addInitScript(() => {
    Math.random = () => 0.98;
  });
  const requests: number[] = [];
  await page.route('**/api/memories?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('call') !== 'favorite')
      return route.fulfill({ json: { records: [], total: 0, nextOffset: null } });
    const offset = Number(params.get('offset') ?? 0);
    requests.push(offset);
    const records = Array.from({ length: 55 }, (_, index) => ({
      id: 'favorite-' + index,
      itemId: 'favorite-' + index,
      listId: list.id,
      listName: list.name,
      title: `Old favorite ${index + 1}`,
      date: '2025-01-01',
      kind: 'saved',
      reaction: 'favorite',
      note: '',
      location: '',
      order: '',
      hasPhoto: false,
    }));
    return route.fulfill({
      json: {
        records: records.slice(offset, offset + 50),
        total: records.length,
        nextOffset: offset + 50 < 55 ? offset + 50 : null,
      },
    });
  });
  await page.goto('/');
  const favorite = page.getByRole('region', { name: 'Your reminders', exact: true });
  await expect(favorite.getByRole('link', { name: 'Old favorite 54', exact: true })).toBeVisible();
  expect(requests).toContain(53);
  await favorite.getByRole('button', { name: 'Show another', exact: true }).click();
  await expect(favorite.getByRole('link', { name: 'Old favorite 55', exact: true })).toBeVisible();
  if (process.env.WORTH_FLOW_QA) {
    await mkdir(process.env.WORTH_FLOW_QA, { recursive: true });
    await page.screenshot({
      path: `${process.env.WORTH_FLOW_QA}/home-${info.project.name}.png`,
      fullPage: true,
    });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a visible plan can be reviewed in place without a visit date or ranking change', async ({
  page,
  archive,
}, info) => {
  await page.goto(`/lists/${list.id}`);
  await expect(
    page.getByRole('button', { name: 'Entry options', exact: true }).locator('..'),
  ).not.toHaveAttribute('open');
  await page.getByRole('checkbox', { name: 'Want to try', exact: true }).check();
  await expect(page.getByRole('group', { name: 'Call for new item', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Add a name', exact: true }).fill('A future tea');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Add a name', exact: true })).toHaveValue('');
  const planned = archive.items.at(-1)!;
  expect(planned).toMatchObject({ wantToTry: true, decision: null, logCount: 0 });
  const views = page.getByRole('group', { name: 'Collection views', exact: true });
  await views.getByRole('button', { name: /^Want to try/ }).click();
  await page.getByRole('button', { name: 'A future tea Want to try', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Your call for A future tea', exact: true });
  await preview.getByRole('button', { name: 'I tried it', exact: true }).click();
  const review = preview.getByRole('region', { name: 'Review A future tea', exact: true });
  await expect(
    review.getByText('Choose a call to move this out of Want to try. No date needed.'),
  ).toBeVisible();
  if (process.env.WORTH_FLOW_QA) {
    await mkdir(process.env.WORTH_FLOW_QA, { recursive: true });
    await page.screenshot({ path: `${process.env.WORTH_FLOW_QA}/plan-review-${info.project.name}.png` });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await review.getByRole('button', { name: 'Meh', exact: true }).click();
  await expect(page.locator('.collection-index-row')).toHaveCount(0);
  expect(archive.items.find((item) => item.id === planned.id)).toMatchObject({
    wantToTry: false,
    decision: 'meh',
    logCount: 0,
  });
  expect(archive.logs).toHaveLength(0);
  expect(archive.list.rankedIds).toEqual(['coffee']);
  if (info.project.name === 'phone') await page.keyboard.press('Escape');
  await views.getByRole('button', { name: /^Tried/ }).click();
  await expect(page.locator('.collection-index-row strong')).toHaveText(['Coffee', 'A future tea']);
});

test('Home mixes reminders while a save refresh keeps the current record', async ({ page, archive }) => {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  archive.items.push({ ...archive.items[1], id: 'waiting', title: 'Waiting tea', wantToTry: true });
  await page.route('**/api/memories?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const base = {
      itemId: 'coffee',
      listId: list.id,
      listName: list.name,
      note: '',
      location: '',
      order: '',
      hasPhoto: false,
      wantToTry: false,
    };
    const records = [
      {
        ...base,
        id: 'coffee',
        title: 'An old favorite',
        date: '2025-01-01',
        kind: 'saved',
        reaction: 'favorite',
      },
      {
        ...base,
        id: 'waiting',
        itemId: 'waiting',
        title: 'Waiting tea',
        date: '2025-01-02',
        kind: 'saved',
        reaction: null,
        wantToTry: true,
      },
      {
        ...base,
        id: 'visit',
        title: 'A recent visit',
        date: new Date().toISOString().slice(0, 10),
        kind: 'visit',
        reaction: 'meh',
      },
    ];
    if (archive.items.length > 3)
      records.unshift({
        ...base,
        id: 'newer',
        title: 'Another old favorite',
        date: '2025-02-01',
        kind: 'saved',
        reaction: 'favorite',
      });
    const matching = records.filter(
      (record) =>
        (params.get('mode') === 'saved' ? record.kind === 'saved' : record.kind === 'visit') &&
        (!params.get('id') || record.id === params.get('id')) &&
        (!params.get('call') || record.reaction === params.get('call')) &&
        (!params.get('want') || record.wantToTry === (params.get('want') === '1')) &&
        (!params.get('from') || record.date >= params.get('from')!) &&
        (!params.get('to') || record.date <= params.get('to')!),
    );
    return route.fulfill({ json: { records: matching, total: matching.length, nextOffset: null } });
  });
  await page.goto('/');
  const reminder = page.getByRole('region', { name: 'Your reminders', exact: true });
  await expect(reminder.getByRole('link', { name: 'An old favorite', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Memory shelf', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add item', exact: true });
  await add.getByLabel('Save in').selectOption(list.id);
  await add.getByLabel('Name', { exact: true }).fill('A new name');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(add).toHaveCount(0);
  await expect(reminder).toHaveAttribute('aria-busy', 'false');
  await expect(reminder.getByRole('link', { name: 'An old favorite', exact: true })).toBeVisible();
  await reminder.getByRole('button', { name: 'Show another', exact: true }).click();
  await expect(reminder.getByRole('link', { name: 'Waiting tea', exact: true })).toBeVisible();
  await expect(reminder.getByRole('button', { name: 'I tried it', exact: true })).toBeVisible();
  await reminder.getByRole('button', { name: 'Show another', exact: true }).click();
  await expect(reminder.getByRole('link', { name: 'A recent visit', exact: true })).toBeVisible();
  await expect(reminder.getByText('Your call this time: Meh.', { exact: true })).toBeVisible();
});
