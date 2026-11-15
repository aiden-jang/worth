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
