import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { today } from '../src/format';

async function capture(page: Page, name: string, project: string) {
  const directory = process.env.WORTH_HIGHLIGHTS_QA;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}-${project}.png`, animations: 'disabled' });
}

test('returning Home waits for stale observations to refresh before choosing its source', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00Z') });
  let reads = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/preferences', async (route) => {
    reads++;
    if (reads > 1) await pending;
    return route.fulfill({
      json: {
        groups: [
          {
            listId: list.id,
            listName: 'Skincare',
            kind: 'brand',
            basis: 'records',
            name: reads === 1 ? 'Earlier calls' : 'Current calls',
            favorite: 4,
            meh: 1,
            notAgain: 0,
            unrated: 0,
          },
        ],
        returns: [],
        rediscover: [],
      },
    });
  });
  await page.goto('/patterns?view=insights');
  await expect(page.getByRole('heading', { name: 'Earlier calls', exact: true })).toBeVisible();
  await page.clock.fastForward(31_000);
  const memoryRead = page.waitForResponse((response) => response.url().includes('/api/memories?'));
  const progressRead = page.waitForResponse((response) => response.url().endsWith('/api/home-progress'));
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByText('More from your archive', { exact: true }).click();
  await Promise.all([memoryRead, progressRead]);
  await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  const shelf = page.getByRole('region', { name: 'Memory shelf', exact: true });
  await expect.poll(() => reads).toBe(2);
  await expect(shelf.getByRole('status')).toContainText('Opening a little');
  await expect(shelf.getByRole('heading', { name: 'Earlier calls', exact: true })).toHaveCount(0);
  release();
  await expect(shelf.getByRole('heading', { name: 'Current calls', exact: true })).toBeVisible();
});

test('Home keeps the chosen preference stable, refreshes its counts and can explicitly pull a memory', async ({
  page,
  archive,
}, info) => {
  archive.list.name = 'Skincare';
  let groups = [
    {
      listId: list.id,
      listName: 'Skincare',
      kind: 'brand',
      basis: 'records',
      name: 'Harbor',
      favorite: 4,
      meh: 1,
      notAgain: 0,
      unrated: 3,
    },
  ];
  await page.route('**/api/preferences', (route) =>
    route.fulfill({ json: { groups, returns: [], rediscover: [] } }),
  );
  await page.route('**/api/memories?*', (route) => {
    const saved = new URL(route.request().url()).searchParams.get('mode') === 'saved';
    return route.fulfill({
      json: {
        records: saved
          ? [
              {
                id: 'coffee',
                itemId: 'coffee',
                listId: list.id,
                listName: 'Skincare',
                title: 'The little lotion',
                kind: 'saved',
                date: '2026-10-01',
                note: '',
                location: '',
                order: '',
                reaction: null,
                hasPhoto: false,
              },
            ]
          : [],
        total: saved ? 1 : 0,
        nextOffset: null,
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByText('More from your archive', { exact: true }).click();
  const shelf = page.getByRole('region', { name: 'Memory shelf', exact: true });
  await expect(shelf.getByRole('heading', { name: 'Harbor', exact: true })).toBeVisible();
  await expect(shelf).toContainText('You marked 4 of 5 rated things Favorite.');
  await expect(shelf).toContainText('3 without a call');
  await expect(shelf.locator('.call-face')).toHaveCount(0);
  await expect(shelf.getByRole('link', { name: 'See supporting records' })).toHaveAttribute(
    'href',
    `/patterns/remember?mode=saved&list=${list.id}&brand=Harbor`,
  );
  await shelf.evaluate((node) => node.scrollIntoView({ block: 'center' }));
  await capture(page, 'home-preference', info.project.name);
  groups = [
    { ...groups[0], name: 'A new leading brand', favorite: 9 },
    { ...groups[0], favorite: 5 },
  ];
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add item', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('A quick unfiled find');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(shelf).toContainText('You marked 5 of 6 rated things Favorite.');
  await expect(shelf.getByRole('heading', { name: 'Harbor', exact: true })).toBeVisible();
  await expect(shelf.getByRole('heading', { name: 'A new leading brand', exact: true })).toHaveCount(0);
  const draw = shelf.getByRole('button', { name: 'Pull a memory', exact: true });
  await draw.focus();
  await page.keyboard.press('Enter');
  await expect(shelf.getByRole('heading', { name: 'The little lotion', exact: true })).toBeVisible();
  await expect(shelf.getByRole('button', { name: 'Another memory', exact: true })).toBeFocused();
  await expect(shelf).toContainText('Saved Oct 1, 2026 (UTC)');
  await expect(shelf.locator('.call-face')).toHaveCount(0);
  expect(archive.writes.filter((write) => write.path.includes('/logs'))).toHaveLength(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('Home progress shows the recorded unit, comparison and source while staying compact at every width', async ({
  page,
  archive,
}, info) => {
  archive.list.kind = 'activity';
  archive.list.name = 'Gym';
  archive.list.logCount = 2;
  archive.items = [];
  await page.route('**/api/overview', (route) =>
    route.fulfill({
      json: {
        lists: [archive.list],
        recent: [
          {
            id: 'current',
            title: 'Bench press',
            listName: 'Gym',
            listId: list.id,
            itemId: null,
            recordKind: 'log',
            happenedOn: today(),
            recordedAt: Date.now(),
            decision: null,
          },
        ],
      },
    }),
  );
  await page.route('**/api/home-progress', (route) =>
    route.fulfill({
      json: {
        progress: {
          listId: list.id,
          listName: 'Gym',
          workoutId: 'visit',
          workoutTitle: 'Push day',
          logId: 'current',
          title: 'Bench press',
          happenedOn: today(),
          weight: 40,
          unit: 'kg',
          reps: 10,
          previous: 8,
        },
      },
    }),
  );
  await page.goto('/');
  await page.getByText('More from your archive', { exact: true }).click();
  const shelf = page.getByRole('region', { name: 'Memory shelf', exact: true });
  await expect(shelf.getByRole('heading', { name: 'Bench press', exact: true })).toBeVisible();
  await expect(shelf).toContainText('40 kg × 10 reps');
  await expect(shelf).toContainText('Previous recorded best at this weight: 8 reps.');
  await expect(shelf.getByRole('link', { name: 'View recorded sets', exact: false })).toHaveAttribute(
    'href',
    `/lists/${list.id}?focus=log:current&view=1`,
  );
  await expect(shelf.locator('.call-face')).toHaveCount(0);
  await shelf.scrollIntoViewIfNeeded();
  await capture(page, 'home-progress', info.project.name);
  for (const width of [320, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
  }
  expect(archive.writes).toHaveLength(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
