import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_WEB_CAPTURE_QA) return;
  await mkdir(process.env.WORTH_WEB_CAPTURE_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_WEB_CAPTURE_QA}/${name}-${project}.png` });
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function routeCapture(page: Page, archive: State, loseFirst = false) {
  const receipts = new Map<string, string>();
  let fail = loseFirst;
  await page.route(`**/api/lists/${list.id}/items/import`, async (route) => {
    const body = route.request().postDataJSON(),
      key = route.request().headers()['idempotency-key'];
    archive.writes.push({ path: '/capture-save', body: { ...body, key } });
    if (!receipts.has(key)) {
      const item = {
        ...archive.items[0],
        ...body.items[0],
        id: crypto.randomUUID(),
        hasPhoto: false,
        logCount: 0,
        lastLoggedOn: null,
      };
      receipts.set(key, item.id);
      archive.items.push(item);
    }
    if (fail) {
      fail = false;
      return route.abort('failed');
    }
    return route.fulfill({
      status: 201,
      json: { items: [archive.items.find((item) => item.id === receipts.get(key))] },
    });
  });
}
const incoming = {
  title: 'A little book',
  text: 'Read the illustrated edition.',
  url: 'https://example.test/books/edition',
};

test('an incoming browser share needs explicit use, destination review and save', async ({
  page,
  archive,
}, info) => {
  await routeCapture(page, archive);
  await page.goto('/capture#' + new URLSearchParams(incoming));
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    incoming.title,
  );
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Use incoming share', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(incoming.title);
  await expect(page.getByRole('combobox', { name: 'Destination', exact: true })).toHaveValue('inbox');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption(list.id);
  await capture(page, 'draft', info.project.name);
  await page.getByRole('button', { name: 'Review capture', exact: true }).click();
  const review = page.getByRole('region', { name: 'Capture review', exact: true });
  await expect(review).toContainText('My drinks');
  await expect(review).toContainText(incoming.text);
  await review.scrollIntoViewIfNeeded();
  await review.getByRole('button', { name: 'Back to draft', exact: true }).hover();
  await expect(review.getByRole('button', { name: 'Back to draft', exact: true })).toHaveCSS(
    'color',
    'rgb(24, 25, 21)',
  );
  await capture(page, 'review', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Save reviewed capture', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open saved record →', exact: true })).toBeVisible();
  expect(archive.items.at(-1)).toMatchObject({
    title: incoming.title,
    note: incoming.text,
    context: { sourceUrl: incoming.url },
    decision: null,
  });
  expect(archive.list.rankedIds).toEqual(['coffee']);
});

test('lost capture responses preserve the exact request and identity across reload', async ({
  page,
  archive,
}) => {
  await routeCapture(page, archive, true);
  await page.goto('/capture');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption(list.id);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Retry this once');
  await page.getByRole('button', { name: 'Review capture', exact: true }).click();
  await page.getByRole('button', { name: 'Save reviewed capture', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t connect');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry same capture', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open saved record →', exact: true })).toBeVisible();
  expect(archive.items.filter((item) => item.title === 'Retry this once')).toHaveLength(1);
  const writes = archive.writes.filter((entry) => entry.path === '/capture-save');
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual(writes[1].body);
});

test('incoming data stays out of sign-in URLs and returns for explicit review', async ({
  page,
  archive,
}, info) => {
  archive.signedIn = false;
  await page.goto('/capture?' + new URLSearchParams(incoming));
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByRole('heading', { name: 'Keep this find.', exact: true })).toBeVisible();
  const href = await page.getByRole('link', { name: 'Sign in to review', exact: true }).getAttribute('href');
  expect(href).not.toContain('example.test');
  expect(href).not.toContain('illustrated');
  expect(href).not.toContain('little');
  await capture(page, 'sign-in', info.project.name);
  archive.signedIn = true;
  await page.reload();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    incoming.title,
  );
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('');
  expect(archive.writes).toHaveLength(0);
});

test('duplicate review, incoming replacement and offline drafts never save automatically', async ({
  page,
  archive,
}) => {
  await routeCapture(page, archive);
  await page.goto('/capture');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption(list.id);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Coffee');
  await page.getByText('Source, note and type', { exact: false }).click();
  await page.getByRole('textbox', { name: 'Type', exact: true }).fill('Drink');
  await page.getByRole('button', { name: 'Review capture', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save reviewed capture', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /A record with this name/ }).check();
  await expect(page.getByRole('button', { name: 'Save reviewed capture', exact: true })).toBeEnabled();
  await page.goto('/capture#' + new URLSearchParams(incoming));
  await page.getByRole('button', { name: 'Use incoming share', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Replace this capture draft?', exact: true });
  await confirm.locator('.confirm-actions').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Coffee');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByRole('button', { name: 'Save reviewed capture', exact: true })).toBeDisabled();
  expect(archive.writes).toHaveLength(0);
});

test('quick shortlist and saved-find shortcuts use only owned records and preserve calls and ranks', async ({
  page,
  archive,
}, info) => {
  const before = structuredClone(archive.items);
  await page.goto(`/quick?mode=shortlist&list=${list.id}`);
  const shortlist = page.getByRole('region', { name: 'Saved shortlist', exact: true });
  await expect(shortlist).toContainText('Coffee');
  await expect(shortlist).not.toContainText('Tea');
  await shortlist.scrollIntoViewIfNeeded();
  await capture(page, 'shortlist', info.project.name);
  await page.getByRole('combobox', { name: 'Open', exact: true }).selectOption('find');
  await page.getByRole('combobox', { name: 'Find from', exact: true }).selectOption('favorites');
  await page.getByRole('button', { name: 'Draw a saved find', exact: true }).click();
  const find = page.getByRole('region', { name: 'Saved find', exact: true });
  await expect(find.getByRole('heading', { name: 'Coffee', exact: true })).toBeVisible();
  await find.scrollIntoViewIfNeeded();
  await capture(page, 'find', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('combobox', { name: 'Find from', exact: true }).selectOption('want');
  await expect(page.getByRole('button', { name: 'Draw a saved find', exact: true })).toBeDisabled();
  await expect(find.getByRole('heading', { name: 'Coffee', exact: true })).toHaveCount(0);
  expect(archive.items).toEqual(before);
  expect(archive.writes).toHaveLength(0);
  await page.goto('/quick?list=foreign-id');
  await expect(page.getByRole('alert')).toContainText('unavailable for this account');
  await expect(page.getByRole('region', { name: 'Saved shortlist', exact: true })).toHaveCount(0);
});

test('long incoming content and shortcut names reflow at narrow widths', async ({ page, archive }) => {
  archive.list.name = 'A very long collection name with words to remember'.repeat(2).slice(0, 80);
  await page.goto('/capture#' + new URLSearchParams({ ...incoming, title: '<b>Plain text</b>' }));
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto(`/quick?mode=shortlist&list=${list.id}`);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('remembered quick picks stay with their account and survive the app shortcut entry', async ({
  page,
}) => {
  await page.goto(`/quick?mode=find&list=${list.id}&from=favorites`);
  await page.getByText('Bookmark and shortcut options', { exact: true }).click();
  await page.getByRole('button', { name: 'Remember for app shortcuts', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('remembered for Worth shortcuts');
  await page.goto('/quick?mode=find');
  await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toHaveValue(list.id);
  await expect(page.getByRole('combobox', { name: 'Find from', exact: true })).toHaveValue('favorites');
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { user: { id: 'other-web-account', email: 'other@example.test', displayName: 'Other' } },
    }),
  );
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Collection', exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Draw a saved find', exact: true })).toHaveCount(0);
});

test('expired incoming shares are discarded and blocked storage leaves manual capture available', async ({
  page,
  archive,
}) => {
  await page.goto('/capture#' + new URLSearchParams(incoming));
  await page.evaluate(() => {
    const old = JSON.parse(sessionStorage.getItem('worth:incoming-web-share')!);
    sessionStorage.setItem('worth:incoming-web-share', JSON.stringify({ ...old, expires: Date.now() - 1 }));
  });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toHaveCount(0);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
    Storage.prototype.removeItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Only a name');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption(list.id);
  await expect(page.getByRole('button', { name: 'Review capture', exact: true })).toBeEnabled();
  expect(archive.writes).toHaveLength(0);
});

test('a live account change hides old records and keeps its draft out of the new account', async ({
  page,
}, info) => {
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Original account’s unfinished name');
  await expect(page.getByText('Draft saved on this device.', { exact: true })).toBeVisible();
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { user: { id: 'new-live-account', email: 'new@example.test', displayName: 'New' } },
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await expect(page.getByRole('heading', { name: 'Accounts changed.', exact: true })).toBeVisible();
  await capture(page, 'account-changed', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'My drinks 2', exact: true })).toHaveCount(0);
  const leaked = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => key.startsWith('worth:draft:v1:new-live-account:')),
  );
  expect(leaked).toEqual([]);
  await page.route('**/api/lists', (route) => route.fulfill({ json: { lists: [] } }));
  await page.getByRole('button', { name: 'Reload Worth', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('');
});
