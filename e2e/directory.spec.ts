import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list } from './fixtures';
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_DIRECTORY_QA) return;
  await mkdir(process.env.WORTH_DIRECTORY_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_DIRECTORY_QA}/${name}-${project}.png` });
}

test('a single collection stays compact and its entire card opens the saved list', async ({
  page,
  archive,
}, info) => {
  archive.list.name = 'Drinks';
  archive.list.rankedCount = 0;
  archive.list.updatedAt = Date.now() - 86400000;
  await page.goto('/lists');
  await expect(page.getByRole('heading', { name: 'Collections', exact: true, level: 1 })).toBeVisible();
  const card = page.locator('.collection-directory-card');
  await expect(card).toHaveCount(1);
  await expect(page.getByRole('searchbox', { name: 'Find a collection', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Order collections', exact: true })).toHaveCount(0);
  await expect(card.getByText('2 items · 1 favorite', { exact: true })).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds!.height).toBeLessThan(240);
  expect(bounds!.y + bounds!.height).toBeLessThan(page.viewportSize()!.height - 80);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await capture(page, 'sparse', info.project.name);
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}$`));
  expect(archive.writes).toHaveLength(0);
});

test('a larger directory keeps search and ordering reachable across archive changes and saved filters', async ({
  page,
  archive,
}, info) => {
  archive.list.name = 'Drinks';
  archive.extraLists = [
    ...['Movies', 'Places', 'Cars'].map((name, index) => ({
      ...structuredClone(list),
      id: crypto.randomUUID(),
      name,
      itemCount: index + 3,
      rankedCount: 0,
      favoriteCount: 0,
      rankedIds: [],
    })),
    {
      ...structuredClone(list),
      id: crypto.randomUUID(),
      name: 'Gym',
      kind: 'activity',
      logCount: 6,
      itemCount: 0,
      rankedCount: 0,
      favoriteCount: 0,
      rankedIds: [],
    },
  ];
  await page.goto('/lists');
  const search = page.getByRole('searchbox', { name: 'Find a collection', exact: true });
  const order = page.getByRole('combobox', { name: 'Order collections', exact: true });
  await expect(search).toBeVisible();
  await expect(order).toBeVisible();
  await expect(page.locator('.collection-directory-card')).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Activity', exact: true }).getByRole('link')).toContainText(
    '6 entries',
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await capture(page, 'populated', info.project.name);
  await order.selectOption('name');
  await expect(page.locator('.collection-directory-copy strong').first()).toHaveText('Cars');
  await search.fill('Places');
  await expect(page.locator('.collection-directory-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('link', { name: 'Collections', exact: true }).click();
  await expect(search).toHaveValue('Places');
  await page.reload();
  await expect(search).toHaveValue('');
  await expect(order).toHaveValue('name');
  await search.fill('Places');
  await page.route('**/api/lists?archived=1', (route) =>
    route.fulfill({ json: { lists: [{ ...archive.list, archived: true }] } }),
  );
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await expect(search).toHaveValue('Places');
  await expect(page.getByText('No collections match that name.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear collection search', exact: true }).click();
  await expect(search).toBeFocused();
  await expect(page.locator('.collection-directory-card')).toHaveCount(1);
  await order.focus();
  await order.selectOption('recent');
  await expect(order).toBeFocused();
  await expect(search).toBeVisible();
  await page.goto('/lists?archived=1');
  await expect(page.locator('.collection-directory-card')).toHaveCount(1);
  await expect(search).toHaveCount(0);
  await capture(page, 'archived', info.project.name);
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await expect(page.locator('.collection-directory-card')).toHaveCount(4);
  expect(archive.writes).toHaveLength(0);
});

test('long collection and activity names reflow without clipping', async ({ page, archive }, info) => {
  archive.list.name = 'My collection with a very long name — ' + 'SomethingIWantToRemember'.repeat(4);
  archive.extraLists = [
    {
      ...structuredClone(list),
      id: crypto.randomUUID(),
      name: 'Gym and a long activity name I want to read without clipping',
      kind: 'activity',
      logCount: 6,
    },
  ];
  await page.goto('/lists');
  const viewport = page.viewportSize()!;
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.collection-directory-copy strong')).toHaveText(archive.list.name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    expect(
      await page
        .locator('.collection-directory-copy')
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  await page.setViewportSize(viewport);
  await capture(page, 'long-names', info.project.name);
});

test('an empty account keeps collection creation available', async ({ page, archive }, info) => {
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  await page.goto('/lists');
  await expect(page.locator('.collection-directory-card')).toHaveCount(0);
  await expect(page.locator('.starter-intro')).toBeVisible();
  await capture(page, 'empty', info.project.name);
  await page.getByRole('button', { name: 'New collection', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
  expect(archive.writes).toHaveLength(0);
});
