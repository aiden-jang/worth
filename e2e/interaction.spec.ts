import { collectionOptions } from './navigation';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';

async function noOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('signed-out example stays local and has accessible controls', async ({ page, archive }) => {
  archive.signedIn = false;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your taste. A place to keep it.' })).toBeVisible();
  await page.getByLabel('Add an example item').fill('Browser example');
  await page.getByRole('button', { name: 'Keep it' }).click();
  await expect(page.getByRole('heading', { name: 'Browser example', exact: true })).toBeVisible();
  await expect(page.getByText('Undecided.', { exact: true })).toBeVisible();
  expect(archive.writes).toEqual([]);
  await noOverflow(page);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
});

test('capture recovers from failure and creates an unranked item without a call', async ({
  page,
  archive,
}) => {
  archive.failCapture = true;
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('textbox', { name: 'Add a name' }).fill('New tea');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t save' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Add a name' })).toHaveValue('New tea');
  archive.failCapture = false;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'New tea added' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Add a name' })).toBeFocused();
  expect(archive.items.at(-1)).toMatchObject({ title: 'New tea', decision: null });
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await noOverflow(page);
});

test('calls can clear independently of rank and browsing survives Back', async ({ page, archive }) => {
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
  const slip = page.getByRole('region', { name: 'Your call for Coffee' }).filter({ visible: true });
  await slip.getByRole('button', { name: 'Favorite' }).click();
  await expect(slip.getByText('Undecided.', { exact: true })).toBeVisible();
  expect(archive.items[0].decision).toBeNull();
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await slip.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog', { name: 'Coffee', exact: true })).toBeVisible();
  await page.locator('.item-editor-dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await collectionOptions(page);
  await page.getByRole('link', { name: 'Show list' }).click();
  await expect(page.getByRole('group', { name: 'How many rankings to show' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My drinks' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Add a name', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coffee Drink', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Your call for Coffee' }).filter({ visible: true }),
  ).toBeVisible();
  // Axe must inspect the settled cream panel, not its translucent arrival frame.
  await expect(slip).toHaveCSS('opacity', '1');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
});

test('active-link lookup failure has a keyboard-accessible retry', async ({ page, archive }) => {
  archive.failShares = true;
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'active links' })).toBeVisible();
  archive.failShares = false;
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeFocused();
});

test('account outages recover and public snapshots never expose private notes', async ({ page, archive }) => {
  archive.authDown = true;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Account unavailable.' })).toBeVisible();
  archive.authDown = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Good to keep.' })).toBeVisible();
  await page.goto('/s/review');
  await expect(page.getByRole('heading', { name: 'My drinks' })).toBeVisible();
  await expect(page.getByText('PRIVATE NOTE', { exact: true })).toHaveCount(0);
  await page.goto('/s/expired');
  await expect(page.getByRole('alert')).toContainText('no longer available');
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('settings export downloads and invalid restore files are explained', async ({ page }) => {
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON (.json)', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^worth-records-.*\.json$/);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await noOverflow(page);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
});

test('directory remains usable when device storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/lists');
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('link', { name: /My drinks/ })
      .filter({ visible: true })
      .last(),
  ).toBeVisible();
});

test('private ranking can retry an outage', async ({ page, archive }) => {
  archive.failShow = true;
  await page.goto(`/lists/${list.id}/show`);
  await expect(page.getByRole('alert')).toContainText('Couldn’t open this ranking');
  archive.failShow = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'My drinks' })).toBeVisible();
});
