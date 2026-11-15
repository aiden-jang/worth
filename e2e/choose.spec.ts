import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import type { MemoryRecord } from '../src/shared/memories';

const book: MemoryRecord = {
  id: 'book',
  itemId: 'book',
  listId: list.id,
  listName: 'Books',
  title: 'The illustrated atlas',
  note: 'Light reading for a quiet afternoon.',
  date: '2026-11-01',
  kind: 'saved',
  location: '',
  order: '',
  reaction: 'favorite',
  hasPhoto: false,
};
const choices: MemoryRecord[] = [
  book,
  {
    ...book,
    id: 'place',
    itemId: null,
    listId: null,
    listName: 'Unfiled',
    title: 'The corner bookshop',
    note: 'For a rainy day.',
    kind: 'unfiled',
    reaction: null,
    wantToTry: true,
  },
  {
    ...book,
    id: 'moisturizer',
    itemId: 'moisturizer',
    listName: 'Skincare',
    title: 'Daily moisturizer',
    note: 'Too heavy for me.',
    reaction: 'would_not_again',
  },
];
const place = choices[1];

test('Home choices browse actual opinions and plans across categories with clearable search', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/memories?**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get('q')?.toLowerCase() ?? '';
    const records = choices.filter(
      (record) =>
        (!params.get('call') || record.reaction === params.get('call')) &&
        (params.get('want') !== '1' || record.wantToTry) &&
        (!q || `${record.title} ${record.note}`.toLowerCase().includes(q)),
    );
    return route.fulfill({ json: { records, total: records.length, nextOffset: null } });
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Browse choices', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Find your next pick.' })).toBeVisible();
  await expect(page.locator('.choice-card')).toHaveCount(3);
  await expect(page.getByRole('img', { name: 'Not again', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(page.locator('.choice-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: book.title })).toHaveAttribute(
    'href',
    `/lists/${list.id}?focus=item:book&view=1`,
  );
  await page.getByRole('button', { name: 'Want to try', exact: true }).click();
  await expect(page.locator('.choice-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'The corner bookshop' })).toHaveAttribute(
    'href',
    '/inbox?focus=place&view=1',
  );
  await page.getByRole('button', { name: 'All saved', exact: true }).click();
  await expect(page.getByRole('button', { name: 'All saved', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.choice-card')).toHaveCount(3);
  const search = page.getByRole('searchbox', { name: 'Search your saved choices' });
  await search.fill('quiet');
  await expect(page.locator('.choice-card')).toHaveCount(1);
  await expect(page.getByText(book.note, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear choice search' }).click();
  await expect(search).toBeFocused();
  await expect(page.locator('.choice-card')).toHaveCount(3);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (process.env.WORTH_CHOICES_QA) {
    await mkdir(process.env.WORTH_CHOICES_QA, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${process.env.WORTH_CHOICES_QA}/choose-${info.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.screenshot({
      path: `${process.env.WORTH_CHOICES_QA}/choose-viewport-${info.project.name}.png`,
      animations: 'disabled',
    });
  }
  for (const width of [320, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(archive.writes).toEqual([]);
});

test('compact Add saves an opinion and note directly without requiring organization or a visit', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add item', exact: true });
  await expect(dialog.getByRole('button', { name: 'More details', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(dialog.getByRole('group', { name: 'Overall call', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Type', { exact: true })).toBeHidden();
  await dialog.getByLabel('Name', { exact: true }).fill('Daily moisturizer');
  await dialog.getByRole('button', { name: 'Meh', exact: true }).click();
  await dialog.getByLabel('Note', { exact: false }).fill('A little too heavy for me.');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (process.env.WORTH_CHOICES_QA) {
    await mkdir(process.env.WORTH_CHOICES_QA, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${process.env.WORTH_CHOICES_QA}/add-${info.project.name}.png`,
      animations: 'disabled',
    });
  }
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.inbox.at(-1)).toMatchObject({
    title: 'Daily moisturizer',
    note: 'A little too heavy for me.',
    decision: 'meh',
    wantToTry: false,
    memory: null,
  });
  expect(archive.logs).toHaveLength(0);
  expect(archive.writes.some((write) => write.path === '/lists')).toBe(false);
});

test('Pick for me explains saved evidence, redraws, and follows the current words, collection and view', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  archive.list.name = 'Books';
  const pool: MemoryRecord[] = [
    book,
    place,
    ...['A quiet film', 'A walking trail', 'A light tea', 'A weekend exhibit'].map((title, index) => ({
      ...book,
      id: `pick-${index}`,
      itemId: `pick-${index}`,
      title,
      note: 'A quiet afternoon.',
    })),
    choices[2],
  ];
  const draws: URLSearchParams[] = [];
  await page.route('**/api/memories?**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get('q')?.toLowerCase() ?? '';
    let records = pool.filter(
      (record) =>
        (!params.get('list') ||
          (params.get('list') === 'inbox'
            ? record.kind === 'unfiled'
            : record.listId === params.get('list'))) &&
        (!params.get('call') || record.reaction === params.get('call')) &&
        (params.get('want') !== '1' || record.wantToTry) &&
        (!q || `${record.title} ${record.note}`.toLowerCase().includes(q)),
    );
    if (params.get('pick')) {
      draws.push(params);
      records = records.filter(
        (record) =>
          (record.reaction === null || record.reaction === 'favorite') &&
          (record.reaction === 'favorite' || record.wantToTry),
      );
      const total = records.length;
      const excluded = (params.get('exclude') ?? '').split(',');
      records = [
        ...records.filter((record) => !excluded.includes(record.id)),
        ...records.filter((record) => excluded.includes(record.id)),
      ].slice(0, 3);
      return route.fulfill({ json: { records, total, nextOffset: null } });
    }
    return route.fulfill({ json: { records, total: records.length, nextOffset: null } });
  });
  await page.goto('/choose');
  await expect(page.locator('.choice-card')).toHaveCount(7);
  expect(draws).toHaveLength(0);
  await page.getByRole('button', { name: 'Pick for me', exact: true }).click();
  const picked = page.getByRole('region', { name: 'Your picks', exact: true });
  await expect(picked.getByRole('status')).toHaveText('3 picks from 6 matching choices');
  await expect(picked).toBeFocused();
  await expect(picked.getByText('On your Want to try list.', { exact: true })).toBeVisible();
  await expect(picked.getByText('You marked this Favorite.', { exact: true })).toHaveCount(2);
  await expect(picked.getByRole('img', { name: 'Not again', exact: true })).toHaveCount(0);
  await expect(picked.getByRole('link', { name: book.title })).toHaveAttribute(
    'href',
    `/lists/${list.id}?focus=item:book&view=1`,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (process.env.WORTH_CHOICES_QA) {
    await mkdir(process.env.WORTH_CHOICES_QA, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${process.env.WORTH_CHOICES_QA}/picks-${info.project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.screenshot({
      path: `${process.env.WORTH_CHOICES_QA}/picks-viewport-${info.project.name}.png`,
      animations: 'disabled',
    });
  }
  await page.getByRole('button', { name: 'Show other picks', exact: true }).click();
  await expect(picked.getByRole('link', { name: book.title })).toHaveCount(0);
  expect(draws[1].get('exclude')).toBe('book,place,pick-0');
  const search = page.getByRole('searchbox', { name: 'Search your saved choices' });
  await search.fill('rainy');
  await expect(page).toHaveURL(/q=rainy/);
  await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption('inbox');
  await expect(page).toHaveURL(/list=inbox/);
  await page.getByRole('button', { name: 'Want to try', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Want to try', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.choice-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pick for me', exact: true }).click();
  await expect(picked.getByRole('status')).toHaveText('1 pick from 1 matching choice');
  await expect(picked.getByText('Matches “rainy” in your saved details.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show other picks', exact: true })).toBeDisabled();
  expect(draws.at(-1)?.get('pick')).toBe('try');
  expect(draws.at(-1)?.get('list')).toBe('inbox');
  await page.getByRole('button', { name: 'See all matches', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pick for me', exact: true })).toBeFocused();
  await expect(search).toHaveValue('rainy');
  await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toHaveValue('inbox');
  for (const width of [320, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(archive.writes).toEqual([]);
});

test('pick failures retry without broadening and a late draw cannot replace a different view', async ({
  page,
  archive,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let fail = true;
  let release: (() => void) | undefined;
  let delay = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/memories?**', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('pick')) {
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE', message: 'Try again.' } });
      }
      if (delay) await pending;
      return route.fulfill({
        json: {
          records: params.get('pick') === 'try' ? [] : [book],
          total: params.get('pick') === 'try' ? 0 : 6,
          nextOffset: null,
        },
      });
    }
    return route.fulfill({ json: { records: [book, place], total: 2, nextOffset: null } });
  });
  await page.goto('/choose?view=favorite');
  await page.getByRole('button', { name: 'Pick for me', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your picks couldn’t load.');
  await page.getByRole('button', { name: 'Retry picks', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your picks', exact: true }).getByRole('status')).toHaveText(
    '1 pick from 6 matching choices',
  );
  delay = true;
  await page.getByRole('button', { name: 'Show other picks', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Finding a few choices…');
  await page.getByRole('button', { name: 'Want to try', exact: true }).click();
  release?.();
  await expect(page.getByRole('button', { name: 'Want to try', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('region', { name: 'Your picks', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pick for me', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No picks here yet.', exact: true })).toBeVisible();
  await expect(page.locator('.choice-card')).toHaveCount(0);
  await expect(
    page.getByText('Save something to Want to try. It can be a future pick.', { exact: true }),
  ).toBeVisible();
  expect(archive.writes).toEqual([]);
});
