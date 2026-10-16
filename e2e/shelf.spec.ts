import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { emptyCollectionShelf } from '../src/shared/workspace';
const first = '22222222-2222-4222-8222-222222222222';
const second = '33333333-3333-4333-8333-333333333333';
test.beforeEach(async ({ archive }) => {
  archive.items[0].id = first;
  archive.items[1].id = second;
  archive.items[1].createdAt += 1;
  archive.list.rankedIds = [first];
});
async function open(page: import('@playwright/test').Page) {
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Your shelf', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Shelf preview' })).toBeVisible();
}

test('private shelf choices persist, open records and remain separate from calls and ranks', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByText('Personalize this shelf', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Bookend', exact: true }).selectOption('plant');
  await page.getByRole('textbox', { name: 'Private dedication', exact: true }).fill('For rainy Sundays.');
  await page.getByRole('combobox', { name: 'Keepsake', exact: true }).selectOption(second);
  await page.getByRole('button', { name: 'Use earliest kept record', exact: true }).click();
  await page.getByRole('textbox', { name: 'Inscription', exact: true }).fill('A small beginning.');
  await page.getByRole('checkbox', { name: 'Show the undecided paper creature', exact: true }).check();
  await page.getByRole('button', { name: 'Save shelf', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Shelf saved.' })).toBeVisible();
  expect(archive.workspace.workspace.shelf?.keepsakeId).toBe(second);
  expect(archive.workspace.workspace.shelf?.inscription?.itemId).toBe(first);
  expect(archive.list.rankedIds).toEqual([first]);
  expect(archive.items[1].decision).toBeNull();
  const preview = page.getByRole('region', { name: 'Shelf preview' });
  await expect(preview).toContainText('A small beginning.');
  await expect(preview.getByRole('img', { name: 'Faceless folded paper creature' })).toBeVisible();
  await expect(preview).toContainText('1 record without a call.');
  const keepsakeTarget = await preview
    .getByRole('button', { name: 'Open keepsake', exact: true })
    .boundingBox();
  expect(keepsakeTarget?.height).toBeGreaterThanOrEqual(44);
  await page.getByText('Personalize this shelf', { exact: true }).click();
  if (process.env.WORTH_SHELF_QA) {
    await mkdir(process.env.WORTH_SHELF_QA, { recursive: true });
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_SHELF_QA}/pockets-${info.project.name}.png` });
    await preview.locator('.shelf-records').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_SHELF_QA}/pocket-records-${info.project.name}.png` });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Close workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Your shelf', exact: true }).click();
  await expect(preview).toContainText('For rainy Sundays.');
  await page.getByText('Personalize this shelf', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Presentation', exact: true }).selectOption('spines');
  await page.getByRole('combobox', { name: 'Bookend', exact: true }).selectOption('arch');
  await page.getByRole('button', { name: 'Save shelf', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Shelf saved.' })).toBeVisible();
  await page.getByText('Personalize this shelf', { exact: true }).click();
  await expect(preview.getByRole('img', { name: 'Sage arch bookend' })).toBeVisible();
  if (process.env.WORTH_SHELF_QA) {
    await preview.locator('.shelf-introduction').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_SHELF_QA}/arch-${info.project.name}.png` });
    await preview.locator('.shelf-records').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_SHELF_QA}/spines-${info.project.name}.png` });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('textbox', { name: 'Find on this shelf', exact: true }).fill('Tea');
  await expect(preview.locator('.shelf-record')).toHaveCount(1);
  await page.getByRole('button', { name: 'Open keepsake', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close workbench', exact: true })).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Tea', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tea', level: 2, exact: true })).toBeVisible();
  expect(archive.writes.every((write) => write.path.endsWith('/workspace'))).toBe(true);
});

test('shelf drafts recover and conflicting saves require a reviewed reload', async ({ page, archive }) => {
  await open(page);
  await page.getByText('Personalize this shelf', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Private dedication', exact: true }).fill('My local dedication');
  await page.getByRole('button', { name: 'Close workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Your shelf', exact: true }).click();
  await page.getByText('Personalize this shelf', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Private dedication', exact: true })).toHaveValue(
    'My local dedication',
  );
  archive.workspace = {
    workspace: {
      rankings: [],
      views: [],
      shelf: { ...emptyCollectionShelf, dedication: 'A newer saved dedication' },
    },
    revision: 1,
  };
  await page.getByRole('button', { name: 'Save shelf', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  await expect(page.getByRole('textbox', { name: 'Private dedication', exact: true })).toHaveValue(
    'My local dedication',
  );
  await expect(page.getByRole('button', { name: 'Save shelf', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload saved shelf', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Reload the saved shelf?', exact: true });
  await confirm.getByRole('button', { name: 'Reload saved shelf', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Private dedication', exact: true })).toHaveValue(
    'A newer saved dedication',
  );
  await expect(page.getByRole('status').filter({ hasText: 'Saved shelf loaded.' })).toBeVisible();
});

test('shelf presentations fit narrow screens and expose long names without clipping', async ({
  page,
  archive,
}, info) => {
  archive.items[0].title = 'Long record '.repeat(10);
  archive.workspace.workspace.shelf = {
    ...emptyCollectionShelf,
    style: 'spines',
    bookend: 'plant',
    dedication: 'A dedication '.repeat(20),
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const width of info.project.name === 'desktop' ? [320, 430, 768, 1440] : [390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    const dialog = page.getByRole('dialog');
    expect(await dialog.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    expect(
      await page
        .getByRole('region', { name: 'Shelf preview' })
        .evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    const name = page.locator('.shelf-record-name').first();
    expect(await name.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    await expect(name).toHaveText(archive.items[0].title.trim());
  }
});
