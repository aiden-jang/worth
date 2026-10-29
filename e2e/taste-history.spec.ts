import { collectionOptions } from './navigation';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import type { TasteEvent } from '../src/shared/taste-history';
const rank: TasteEvent = {
  id: 'a'.repeat(32),
  kind: 'rank',
  listId: list.id,
  itemId: null,
  before: ['tea', 'coffee', null],
  after: ['coffee', 'tea'],
  reason: 'A quieter order.',
  logId: null,
  revision: 0,
  createdAt: 1791547200000,
};
const opinion: TasteEvent = {
  id: 'b'.repeat(32),
  kind: 'opinion',
  listId: null,
  itemId: 'coffee',
  before: 'meh',
  after: 'favorite',
  reason: '',
  logId: null,
  revision: 0,
  createdAt: 1791633600000,
};
async function setup(page: Page, state: State) {
  const events = [structuredClone(opinion), structuredClone(rank)];
  const reads: URL[] = [],
    writes: unknown[] = [];
  let failRead = false,
    conflict = false;
  await page.route('**/api/lists/*/history?*', (route) => {
    const url = new URL(route.request().url());
    reads.push(url);
    if (failRead)
      return route.fulfill({
        status: 503,
        json: { error: 'UNAVAILABLE', message: 'History is temporarily unavailable.' },
      });
    const cutoff = Number(url.searchParams.get('until') || Infinity);
    const filtered = events.filter((e) => e.createdAt < cutoff);
    return route.fulfill({
      json: {
        events: url.searchParams.get('cursor') ? filtered.slice(1) : filtered.slice(0, 1),
        next: !url.searchParams.get('cursor') && filtered.length > 1 ? 'older' : null,
      },
    });
  });
  await page.route('**/api/history/*', (route) =>
    route.fulfill({ json: { event: events.find((e) => route.request().url().endsWith(e.id)) } }),
  );
  await page.route('**/api/history/*/note', (route) => {
    const body = route.request().postDataJSON() as {
      reason: string;
      logId: string | null;
      expectedRevision: number;
    };
    writes.push(body);
    const entry = events.find((e) => route.request().url().includes(e.id))!;
    if (conflict) {
      conflict = false;
      entry.revision++;
      entry.reason = 'Saved in another tab';
      return route.fulfill({
        status: 409,
        json: {
          error: 'HISTORY_CHANGED',
          message: 'History changed. Keep your draft and reload the saved details.',
        },
      });
    }
    expect(body.expectedRevision).toBe(entry.revision);
    entry.reason = body.reason;
    entry.logId = body.logId;
    entry.revision++;
    return route.fulfill({ json: { event: entry } });
  });
  state.logs = [
    {
      id: '33333333-3333-4333-8333-333333333333',
      listId: list.id,
      itemId: 'coffee',
      title: '',
      happenedOn: '2026-10-09',
      note: 'A second cup',
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: list.updatedAt,
      updatedAt: list.updatedAt,
    },
  ];
  return {
    events,
    reads,
    writes,
    fail() {
      failRead = true;
    },
    recover() {
      failRead = false;
    },
    conflict() {
      conflict = true;
    },
  };
}
async function open(page: Page) {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Taste history', exact: true }).click();
}
async function capture(page: Page, name: string, project: string, target = '.taste-history') {
  if (!process.env.WORTH_HISTORY_QA) return;
  await mkdir(process.env.WORTH_HISTORY_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.locator(target).evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_HISTORY_QA}/${name}-${project}.png` });
}

test('history pages compare real changes, preserve gaps and require sandbox review before applying', async ({
  page,
  archive,
}, info) => {
  const model = await setup(page, archive);
  await open(page);
  await expect(page.getByRole('heading', { name: 'Coffee', exact: true })).toBeVisible();
  await expect(page.locator('.taste-history-event')).toContainText('Meh');
  await expect(page.locator('.taste-history-event')).toContainText('Favorite');
  await capture(page, 'opinions', info.project.name);
  await page.getByRole('button', { name: 'Load older changes' }).click();
  await page.getByRole('button', { name: 'Compare orders' }).click();
  await expect(
    page.getByRole('region', { name: 'Before order' }).getByText('Unavailable record'),
  ).toBeVisible();
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await capture(page, 'orders', info.project.name, '.taste-history-orders');
  await page.getByRole('button', { name: 'Review before order in sandbox' }).click();
  await expect(page.getByRole('button', { name: 'Preview ranking change' })).toBeEnabled();
  expect(archive.list.rankedIds).toEqual(['coffee']);
  expect(model.writes).toEqual([]);
  await page.getByRole('button', { name: 'Preview ranking change' }).click();
  await page.getByRole('button', { name: 'Apply ranking', exact: true }).click();
  await expect(page.getByText('Ranking applied. Calls and revisit plans are unchanged.')).toBeVisible();
  expect(archive.list.rankedIds).toEqual(['tea', 'coffee']);
  expect(archive.items[0].decision).toBe('favorite');
});

test('private reasons link a chosen visit, recover drafts and resolve conflicts explicitly', async ({
  page,
  archive,
}, info) => {
  const model = await setup(page, archive);
  await open(page);
  await page.getByRole('button', { name: 'Reason & visit' }).click();
  await page.getByRole('textbox', { name: 'Reason', exact: true }).fill('PRIVATE reason: changed my mind');
  await page.getByLabel('Visit that changed your mind').selectOption('33333333-3333-4333-8333-333333333333');
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved' })).toBeVisible();
  await capture(page, 'reason', info.project.name, '.history-note-dialog');
  await page.getByRole('button', { name: 'Close reason' }).click();
  await page.getByRole('button', { name: 'Keep draft and close' }).click();
  await page.getByRole('button', { name: 'Reason & visit' }).click();
  await expect(page.getByRole('textbox', { name: 'Reason', exact: true })).toHaveValue(
    'PRIVATE reason: changed my mind',
  );
  model.conflict();
  await page.getByRole('button', { name: 'Save reason', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('History changed');
  await page.getByRole('button', { name: 'Reload saved details' }).click();
  await expect(page.getByText('Saved reason: Saved in another tab')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Reason', exact: true })).toHaveValue(
    'PRIVATE reason: changed my mind',
  );
  await capture(page, 'conflict', info.project.name, '.history-note-dialog');
  await page.getByRole('button', { name: 'Keep draft with this revision' }).click();
  await page.getByRole('button', { name: 'Save reason', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Why it changed.' })).toBeHidden();
  expect(model.events[0]).toMatchObject({
    reason: 'PRIVATE reason: changed my mind',
    logId: '33333333-3333-4333-8333-333333333333',
    revision: 2,
  });
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual(['coffee']);
});

test('older opinion review is optional, empty periods are factual and controls reflow accessibly', async ({
  page,
  archive,
}, info) => {
  const model = await setup(page, archive);
  await open(page);
  await page.getByRole('combobox', { name: 'Changes', exact: true }).selectOption('opinion');
  await page.getByLabel('Before this date (optional)').fill('2026-01-01');
  await expect(
    page.getByText('No saved changes in this period. Existing calls and rankings are unchanged.'),
  ).toBeVisible();
  expect(model.writes).toEqual([]);
  await capture(page, 'empty', info.project.name);
  await page.getByLabel('Before this date (optional)').fill('');
  model.events[0].reason = 'A very long reason '.repeat(80);
  await page.getByLabel('Before this date (optional)').fill('2027-01-01');
  await expect(page.locator('.taste-history-event')).toHaveCount(1);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(
      await page.locator('.workbench-dialog').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
});

test('failed history loads retain retry and blocked device storage never claims a saved reason', async ({
  page,
  archive,
}) => {
  const model = await setup(page, archive);
  model.fail();
  await open(page);
  await expect(
    page.getByRole('alert').filter({ hasText: 'History is temporarily unavailable.' }),
  ).toBeVisible({ timeout: 15000 });
  model.recover();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coffee', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Blocked');
    };
  });
  await page.getByRole('button', { name: 'Reason & visit' }).click();
  await page.getByRole('textbox', { name: 'Reason', exact: true }).fill('Keep for copying');
  await expect(page.getByText('Draft could not be saved on this device. Keep this page open.')).toBeVisible();
  await page.getByRole('button', { name: 'Close reason' }).click();
  await expect(page.getByRole('dialog', { name: 'Close unfinished reason?' })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Close unfinished reason?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: 'Reason', exact: true })).toHaveValue('Keep for copying');
  expect(model.writes).toEqual([]);
});
