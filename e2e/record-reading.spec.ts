import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { inboxPayload } from '../src/shared/inbox';
import { emptyItemContext } from '../src/shared/item-context';
import type { Log } from '../src/shared/models';
import { test, expect, list } from './fixtures';
import { editItem } from './navigation';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_READING_QA) return;
  await mkdir(process.env.WORTH_READING_QA, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${process.env.WORTH_READING_QA}/${name}-${project}.png` });
}

test('search opens saved details without editing and Edit preserves an unfinished draft', async ({
  page,
  archive,
}, info) => {
  archive.items[0].context = {
    ...emptyItemContext,
    recommendedBy: 'Sam',
    fields: [{ name: 'Brand', value: 'Blue Moon' }],
  };
  archive.logs = [
    {
      id: 'visit',
      listId: list.id,
      itemId: 'coffee',
      title: '',
      happenedOn: '2026-10-12',
      note: 'A quiet afternoon.',
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  await page.route('**/api/search?*', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 'coffee',
            kind: 'item',
            listId: list.id,
            listName: list.name,
            title: 'Coffee',
            note: 'PRIVATE NOTE',
          },
        ],
        nextOffset: null,
      },
    }),
  );
  await page.goto('/search?q=coffee');
  await page.locator('#search-item-coffee').click();
  const reader = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await expect(reader.getByRole('textbox')).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Favorite', exact: true })).toHaveCount(0);
  await expect(reader).toContainText('PRIVATE NOTE');
  await expect(reader).toContainText('Blue Moon');
  await capture(page, 'saved-item', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await reader.getByRole('button', { name: /A quiet afternoon/ }).click();
  const experience = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await expect(experience.getByRole('textbox')).toHaveCount(0);
  await expect(experience).toContainText('A quiet afternoon.');
  await experience.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  const visitEditor = page.locator('.collection-log-dialog');
  await expect(visitEditor.getByRole('textbox', { name: 'Private note optional', exact: true })).toHaveValue(
    'A quiet afternoon.',
  );
  await visitEditor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(experience.getByRole('textbox')).toHaveCount(0);
  await experience.getByRole('button', { name: 'Close details' }).click();
  expect(archive.writes).toEqual([]);
  await editItem(page, 'Coffee');
  const editor = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await editor.getByRole('textbox', { name: 'Name', exact: true }).fill('Coffee draft');
  await page.goto(`/lists/${list.id}?focus=item:coffee`);
  await expect(editor.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Coffee draft');
  await page.goto(`/lists/${list.id}?focus=item:coffee&view=1`);
  await expect(reader.getByRole('heading', { name: 'Coffee', exact: true })).toBeVisible();
  await expect(reader.getByRole('textbox')).toHaveCount(0);
  await reader.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Coffee draft');
  expect(archive.writes).toEqual([]);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Coffee draft', exact: true }).getByText('Saved.', { exact: true }),
  ).toBeVisible();
  expect(archive.items[0].title).toBe('Coffee draft');
});

test('Unfiled opens a newly saved find on the same page and distinguishes View from Edit', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [
    {
      ...inboxPayload.parse({ title: 'An earlier find' }),
      id: '22222222-2222-4222-8222-222222222222',
      revision: 0,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  await page.goto('/inbox');
  let release!: () => void;
  const refresh = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/inbox', async (route) => {
    if (route.request().method() === 'GET' && archive.inbox.length > 1) await refresh;
    await route.fallback();
  });
  await page.getByRole('main').getByRole('button', { name: 'Add item', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add item', exact: true });
  await add.getByLabel('Name', { exact: true }).fill('A new find');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  const openSaved = page.locator('.entry-saved').getByRole('link', { name: 'Open', exact: true });
  await openSaved.click();
  try {
    await expect(page.getByRole('status').filter({ hasText: 'Opening saved find…' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Unavailable find', exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  const reader = page.getByRole('dialog', { name: 'A new find', exact: true });
  await expect(reader.getByRole('textbox')).toHaveCount(0);
  if (info.project.name === 'desktop') expect((await reader.boundingBox())!.width).toBeLessThanOrEqual(520);
  await capture(page, 'unfiled-reader', info.project.name);
  await reader.getByRole('button', { name: 'Close details' }).click();
  await expect(openSaved).toBeFocused();
  const viewEarlier = page.getByRole('button', { name: 'View An earlier find', exact: true });
  const earlier = page.getByRole('dialog', { name: 'An earlier find', exact: true });
  await viewEarlier.click();
  await expect(earlier).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(earlier).toHaveCount(0);
  await expect(viewEarlier).toBeFocused();
  await page.getByRole('button', { name: 'Edit A new find', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await expect(editor.getByLabel('Name', { exact: true })).toHaveValue('A new find');
  await editor.getByRole('button', { name: 'Close find' }).click();
  await expect(page.getByRole('button', { name: 'Edit A new find', exact: true })).toBeFocused();
  archive.items[1].type = '';
  await page.goto(`/lists/${list.id}?focus=item:tea&view=1`);
  const nameOnly = page.getByRole('dialog', { name: 'Tea', exact: true });
  await expect(nameOnly.getByRole('button', { name: 'Add experience', exact: true })).toBeVisible();
  await expect(nameOnly.getByRole('heading', { name: /^Experiences/ })).toHaveCount(0);
  if (info.project.name === 'desktop') expect((await nameOnly.boundingBox())!.width).toBeLessThanOrEqual(520);
  expect(archive.writes.filter((write) => write.path === '/inbox')).toHaveLength(1);
  expect(archive.writes).toHaveLength(1);
});

test('activity records are readable with exact sets and closing a deep link stays closed', async ({
  page,
  archive,
}, info) => {
  const log: Log = {
    id: 'exercise',
    listId: 'activity',
    itemId: null,
    title: 'Bench press',
    happenedOn: '2026-10-12',
    note: 'Kept it comfortable.',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
    exercise: true,
    exerciseSets: [
      { reps: 8, weight: 40 },
      { reps: null, weight: null },
    ],
    measurements: [{ name: 'Rest', value: 90, unit: 'seconds' }],
    hasPhoto: false,
    createdAt: 1,
    updatedAt: 1,
  };
  await page.route('**/api/lists/activity/logs', (route) => route.fulfill({ json: { logs: [log] } }));
  await page.goto('/lists/activity?focus=log:exercise&view=1');
  const reader = page.getByRole('dialog', { name: 'Bench press', exact: true });
  await expect(reader.getByRole('cell', { name: '40 (unit not recorded)', exact: true })).toBeVisible();
  await expect(reader.getByRole('cell', { name: 'Not recorded', exact: true })).toBeVisible();
  await expect(reader).toContainText('90 seconds');
  await capture(page, 'saved-exercise', info.project.name);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await reader.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await reader.getByRole('button', { name: 'Close details' }).click();
  await expect(page).toHaveURL(/\/lists\/activity$/);
  await page.reload();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('.activity-main').click();
  await expect(reader.getByRole('textbox')).toHaveCount(0);
  await reader.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.activity-main')).toBeFocused();
  expect(archive.writes).toEqual([]);
});

test('slow page code keeps navigation available and a failed page offers a way home', async ({
  page,
  archive,
}) => {
  let release!: () => void;
  let requested!: () => void;
  const arrived = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/SettingsPage-*.js', async (route) => {
    requested();
    await gate;
    await route.abort('failed');
  });
  await page.goto('/settings', { waitUntil: 'commit' });
  try {
    await arrived;
    await expect(
      page.getByRole('link', { name: 'Home', exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByText('Opening Worth…', { exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'Couldn’t open this page.', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good to keep.', exact: true })).toBeVisible();
  expect(archive.writes).toEqual([]);
});
