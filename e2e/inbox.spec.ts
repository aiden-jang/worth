import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { itemInput } from '../src/shared/validation';
import { test, expect, list } from './fixtures';

const find = (title = 'A tiny illustrated book') => ({
  ...itemInput.parse({
    title,
    type: 'Book',
    note: 'Try the illustrated edition.',
    context: { sourceUrl: 'https://example.test/book', recommendedBy: 'Sam' },
  }),
  id: '22222222-2222-4222-8222-222222222222',
  revision: 0,
  createdAt: list.updatedAt,
  updatedAt: list.updatedAt,
});
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_INBOX_QA) return;
  await mkdir(process.env.WORTH_INBOX_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.screenshot({ path: `${process.env.WORTH_INBOX_QA}/${name}-${project}.png` });
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a name can wait in Inbox without any collection and capture retries safely', async ({
  page,
  archive,
}, info) => {
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  archive.failInboxCreateReply = true;
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Only a name');
  await page.getByRole('button', { name: 'Review capture', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Capture review' })).toContainText('Inbox / unfiled');
  await page.getByRole('button', { name: 'Save reviewed capture', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t connect');
  await page.reload();
  await page.getByRole('button', { name: 'Retry same capture', exact: true }).click();
  await page.getByRole('link', { name: 'Open Inbox find →', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await expect(editor.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Only a name');
  expect(archive.inbox).toHaveLength(1);
  expect(archive.inbox[0]).toMatchObject({ decision: null, note: '', wantToTry: false });
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await editor.getByRole('button', { name: 'Close find', exact: true }).click();
  await capture(page, 'unfiled', info.project.name);
});

test('Inbox details preserve optional context and unfinished drafts before filing', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [find()];
  await page.goto(`/inbox?focus=${archive.inbox[0].id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByRole('textbox', { name: 'Private note', exact: true }).fill('Keep the cloth cover.');
  await editor.getByText('Call, plans and dates', { exact: false }).click();
  await editor.getByRole('button', { name: 'Meh', exact: true }).click();
  await editor.getByRole('button', { name: 'Meh', exact: true }).click();
  await editor.getByRole('checkbox', { name: 'Want to try', exact: true }).check();
  await editor.getByRole('combobox', { name: 'Destination collection', exact: true }).selectOption(list.id);
  await expect(editor.getByRole('button', { name: 'File in collection', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: 'Close find', exact: true }).click();
  await page.getByRole('button', { name: /A tiny illustrated book/ }).click();
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue(
    'Keep the cloth cover.',
  );
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByText('Changes saved. Still in the Inbox.', { exact: true })).toBeVisible();
  expect(archive.inbox[0]).toMatchObject({
    decision: null,
    wantToTry: true,
    note: 'Keep the cloth cover.',
    context: { recommendedBy: 'Sam' },
  });
  await capture(page, 'editor', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await editor.getByRole('combobox', { name: 'Destination collection', exact: true }).selectOption(list.id);
  await editor.getByRole('button', { name: 'File in collection', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open filed record →', exact: true })).toBeVisible();
  expect(archive.inbox).toHaveLength(0);
  expect(archive.items.at(-1)).toMatchObject({
    note: 'Keep the cloth cover.',
    wantToTry: true,
    context: { recommendedBy: 'Sam' },
  });
  expect(archive.list.rankedIds).toEqual(['coffee']);
});

test('lost filing replies remain recoverable after the source leaves Inbox and the page reloads', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [find()];
  archive.failInboxFileReply = true;
  await page.goto(`/inbox?focus=${archive.inbox[0].id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByRole('combobox', { name: 'Destination collection', exact: true }).selectOption(list.id);
  await editor.getByRole('button', { name: 'File in collection', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t connect');
  await capture(page, 'receipt', info.project.name);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Pending filing' })).toContainText('A tiny illustrated book');
  await page.getByRole('button', { name: 'Retry same filing', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open filed record →', exact: true })).toBeVisible();
  expect(archive.items.filter((item) => item.title === 'A tiny illustrated book')).toHaveLength(1);
  const writes = archive.writes.filter((entry) => entry.path.endsWith('/file'));
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual(writes[1].body);
});

test('stale Inbox edits keep their draft and require explicit reload', async ({ page, archive }) => {
  archive.inbox = [find()];
  await page.goto(`/inbox?focus=${archive.inbox[0].id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByRole('textbox', { name: 'Private note', exact: true }).fill('My unfinished note');
  archive.inbox[0].note = 'Saved somewhere else';
  archive.inbox[0].revision++;
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('changed elsewhere');
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue(
    'My unfinished note',
  );
  await editor.getByRole('button', { name: 'Reload saved details', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Reload this find?', exact: true });
  await confirm.locator('.confirm-actions').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue(
    'My unfinished note',
  );
  await editor.getByRole('button', { name: 'Reload saved details', exact: true }).click();
  await confirm.getByRole('button', { name: 'Reload details', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue(
    'Saved somewhere else',
  );
});

test('Inbox opens over a collection and Trash Undo works inside the drawer', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [find()];
  await page.goto(`/lists/${list.id}`);
  if (info.project.name === 'phone')
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Inbox', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Inbox.', exact: true });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}$`));
  await capture(page, 'drawer', info.project.name);
  await drawer.getByRole('button', { name: /A tiny illustrated book/ }).click();
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByRole('button', { name: 'Move find to Trash', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Move this find to Trash?', exact: true })
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click();
  await expect(drawer.getByRole('complementary', { name: 'Deletion recovery' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(drawer.getByRole('button', { name: /A tiny illustrated book/ })).toBeVisible();
  expect(archive.inbox).toHaveLength(1);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await drawer.getByRole('button', { name: 'Close Inbox', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My drinks', exact: true })).toBeVisible();
});

test('empty Inbox and long unfiled names reflow without invented calls', async ({ page, archive }, info) => {
  await page.goto('/inbox');
  await expect(page.getByRole('heading', { name: 'A place for the maybes.', exact: true })).toBeVisible();
  await capture(page, 'empty', info.project.name);
  archive.inbox = [find('A very long saved find with an edition and a location '.repeat(2).slice(0, 120))];
  await page.reload();
  await page.getByRole('searchbox', { name: 'Find in Inbox', exact: true }).fill('Sam');
  await expect(page.getByRole('button', { name: /A very long saved find/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find in Inbox', exact: true }).fill('No such find');
  await expect(page.getByText('No Inbox finds match “No such find”.', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Find in Inbox', exact: true }).fill('');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: /A very long saved find/ }).click();
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.locator('.inbox-editor').evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBe(true);
  }
  expect(archive.writes).toHaveLength(0);
});

test('filing an exact name and type match needs an explicit keep-separate choice', async ({
  page,
  archive,
}) => {
  archive.inbox = [{ ...find('Coffee'), type: 'Drink' }];
  await page.goto(`/inbox?focus=${archive.inbox[0].id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByRole('combobox', { name: 'Destination collection', exact: true }).selectOption(list.id);
  const keep = editor.getByRole('checkbox', { name: /A record with this name and type/ });
  await expect(keep).not.toBeChecked();
  await expect(editor.getByRole('button', { name: 'File in collection', exact: true })).toBeDisabled();
  await keep.check();
  await editor.getByRole('textbox', { name: 'Private note', exact: true }).fill('My separate record.');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByText('Changes saved. Still in the Inbox.', { exact: true })).toBeVisible();
  await expect(keep).not.toBeChecked();
  await expect(editor.getByRole('button', { name: 'File in collection', exact: true })).toBeDisabled();
  await keep.check();
  await editor.getByRole('button', { name: 'File in collection', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open filed record →', exact: true })).toBeVisible();
  expect(archive.items.filter((item) => item.title === 'Coffee')).toHaveLength(2);
  expect(archive.items[0].note).toBe('PRIVATE NOTE');
  expect(archive.list.rankedIds).toEqual(['coffee']);
});

test('Inbox-only backups have a reviewable restore preview', async ({ page, archive }) => {
  await page.route('**/api/import', async (route) => {
    const body = route.request().postDataJSON();
    archive.writes.push({ path: '/import', body });
    return route.fulfill({ status: 201, json: { ids: [] } });
  });
  await page.goto('/settings');
  const backup = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    workoutSessions: [],
    workoutRoutines: [],
    photos: [],
    inbox: [find()],
  };
  await page.locator('input[type=file]').setInputFiles({
    name: 'inbox-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByText('Preview Inbox finds', { exact: true }).click();
  await expect(page.getByRole('list', { name: 'Inbox finds to restore' })).toContainText(
    'A tiny illustrated book',
  );
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Restore previewed data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('1 Inbox find restored');
  expect(archive.writes.find((entry) => entry.path === '/import')?.body).toMatchObject({
    inbox: [{ title: 'A tiny illustrated book', context: { recommendedBy: 'Sam' } }],
  });
});

test('capture links close Inbox even when it opened over the capture page', async ({ page }, info) => {
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Unfinished capture');
  if (info.project.name === 'phone')
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Inbox', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Inbox.', exact: true });
  await drawer.getByRole('link', { name: 'Keep a name →', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Unfinished capture');
});

test('blocked draft storage asks before discarding unfinished Inbox edits', async ({ page, archive }) => {
  archive.inbox = [find()];
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
  });
  await page.goto(`/inbox?focus=${archive.inbox[0].id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor.getByRole('textbox', { name: 'Private note', exact: true }).fill('Copy this before leaving');
  await expect(
    editor.getByText('Draft could not be saved on this device. Keep this page open.', { exact: true }),
  ).toBeVisible();
  await editor.getByRole('button', { name: 'Close find', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Close without a saved draft?', exact: true });
  await confirm.locator('.confirm-actions').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue(
    'Copy this before leaving',
  );
  await page.keyboard.press('Escape');
  await confirm.getByRole('button', { name: 'Discard changes and close', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(archive.inbox[0].note).toBe('Try the illustrated edition.');
});

test('a draft stays recoverable when its saved find leaves Inbox elsewhere', async ({
  page,
  archive,
}, info) => {
  archive.inbox = [find()];
  const id = archive.inbox[0].id;
  await page.goto(`/inbox?focus=${id}`);
  const editor = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  await editor
    .getByRole('textbox', { name: 'Private note', exact: true })
    .fill('Keep this even if it was filed elsewhere');
  await expect(editor.getByText('Draft saved on this device.', { exact: true })).toBeVisible();
  archive.inbox = [];
  await page.reload();
  await expect(editor.getByRole('region', { name: 'Unavailable find', exact: true })).toBeVisible();
  await capture(page, 'unavailable', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Clipboard unavailable');
        },
      },
    }),
  );
  await editor.getByRole('button', { name: 'Copy draft details', exact: true }).click();
  await expect(
    editor.getByText('Select and copy the fields below before closing.', { exact: true }),
  ).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue(
    'Keep this even if it was filed elsewhere',
  );
  await expect(editor.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  await editor.getByRole('combobox', { name: 'Destination collection', exact: true }).selectOption(list.id);
  await expect(editor.getByRole('button', { name: 'File in collection', exact: true })).toBeDisabled();
  expect(archive.writes).toHaveLength(0);
  await editor.getByRole('button', { name: 'Close find', exact: true }).click();
  await page.goto(`/inbox?focus=33333333-3333-4333-8333-333333333333`);
  await expect(editor.getByRole('textbox', { name: 'Private note', exact: true })).toHaveValue('');
});
