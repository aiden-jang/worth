import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list } from './fixtures';
import type { Log } from '../src/shared/models';
import { emptyVisitContext } from '../src/shared/visit-context';
const logId = '55555555-5555-4555-8555-555555555555';
test.beforeEach(async ({ archive }) => {
  archive.logs = [
    {
      id: logId,
      listId: list.id,
      itemId: archive.items[0].id,
      title: '',
      happenedOn: '2026-10-15',
      note: 'Earlier note',
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: list.updatedAt,
      updatedAt: list.updatedAt,
      revision: 0,
    } satisfies Log,
  ];
});
async function open(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}?focus=log:${logId}`);
  const dialog = page.locator('.collection-log-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_VISIT_QA) return;
  await mkdir(process.env.WORTH_VISIT_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_VISIT_QA}/${name}-${project}.png` });
}

test('visit details save separately from the overall call and appear in private history', async ({
  page,
  archive,
}, info) => {
  const dialog = await open(page);
  await dialog.locator('.visit-context-fields > summary').click();
  await dialog.getByRole('textbox', { name: 'Visit location', exact: true }).fill('Brooklyn corner');
  await dialog.getByRole('textbox', { name: 'Visit version or edition', exact: true }).fill('Winter menu');
  await dialog
    .getByRole('textbox', { name: 'Order or setup', exact: true })
    .fill('Pistachio latte\nLess ice');
  await dialog.getByRole('combobox', { name: 'Visit reaction', exact: true }).selectOption('would_not_again');
  await dialog.getByRole('combobox', { name: 'Visit reaction', exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'editor', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.logs[0].context).toMatchObject({
    location: 'Brooklyn corner',
    version: 'Winter menu',
    order: 'Pistachio latte\nLess ice',
    reaction: 'would_not_again',
  });
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await page.locator('.history-row .visit-context-readout > summary').click();
  await expect(page.locator('.history-row')).toContainText('Not again this time');
  await page.locator('.history-row .visit-context-readout').scrollIntoViewIfNeeded();
  await capture(page, 'history', info.project.name);
  await page.reload();
  await expect(page.locator('.collection-log-dialog')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Visit location', exact: true })).toHaveValue(
    'Brooklyn corner',
  );
});

test('unfinished visit drafts recover and concurrent changes need an explicit reload', async ({
  page,
  archive,
}) => {
  let dialog = await open(page);
  await dialog.locator('.visit-context-fields > summary').click();
  await dialog.getByRole('textbox', { name: 'Visit location', exact: true }).fill('Unfinished location');
  await expect(dialog.getByRole('status')).toContainText('Draft saved');
  await page.reload();
  dialog = page.locator('.collection-log-dialog');
  await expect(dialog.getByRole('textbox', { name: 'Visit location', exact: true })).toHaveValue(
    'Unfinished location',
  );
  archive.logs[0].revision = 1;
  archive.logs[0].note = 'Another session’s note';
  archive.logs[0].context = { ...emptyVisitContext, location: 'Saved elsewhere' };
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed elsewhere');
  await expect(dialog.getByRole('textbox', { name: 'Visit location', exact: true })).toHaveValue(
    'Unfinished location',
  );
  await dialog.getByRole('button', { name: 'Reload saved visit', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Replace this visit draft?', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Reload saved visit', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(dialog.getByRole('textbox', { name: 'Visit location', exact: true })).toHaveValue(
    'Saved elsewhere',
  );
  await expect(dialog.getByRole('textbox', { name: 'Private note', exact: false })).toHaveValue(
    'Another session’s note',
  );
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
});

test('a failed visit save preserves fields and a new revisit keeps the simple date-and-note flow', async ({
  page,
  archive,
}) => {
  const dialog = await open(page);
  await dialog.getByRole('textbox', { name: 'Private note', exact: false }).fill('Changed note');
  let fail = true;
  await page.route(`**/api/logs/${logId}`, (route) =>
    fail
      ? route.fulfill({ status: 503, json: { message: 'Could not save this visit. Try again.' } })
      : route.fallback(),
  );
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save');
  await expect(dialog.getByRole('textbox', { name: 'Private note', exact: false })).toHaveValue(
    'Changed note',
  );
  fail = false;
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const editor = page.locator('.item-editor-dialog');
  await editor.getByRole('textbox', { name: 'Note', exact: true }).fill('A new visit');
  await editor.getByRole('button', { name: 'Log again', exact: true }).click();
  await expect(page.locator('.collection-log-dialog')).toBeVisible();
  expect(archive.logs).toHaveLength(2);
  expect(archive.logs[1].note).toBe('A new visit');
  expect(archive.items[0].decision).toBe('favorite');
});

test('long visit details fit narrow history and editor layouts without clipping', async ({
  page,
  archive,
}, info) => {
  archive.logs[0].context = {
    location: 'A'.repeat(120),
    version: 'B'.repeat(120),
    order: 'C'.repeat(500),
    reaction: 'meh',
  };
  const dialog = await open(page);
  const widths = info.project.name === 'desktop' ? [320, 430, 768, 1440] : [390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    expect(await dialog.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    const reaction = await dialog
      .getByRole('combobox', { name: 'Visit reaction', exact: true })
      .boundingBox();
    expect(reaction?.height).toBeGreaterThanOrEqual(44);
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.history-row .visit-context-readout > summary').click();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    expect(
      await page.locator('.history-note').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    await expect(page.locator('.history-note dd').filter({ hasText: 'C'.repeat(500) })).toBeVisible();
  }
});
