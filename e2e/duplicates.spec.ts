import { collectionOptions } from './navigation';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import type { Page } from '@playwright/test';
const first = '22222222-2222-4222-8222-222222222222',
  second = '33333333-3333-4333-8333-333333333333',
  third = '44444444-4444-4444-8444-444444444444';
test.beforeEach(async ({ archive }) => {
  archive.items[0].id = first;
  archive.items[1].id = second;
  archive.items[1].title = 'coffee';
  archive.items[1].createdAt += 1;
  archive.list.rankedIds = [first];
});
async function open(page: Page) {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Comparison table', exact: true }).click();
  await page.locator('.duplicate-review > summary').click();
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_DUPLICATE_QA) return;
  await mkdir(process.env.WORTH_DUPLICATE_QA, { recursive: true });
  await page.locator('.duplicate-group').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${process.env.WORTH_DUPLICATE_QA}/${name}-${project}.png` });
}
test('matching records can stay separate across reloads and reopen without changing data', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.locator('.duplicate-review > summary')).toHaveText('Possible duplicates · 1');
  await capture(page, 'pending', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Keep all 2 as separate records', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 records kept separate.' })).toBeVisible();
  expect(archive.workspace.workspace.duplicateReviews?.[0].itemIds).toEqual([first, second]);
  expect(archive.items).toHaveLength(2);
  expect(archive.list.rankedIds).toEqual([first]);
  expect(archive.items.map((item) => item.decision)).toEqual(['favorite', null]);
  await page.reload();
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Comparison table', exact: true }).click();
  await page.locator('.duplicate-review > summary').click();
  await expect(page.locator('.duplicate-review > summary')).toHaveText('Possible duplicates · 0');
  await page.getByRole('checkbox', { name: 'Show groups kept separate', exact: true }).check();
  await capture(page, 'reviewed', info.project.name);
  await page.getByRole('button', { name: 'Show suggestions for this group again', exact: true }).click();
  await expect(page.locator('.duplicate-review > summary')).toHaveText('Possible duplicates · 1');
  await page.getByRole('button', { name: 'Open record 2: coffee', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'coffee', exact: true })).toBeVisible();
  if (process.env.WORTH_DUPLICATE_QA) {
    await page.getByText('not in public ranking links', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_DUPLICATE_QA}/note-copy-${info.project.name}.png` });
  }
  expect(archive.writes.every((write) => write.path.endsWith('/workspace'))).toBe(true);
});
test('revisit opens the existing composer and does not create a visit automatically', async ({
  page,
  archive,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Revisit record 2: coffee', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'coffee', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Log again', exact: true })).toBeVisible();
  expect(archive.writes).toEqual([]);
});
test('new group members need a new review and obsolete saved reviews can be removed', async ({
  page,
  archive,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Keep all 2 as separate records', exact: true }).click();
  await expect(page.locator('.duplicate-review > summary')).toHaveText('Possible duplicates · 0');
  archive.items.push({ ...archive.items[0], id: third, title: 'COFFEE', decision: 'meh' });
  await page.reload();
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Comparison table', exact: true }).click();
  await page.locator('.duplicate-review > summary').click();
  await expect(page.locator('.duplicate-review > summary')).toHaveText('Possible duplicates · 1');
  await expect(
    page.getByRole('button', { name: 'Keep all 3 as separate records', exact: true }),
  ).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Show groups kept separate', exact: true }).check();
  await expect(
    page.getByRole('region', { name: 'Other saved duplicate reviews', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved review 1', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Other saved duplicate reviews', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Keep all 3 as separate records', exact: true }).click();
  await expect(page.locator('.duplicate-review > summary')).toHaveText('Possible duplicates · 0');
  expect(archive.workspace.workspace.duplicateReviews).toHaveLength(1);
  expect(archive.workspace.workspace.duplicateReviews?.[0].itemIds).toHaveLength(3);
  expect(archive.items).toHaveLength(3);
});
test('conflicting saved reviews refresh safely and record actions preserve unfinished comparisons', async ({
  page,
  archive,
}) => {
  await open(page);
  archive.workspace.revision = 1;
  await page.getByRole('button', { name: 'Keep all 2 as separate records', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed elsewhere');
  expect(archive.workspace.workspace.duplicateReviews).toBeUndefined();
  await page.getByRole('button', { name: 'Refresh saved reviews', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Keep all 2 as separate records', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Ranking sandbox', exact: true }).click();
  await page.getByRole('button', { name: 'Start head-to-head', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which would you choose?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Comparison table', exact: true }).click();
  await page.locator('.duplicate-review > summary').click();
  await page.getByRole('button', { name: 'Open record 1: Coffee', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ranking sandbox', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'Which would you choose?', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Coffee', exact: true })).toHaveCount(0);
  expect(archive.list.rankedIds).toEqual([first]);
});
test('long duplicate names and choices fit narrow screens', async ({ page, archive }, info) => {
  archive.items[0].title = 'x'.repeat(120);
  archive.items[1].title = 'X'.repeat(120);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  for (const width of info.project.name === 'desktop' ? [320, 430, 768, 1440] : [390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    expect(
      await page.getByRole('dialog').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(
      await page.locator('.duplicate-group').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    await expect(page.locator('.duplicate-group h3')).toHaveText('x'.repeat(120));
  }
});
