import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import type { PreferenceGroup, Preferences } from '../src/shared/memories';

const brand: PreferenceGroup = {
  listId: list.id,
  listName: 'Skincare',
  kind: 'brand',
  basis: 'records',
  name: 'Harbor',
  favorite: 4,
  meh: 1,
  notAgain: 0,
  unrated: 3,
};
const longLabel = 'The recommendations I kept from that little place around the corner';
const preferences: Preferences = {
  groups: [
    brand,
    { ...brand, kind: 'type', basis: 'visits', name: 'Coffee', favorite: 0, meh: 0, notAgain: 3, unrated: 1 },
    { ...brand, listId: 'inbox', listName: 'Unfiled', kind: 'collection', favorite: 0, meh: 1, unrated: 2 },
    { ...brand, kind: 'label', name: longLabel, favorite: 1, meh: 1, unrated: 0 },
    { ...brand, kind: 'type', name: 'Still undecided', favorite: 0, meh: 0, notAgain: 0, unrated: 2 },
  ],
  returns: [],
  rediscover: [],
};

async function capture(page: Page, name: string, project: string) {
  const directory = process.env.WORTH_INSIGHTS_QA;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}-${project}.png`, animations: 'disabled' });
}

test('insights lead with recorded calls, distinguish visit reactions and disclose all supporting groups', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/preferences', (route) => route.fulfill({ json: preferences }));
  await page.goto('/patterns?view=insights');
  const cards = page.locator('.preference-grid > article');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0).getByRole('heading')).toHaveText('Harbor');
  await expect(cards.nth(0).locator('.preference-observation')).toHaveText(
    'You marked 4 of 5 rated things Favorite.',
  );
  await expect(cards.nth(0)).toContainText('3 without a call');
  await expect(cards.nth(0).getByRole('link')).toHaveAttribute(
    'href',
    `/patterns/remember?mode=saved&list=${list.id}&brand=Harbor`,
  );
  await expect(cards.nth(1)).toContainText('Visit reactions');
  await expect(cards.nth(1).locator('.preference-observation')).toHaveText(
    'You marked 3 of 3 rated visits Not again.',
  );
  await expect(cards.nth(1)).toContainText('1 without a reaction');
  await expect(cards.nth(1).getByRole('link')).toHaveAttribute(
    'href',
    `/patterns/remember?mode=visits&list=${list.id}&type=Coffee`,
  );
  await expect(cards.nth(2).getByRole('heading')).toHaveText('Unfiled');
  await expect(cards.nth(2).locator('.preference-observation')).toHaveText(
    'You marked 1 of 1 rated thing Meh.',
  );
  await expect(cards.nth(2)).toContainText('A small sample');
  await expect(cards.nth(2).getByRole('link')).toHaveAttribute(
    'href',
    '/patterns/remember?mode=saved&list=inbox',
  );
  await capture(page, 'insights', info.project.name);
  const toggle = page.getByRole('button', { name: 'Show all 5 groups', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(3).locator('.preference-observation')).toHaveText(
    'A mix of calls across 2 rated things.',
  );
  await expect(cards.nth(3)).toContainText('A small sample');
  await expect(cards.nth(4).locator('.preference-observation')).toHaveText('No calls recorded yet.');
  await expect(cards.nth(4)).not.toContainText('0 of 0');
  await expect(cards.nth(4)).toContainText('2 without a call');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    await cards.nth(3).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    const rows = await cards
      .nth(3)
      .locator('.preference-counts dd')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1);
    await capture(page, 'insights-width-' + width, info.project.name);
  }
  await page.getByRole('button', { name: 'Show fewer groups', exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Show all 5 groups', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Your calls, on record.' })).toBeHidden();
  await page.getByText('Archive totals', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your calls, on record.' })).toBeVisible();
  await expect(page.locator('.call-summary > div')).toHaveCount(3);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(archive.writes).toHaveLength(0);
});

test('preferences have honest loading, retry and empty states with a way back to saved things', async ({
  page,
  archive,
}, info) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failed = true;
  await page.route('**/api/preferences', async (route) => {
    await pending;
    if (failed) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
    return route.fulfill({ json: { groups: [], returns: [], rediscover: [] } });
  });
  await page.goto('/patterns?view=insights');
  await expect(page.getByRole('status').filter({ hasText: 'Reading your preferences' })).toBeVisible();
  await capture(page, 'loading', info.project.name);
  release();
  const preferencesRegion = page.getByRole('region', { name: 'Your calls.', exact: true });
  await expect(preferencesRegion.getByRole('alert')).toContainText('Preferences couldn’t load');
  await capture(page, 'retry', info.project.name);
  failed = false;
  await preferencesRegion.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(preferencesRegion.getByRole('alert')).toHaveCount(0);
  await expect(preferencesRegion).toContainText('No calls to summarize yet. Browse what you saved.');
  await expect(page.locator('.preference-grid > article')).toHaveCount(0);
  await capture(page, 'empty', info.project.name);
  await preferencesRegion.getByRole('link', { name: 'Browse saved things', exact: false }).click();
  await expect(page).toHaveURL(/\/patterns\/remember\?mode=saved$/);
  expect(archive.writes).toHaveLength(0);
});
