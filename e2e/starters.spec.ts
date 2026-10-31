import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list } from './fixtures';

const added = [
  'Skincare',
  'Fragrance',
  'Food & snacks',
  'Recipes',
  'Clothing & gear',
  'Haircare',
  'Makeup',
  'Shows',
  'Experiences',
  'Books',
  'Music',
  'Games',
];

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_STARTERS_QA) return;
  await mkdir(process.env.WORTH_STARTERS_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_STARTERS_QA}/${name}-${project}.png`, fullPage: true });
}

test('starters remain available in a populated archive and create only an empty named collection', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lists?create=1&kind=collection');
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  const toggle = page.locator('.collection-starters > summary');
  const choices = page.getByRole('group', { name: 'Collection starters', exact: true });
  await expect(choices).toBeHidden();
  await toggle.click();
  await expect(choices.getByRole('button')).toHaveCount(16);
  for (const starter of added) {
    const button = choices.getByRole('button', { name: starter, exact: true });
    await expect(button).toBeVisible();
    await expect
      .poll(() => button.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  }
  expect(
    await choices.getByRole('button').evaluateAll((buttons) =>
      buttons.every((button) => {
        const label = button.querySelector(':scope > span')!;
        return label.getBoundingClientRect().bottom <= button.getBoundingClientRect().bottom - 6;
      }),
    ),
  ).toBe(true);
  await capture(page, 'choices', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  const skin = choices.getByRole('button', { name: 'Skincare', exact: true });
  await skin.focus();
  await page.keyboard.press('Enter');
  await expect(choices).toBeHidden();
  await expect(name).toHaveValue('Skincare');
  await expect(name).toBeFocused();
  await expect(page.locator('.cabinet-create-preview img')).toHaveAttribute(
    'src',
    '/art/starter-covers/skincare.svg',
  );
  await capture(page, 'chosen', info.project.name);
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Create collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Skincare', exact: true })).toBeVisible();
  expect(archive.writes).toHaveLength(1);
  expect(archive.writes[0]).toMatchObject({
    path: '/lists',
    body: { name: 'Skincare', description: '', artwork: null, detailFields: [] },
  });
  expect(archive.items).toEqual([]);
  expect(archive.list.rankedIds).toEqual([]);
});

test('choosing a starter preserves personal details and artwork and wraps at narrow widths', async ({
  page,
  archive,
}) => {
  await page.goto('/lists?create=1&kind=collection');
  await page.getByText('Description & cover', { exact: false }).click();
  const description = page.getByPlaceholder('What belongs in this list?');
  await description.fill('My own collection note');
  await page.locator('.create-artwork > summary').click();
  await page.getByRole('button', { name: 'Plant', exact: true }).click();
  await page.locator('.collection-starters > summary').click();
  const choices = page.getByRole('group', { name: 'Collection starters', exact: true });
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await choices.getByRole('button', { name: 'Fragrance', exact: true }).click();
  await expect(description).toHaveValue('My own collection note');
  await expect(page.locator('.cabinet-create-preview img')).toHaveAttribute(
    'src',
    '/art/collection-choices/plant-sage.svg',
  );
  expect(archive.writes).toHaveLength(0);
});

test('first-use starters offer the same artwork without creating data on selection', async ({
  page,
  archive,
}, info) => {
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  await page.goto('/lists?kind=collection');
  const starters = page.locator('.list-suggestions');
  for (const starter of added)
    await expect(starters.getByRole('button', { name: `${starter} collection`, exact: true })).toBeVisible();
  await capture(page, 'empty', info.project.name);
  await starters.getByRole('button', { name: 'Recipes collection', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Recipes');
  await expect(page.locator('.cabinet-create-preview img')).toHaveAttribute(
    'src',
    '/art/starter-covers/recipes.svg',
  );
  expect(archive.writes).toHaveLength(0);
});

test('activity starter objects stay decorative in the directory and first-use choices', async ({
  page,
  archive,
}, info) => {
  archive.extraLists = ['Gym', 'Runs', 'Upkeep'].map((name) => ({
    ...structuredClone(list),
    id: crypto.randomUUID(),
    name,
    kind: 'activity',
    itemCount: 0,
    logCount: 0,
  }));
  await page.goto('/lists?kind=activity');
  await expect(page.locator('.activity-directory-grid img')).toHaveCount(3);
  await expect
    .poll(() =>
      page
        .locator('.activity-directory-grid img')
        .evaluateAll((images: HTMLImageElement[]) => images.every((image) => image.naturalWidth > 0)),
    )
    .toBe(true);
  await capture(page, 'activities', info.project.name);
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  await page.reload();
  await expect(page.locator('.list-suggestions img')).toHaveCount(3);
  await capture(page, 'activity-starters', info.project.name);
  await page.getByRole('button', { name: 'Gym activity', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Gym');
  await expect(page.getByRole('button', { name: 'Create activity', exact: true })).toBeVisible();
  await expect(page.locator('.call-face')).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});
