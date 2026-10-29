import { mkdir, readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import { inboxPayload } from '../src/shared/inbox';

const photoPath = new URL('../public/icons/icon-192.png', import.meta.url);
async function choosePhoto(page: Page) {
  const section = page.locator('.draft-photo');
  await section.locator('summary').click();
  await section
    .getByLabel('Choose photo', { exact: true })
    .setInputFiles({ name: 'example.png', mimeType: 'image/png', buffer: await readFile(photoPath) });
  await expect(section.getByAltText('Photo ready to attach')).toBeVisible();
}
async function add(page: Page) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  return page.getByRole('dialog', { name: 'Keep something.', exact: true });
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_UNFILED_QA) return;
  await mkdir(process.env.WORTH_UNFILED_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_UNFILED_QA}/${name}-${project}.png` });
}
async function recall(page: Page, state: State) {
  await page.route('**/api/memories?*', (route) => {
    const saved = new URL(route.request().url()).searchParams.get('mode') === 'saved';
    const records = state.inbox
      .filter((entry) => saved || entry.memory)
      .map((entry) => ({
        id: entry.id,
        itemId: null,
        listId: null,
        listName: 'Unfiled',
        title: entry.title,
        note: entry.note,
        date: saved ? new Date(entry.createdAt).toISOString().slice(0, 10) : entry.memory!.happenedOn,
        kind: saved ? 'unfiled' : 'unfiled-visit',
        location: entry.context.location,
        order: '',
        reaction: saved ? entry.decision : entry.memory!.reaction,
        hasPhoto: !!entry.photo?.available,
      }));
    return route.fulfill({ json: { records, total: records.length, nextOffset: null } });
  });
}

test('an outing can keep its date, thought and photo without a collection and opens from recall', async ({
  page,
  archive,
}, info) => {
  await recall(page, archive);
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  await page.goto('/');
  const dialog = await add(page);
  await dialog.getByLabel('Name', { exact: true }).fill('Noodles by the window');
  await dialog.getByText('Add details', { exact: true }).click();
  await dialog.getByLabel('Record a dated experience').check();
  await dialog.getByLabel('When', { exact: true }).fill('2025-02-11');
  await dialog
    .getByRole('textbox', { name: 'Note optional', exact: true })
    .fill('Rain outside. Good company.');
  await dialog
    .getByRole('group', { name: 'This time', exact: true })
    .getByRole('button', { name: 'Favorite', exact: true })
    .click();
  await choosePhoto(page);
  await capture(page, 'add-memory', info.project.name);
  await dialog.evaluate((node) => {
    node.scrollTop = 0;
  });
  await capture(page, 'add-memory-top', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  const originalViewport = page.viewportSize()!;
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await page.setViewportSize(originalViewport);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.inbox).toHaveLength(1);
  expect(archive.inbox[0]).toMatchObject({
    decision: null,
    note: 'Rain outside. Good company.',
    memory: { happenedOn: '2025-02-11', reaction: 'favorite' },
    photo: { available: true },
  });
  expect(archive.logs).toHaveLength(0);
  expect(archive.writes.some((write) => write.path === '/lists')).toBe(false);
  await page.goto('/patterns');
  await expect(page.getByRole('link', { name: 'Noodles by the window ↗', exact: true })).toBeVisible();
  await expect(page.getByAltText('Saved photo for Noodles by the window')).toBeVisible();
  await capture(page, 'memory-recall', info.project.name);
  await page.getByRole('link', { name: 'Noodles by the window ↗', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await expect(editor.getByLabel('When', { exact: true })).toHaveValue('2025-02-11');
  await expect(editor.getByAltText('Saved photo for Noodles by the window')).toBeVisible();
});

test('a lost photo reply restores its frozen capture and retries without duplicate names or uploads', async ({
  page,
  archive,
}) => {
  archive.failInboxPhotoReply = true;
  await page.goto('/');
  let dialog = await add(page);
  await dialog.getByLabel('Name', { exact: true }).fill('A little afternoon');
  await dialog.getByText('Add details', { exact: true }).click();
  await dialog.getByLabel('Record a dated experience').check();
  await dialog.getByLabel('When', { exact: true }).fill('2026-10-20');
  await choosePhoto(page);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Name', { exact: true })).toBeDisabled();
  expect(archive.inbox).toHaveLength(1);
  const id = archive.inbox[0].id,
    key = archive.inbox[0].photo!.id;
  await page.reload();
  dialog = await add(page);
  await expect(dialog.getByText('Photo restored from this device.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.inbox).toHaveLength(1);
  expect(archive.inbox[0]).toMatchObject({ id, revision: 1, photo: { id: key } });
  const writes = archive.writes.filter((write) => write.path.endsWith('/photo'));
  expect(writes).toHaveLength(2);
  expect((writes[0].body as { key: string }).key).toBe((writes[1].body as { key: string }).key);
});

test('an existing Unfiled find can add a memory and photo while preserving its overall call', async ({
  page,
  archive,
}, info) => {
  const id = crypto.randomUUID();
  archive.inbox = [
    {
      ...inboxPayload.parse({ title: 'A corner cafe', decision: 'favorite' }),
      id,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
  await page.goto(`/inbox?focus=${id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByText('Memory details', { exact: false }).click();
  await editor.getByLabel('Record a dated experience').check();
  await editor.getByLabel('When', { exact: true }).fill('2026-10-20');
  await editor
    .getByRole('group', { name: 'This time', exact: true })
    .getByRole('button', { name: 'Meh', exact: true })
    .click();
  await editor.getByRole('textbox', { name: 'Private note', exact: true }).fill('A quiet table.');
  await choosePhoto(page);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByText('Changes saved. Still in Unfiled.', { exact: true })).toBeVisible();
  expect(archive.inbox[0]).toMatchObject({
    decision: 'favorite',
    memory: { happenedOn: '2026-10-20', reaction: 'meh' },
    photo: { available: true },
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await capture(page, 'edit-memory', info.project.name);
  await editor.evaluate((node) => {
    node.scrollTop = 0;
  });
  await capture(page, 'edit-memory-top', info.project.name);
  await editor.getByRole('button', { name: 'Remove saved photo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Remove this saved photo?', exact: true })).toBeVisible();
  expect(archive.inbox[0].photo?.available).toBe(true);
  await page
    .getByRole('dialog', { name: 'Remove this saved photo?', exact: true })
    .getByRole('button', { name: 'Remove photo', exact: true })
    .click();
  await expect.poll(() => archive.inbox[0].photo).toBeNull();
  expect(archive.inbox[0].memory?.happenedOn).toBe('2026-10-20');
});

test('an existing find recovers an interrupted photo save without rewriting its saved details', async ({
  page,
  archive,
}) => {
  const id = crypto.randomUUID();
  archive.inbox = [
    {
      ...inboxPayload.parse({ title: 'The tiny bookshop', note: 'Original thought' }),
      id,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
  archive.failInboxPhotoReply = true;
  await page.goto(`/inbox?focus=${id}`);
  let editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole('textbox', { name: 'Private note', exact: true }).fill('Found a little treasure.');
  await choosePhoto(page);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  const photoId = archive.inbox[0].photo!.id;
  expect(archive.inbox[0].revision).toBe(2);
  await page.reload();
  editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await expect(editor).toBeVisible();
  await expect(editor.getByText('Photo restored from this device.', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(editor.getByText('Changes saved. Still in Unfiled.', { exact: true })).toBeVisible();
  expect(archive.inbox).toHaveLength(1);
  expect(archive.inbox[0]).toMatchObject({
    id,
    revision: 2,
    note: 'Found a little treasure.',
    photo: { id: photoId, available: true },
  });
});

test('filing an Unfiled memory keeps its visit link and a lost reply retries the same filing', async ({
  page,
  archive,
}) => {
  const id = crypto.randomUUID();
  archive.inbox = [
    {
      ...inboxPayload.parse({
        title: 'The window seat',
        memory: { happenedOn: '2026-10-20', reaction: 'meh' },
      }),
      id,
      revision: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
  archive.failInboxFileReply = true;
  await page.goto(`/inbox?focus=${id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByLabel('Destination collection').selectOption(list.id);
  await editor.getByRole('button', { name: 'File in collection', exact: true }).click();
  const pending = page.getByRole('region', { name: 'Pending filing', exact: true });
  await expect(pending.getByRole('alert')).toBeVisible();
  await pending.getByRole('button', { name: 'Retry same filing', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open filed record →', exact: true })).toHaveAttribute(
    'href',
    `/lists/${list.id}?focus=log:${archive.logs[0].id}`,
  );
  expect(archive.logs).toHaveLength(1);
  expect(archive.inbox).toHaveLength(0);
});

test('attaching a photo to a saved name never invents an experienced date', async ({ page, archive }) => {
  await page.goto('/');
  const dialog = await add(page);
  await dialog.getByLabel('Name', { exact: true }).fill('Maybe next time');
  await dialog.getByText('Add details', { exact: true }).click();
  await expect(dialog.getByLabel('When', { exact: true })).toHaveCount(0);
  await choosePhoto(page);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.inbox[0].memory).toBeNull();
  expect(archive.inbox[0].photo?.available).toBe(true);
  expect(archive.logs).toHaveLength(0);
});
