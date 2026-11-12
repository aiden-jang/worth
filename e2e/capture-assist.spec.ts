import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list } from './fixtures';
import { inboxPayload } from '../src/shared/inbox';
import { experienceInput } from '../src/shared/memories';

async function openAdd(page: Page) {
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  return page.getByRole('dialog', { name: 'Add item', exact: true });
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_ASSIST_QA) return;
  await mkdir(process.env.WORTH_ASSIST_QA, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${process.env.WORTH_ASSIST_QA}/${name}-${project}.png` });
}
const unfiled = () => ({
  ...inboxPayload.parse({
    title: 'An illustrated book',
    type: 'Book',
    note: 'The illustrated edition',
    decision: 'meh',
    memory: { happenedOn: '2025-04-12', reaction: 'favorite' },
  }),
  id: '33333333-3333-4333-8333-333333333333',
  revision: 3,
  createdAt: 1,
  updatedAt: 1,
});

test('Add accepts a link and photo text inside the same draft without a detour', async ({
  page,
  archive,
}, info) => {
  await page.goto('/');
  const add = await openAdd(page);
  await add.getByRole('button', { name: 'Save with details', exact: true }).click();
  await add.getByRole('button', { name: 'Meh', exact: true }).click();
  await add.getByRole('button', { name: 'Paste link', exact: true }).click();
  await add.getByLabel('Link', { exact: true }).fill('https://example.test/corner-ramen');
  await add.getByRole('button', { name: 'Use link', exact: true }).click();
  await expect(add.getByLabel('Name', { exact: true })).toHaveValue('corner ramen');
  await add.getByRole('button', { name: 'Photo text', exact: true }).click();
  await add.getByLabel('Read or pasted text', { exact: true }).fill('Corner ramen\nShoyu ramen\nExtra egg');
  await add.getByRole('button', { name: 'Use Shoyu ramen', exact: true }).click();
  await expect(add.getByLabel('Name', { exact: true })).toHaveValue('Shoyu ramen');
  await expect(add.getByRole('button', { name: 'Meh', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'add-sources', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await add.getByRole('button', { name: /^(Quick save|Save item|Save entry|Save)$/ }).click();
  await expect(add).toHaveCount(0);
  expect(archive.inbox.at(-1)).toMatchObject({
    title: 'Shoyu ramen',
    decision: 'meh',
    context: { sourceUrl: 'https://example.test/corner-ramen' },
  });
  expect(archive.logs).toHaveLength(0);
});

test('photo reading runs in the Add dialog and keeps its photo off the saved item', async ({
  page,
  archive,
}, info) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const add = await openAdd(page);
  await add.getByRole('button', { name: 'Photo text', exact: true }).click();
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1100;
    canvas.height = 260;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1100, 260);
    context.fillStyle = '#000';
    context.font = '60px Arial';
    context.fillText('ILLUSTRATED EDITION', 50, 130);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await add
    .getByLabel('Choose photo to read', { exact: true })
    .setInputFiles({ name: 'book.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await expect(add.getByRole('button', { name: 'Use ILLUSTRATED EDITION', exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await capture(page, 'photo-reading', info.project.name);
  await add.getByRole('button', { name: 'Use ILLUSTRATED EDITION', exact: true }).click();
  await add.getByRole('button', { name: /^(Quick save|Save item|Save entry|Save)$/ }).click();
  await expect(add).toHaveCount(0);
  expect(archive.inbox.at(-1)).toMatchObject({ title: 'ILLUSTRATED EDITION' });
  expect(archive.inbox.at(-1)?.photo).toBeFalsy();
});

test('an ISBN only leaves the device after Look up and its reviewed details can be saved', async ({
  page,
  archive,
}) => {
  const lookups: string[] = [];
  await page.route('https://openlibrary.org/**', (route) => {
    lookups.push(route.request().url());
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: {
        'ISBN:9780140328721': { title: 'Matilda', authors: [{ name: 'Roald Dahl' }], publish_date: '1988' },
      },
    });
  });
  await page.goto('/');
  const add = await openAdd(page);
  await add.getByRole('button', { name: 'Barcode', exact: true }).click();
  await add.getByLabel('Barcode or ISBN', { exact: true }).fill('9780140328721');
  expect(lookups).toEqual([]);
  await add.getByRole('button', { name: 'Look up book', exact: true }).click();
  await add.getByRole('button', { name: 'Use book details', exact: true }).click();
  await add.getByRole('button', { name: /^(Quick save|Save item|Save entry|Save)$/ }).click();
  await expect(add).toHaveCount(0);
  expect(lookups).toHaveLength(1);
  expect(archive.inbox.at(-1)).toMatchObject({
    title: 'Matilda',
    type: 'Book',
    note: 'Author: Roald Dahl\nPublished: 1988',
    context: { fields: [{ name: 'Barcode', value: '9780140328721' }] },
  });
});

test('typing a saved name offers another experience instead of silently duplicating it', async ({
  page,
  archive,
}, info) => {
  archive.items[0].id = '22222222-2222-4222-8222-222222222222';
  archive.list.rankedIds = [archive.items[0].id];
  await page.route('**/api/lists/*/experiences', async (route) => {
    const body = experienceInput.parse(route.request().postDataJSON());
    const log = {
      id: crypto.randomUUID(),
      listId: list.id,
      itemId: body.itemId,
      title: body.title,
      happenedOn: body.happenedOn,
      note: body.note,
      context: body.context,
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    archive.logs.push(log);
    return route.fulfill({ json: { item: archive.items[0], log } });
  });
  await page.goto(`/lists/${list.id}`);
  const add = await openAdd(page);
  await add.getByLabel('Name', { exact: true }).fill('Coffee');
  await expect(add.getByRole('button', { name: /^(Quick save|Save item|Save entry|Save)$/ })).toBeDisabled();
  await expect(add.getByRole('link', { name: 'Open item', exact: true })).toBeVisible();
  await capture(page, 'existing-name', info.project.name);
  await add.getByRole('button', { name: 'Add another experience', exact: true }).click();
  await add.getByLabel('When', { exact: true }).fill('2026-01-02');
  await add
    .getByRole('group', { name: 'This time', exact: true })
    .getByRole('button', { name: 'Meh', exact: true })
    .click();
  await add.getByRole('button', { name: /^(Quick save|Save item|Save entry|Save)$/ }).click();
  await expect(add).toHaveCount(0);
  expect(archive.items).toHaveLength(2);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.logs[0]).toMatchObject({
    itemId: archive.items[0].id,
    happenedOn: '2026-01-02',
    context: { reaction: 'meh' },
  });
});

test('direct Unfiled filing preserves its memory and retries the same operation after a lost reply', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [unfiled()];
  archive.failInboxFileReply = true;
  await page.goto('/inbox');
  const actions = page.getByRole('group', { name: 'File An illustrated book', exact: true });
  await capture(page, 'unfiled-row', info.project.name);
  await actions.getByRole('button', { name: 'My drinks', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry same filing', exact: true })).toBeVisible();
  const first = structuredClone(archive.writes.find((write) => write.path.endsWith('/file')));
  await page.reload();
  await page.getByRole('button', { name: 'Retry same filing', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open filed record →', exact: true })).toBeVisible();
  expect(archive.inbox).toHaveLength(0);
  expect(archive.items.filter((entry) => entry.title === 'An illustrated book')).toHaveLength(1);
  expect(archive.writes.filter((write) => write.path.endsWith('/file'))[1]).toEqual(first);
  expect(archive.items.at(-1)).toMatchObject({ decision: 'meh', note: 'The illustrated edition' });
  expect(archive.logs.at(-1)).toMatchObject({ happenedOn: '2025-04-12', context: { reaction: 'favorite' } });
});

test('an Unfiled row can create its destination and file without an editor', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [unfiled()];
  await page.goto('/inbox');
  const actions = page.getByRole('group', { name: 'File An illustrated book', exact: true });
  await actions.getByRole('button', { name: 'New collection', exact: true }).click();
  await actions.getByLabel('Collection name', { exact: true }).fill('Books');
  await capture(page, 'create-and-file', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await actions.getByRole('button', { name: 'Create & file', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open filed record →', exact: true })).toBeVisible();
  expect(archive.list.name).toBe('Books');
  expect(archive.inbox).toHaveLength(0);
  expect(archive.items.at(-1)?.title).toBe('An illustrated book');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(archive.writes.some((write) => write.path === '/inbox/33333333-3333-4333-8333-333333333333')).toBe(
    false,
  );
});
