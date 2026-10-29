import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function sample(page: Page, type: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png') {
  const encoded = await page.evaluate((format) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 1000, 600);
    context.fillStyle = '#000';
    context.font = '48px Arial';
    ['EXAMPLE RECEIPT', 'TINY BOOK SHOP', 'ILLUSTRATED EDITION', 'TOTAL 18.00'].forEach((line, index) =>
      context.fillText(line, 60, 100 + index * 100),
    );
    return canvas.toDataURL(format, 0.95).split(',')[1];
  }, type);
  await page.locator('input[type=file]').setInputFiles({
    name: 'example-receipt.' + type.split('/')[1],
    mimeType: type,
    buffer: Buffer.from(encoded, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Read text on this device', exact: true })).toBeEnabled();
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_PHOTO_TEXT_QA) return;
  await mkdir(process.env.WORTH_PHOTO_TEXT_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (['source', 'review', 'manual'].includes(name)) {
    await page
      .locator(name === 'source' ? '.photo-text-source' : '.photo-text-review')
      .evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  } else if (name === 'entry') {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  } else if (name === 'keep') {
    await page
      .getByRole('button', { name: 'Review this capture →', exact: true })
      .evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  }
  await page.screenshot({ path: `${process.env.WORTH_PHOTO_TEXT_QA}/${name}-${project}.png` });
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('real on-device reading uses local assets and requires reviewed text capture', async ({
  page,
  archive,
}, info) => {
  test.setTimeout(90000);
  const external: string[] = [];
  const assets: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/ocr/')) assets.push(url.pathname);
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:34320')
      external.push(url.href);
  });
  await page.goto('/read');
  await expect(page.getByRole('heading', { name: 'Read a photo.', exact: true })).toBeVisible();
  await capture(page, 'entry', info.project.name);
  await sample(page, info.project.name === 'phone' ? 'image/jpeg' : 'image/png');
  await page
    .locator('.photo-text-source')
    .evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await capture(page, 'source', info.project.name);
  await page.getByRole('button', { name: 'Read text on this device', exact: true }).click();
  const text = page.getByRole('textbox', { name: 'Read or pasted text', exact: true });
  await expect(text).toHaveValue(/ILLUSTRATED EDITION/, { timeout: 60000 });
  await expect(
    page.getByText('Text read. Check the words before keeping them.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Choose a line for the name', exact: true })
    .selectOption({ label: 'ILLUSTRATED EDITION' });
  await page.getByText('Private note optional', { exact: true }).click();
  await page.getByRole('button', { name: 'Use this text as the note', exact: true }).click();
  await page
    .locator('.photo-text-review')
    .evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await capture(page, 'review', info.project.name);
  await capture(page, 'keep', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  expect(assets.some((path) => path.includes('/core/'))).toBe(true);
  expect(assets.some((path) => path.includes('/lang/'))).toBe(true);
  expect(external).toEqual([]);
  expect(archive.writes).toHaveLength(0);
  await page.reload();
  await expect(page.getByText('Photo restored from this device.', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue(
    'ILLUSTRATED EDITION',
  );
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await page.getByRole('button', { name: 'Use incoming share', exact: true }).click();
  await page.getByRole('button', { name: 'Review capture', exact: true }).click();
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Save reviewed capture', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Unfiled find →', exact: true })).toBeVisible();
  expect(archive.inbox[0]).toMatchObject({
    title: 'ILLUSTRATED EDITION',
    decision: null,
    startedOn: null,
    context: { purchase: { price: null } },
  });
  expect(JSON.stringify(archive.writes)).not.toContain('example-receipt.');
  await page.goto('/read');
  await page.getByRole('button', { name: 'Clear photo and text draft', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Clear this photo and text draft?', exact: true })
    .getByRole('button', { name: 'Clear draft', exact: true })
    .click();
  await expect(page.locator('.photo-text-source img')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Read or pasted text', exact: true })).toHaveValue('');
  await page.reload();
  await expect(page.locator('.photo-text-source img')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue('');
  expect(archive.inbox).toHaveLength(1);
});

test('stopping initialization terminates both recognition workers and preserves earlier text', async ({
  page,
  context,
  archive,
}) => {
  let release!: () => void,
    reached = false;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/ocr/v7/core/**', async (route) => {
    reached = true;
    await hold;
    try {
      await route.abort('failed');
    } catch {
      /* A stopped worker closes this request. */
    }
  });
  try {
    await page.goto('/read');
    await sample(page, 'image/webp');
    await page.getByRole('textbox', { name: 'Read or pasted text', exact: true }).fill('Earlier words');
    await page.getByRole('button', { name: 'Read text on this device', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Replace this reading?', exact: true })
      .getByRole('button', { name: 'Read photo again', exact: true })
      .click();
    await expect.poll(() => reached, { timeout: 15000 }).toBe(true);
    const cdp = await context.newCDPSession(page);
    const workers = async () =>
      (await cdp.send('Target.getTargets')).targetInfos.filter((target) => target.type === 'worker').length;
    expect(await workers()).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Stop reading', exact: true }).click();
    release();
    await expect.poll(workers).toBe(0);
    await expect(page.getByRole('textbox', { name: 'Read or pasted text', exact: true })).toHaveValue(
      'Earlier words',
    );
    expect(archive.writes).toHaveLength(0);
  } finally {
    release();
  }
});

test('unsupported reading and invalid images leave manual capture usable', async ({
  page,
  archive,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'WebAssembly', { configurable: true, value: undefined }),
  );
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.goto('/read');
  await expect(
    page.getByText('Photo reading is unavailable in this browser. Paste or type the words below.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'not-a-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg>not a photo</svg>'),
  });
  await expect(page.getByRole('alert')).toContainText('Choose a complete');
  await page
    .getByRole('textbox', { name: 'Read or pasted text', exact: true })
    .fill('A very long line to remember '.repeat(20));
  await page.getByRole('textbox', { name: 'Name to keep', exact: true }).fill('A manually kept name');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(
    info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  );
  await capture(page, 'manual', info.project.name);
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    'A manually kept name',
  );
  expect(archive.writes).toHaveLength(0);
});

test('a failed reading asset retains earlier text and leaves manual review available', async ({
  page,
  context,
  archive,
}) => {
  await page.route('**/ocr/v7/core/**', (route) => route.abort('failed'));
  await page.goto('/read');
  await sample(page);
  await page
    .getByRole('textbox', { name: 'Read or pasted text', exact: true })
    .fill('Keep these earlier words');
  await page.getByRole('button', { name: 'Read text on this device', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Replace this reading?', exact: true })
    .getByRole('button', { name: 'Read photo again', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t read this photo here');
  const cdp = await context.newCDPSession(page);
  await expect
    .poll(
      async () =>
        (await cdp.send('Target.getTargets')).targetInfos.filter((target) => target.type === 'worker').length,
    )
    .toBe(0);
  await expect(page.getByRole('textbox', { name: 'Read or pasted text', exact: true })).toHaveValue(
    'Keep these earlier words',
  );
  await page.getByRole('textbox', { name: 'Name to keep', exact: true }).fill('A manually reviewed name');
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    'A manually reviewed name',
  );
  expect(archive.writes).toHaveLength(0);
});

test('account changes terminate pending recognition and keep the original photo draft private', async ({
  page,
  context,
  archive,
}, info) => {
  let release!: () => void,
    reached = false;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/ocr/v7/core/**', async (route) => {
    reached = true;
    await hold;
    try {
      await route.abort('failed');
    } catch {
      /* Account recovery closes the worker request. */
    }
  });
  try {
    await page.goto('/read');
    await sample(page);
    await page
      .getByRole('textbox', { name: 'Read or pasted text', exact: true })
      .fill('Original account’s unfinished words');
    await page.getByRole('button', { name: 'Read text on this device', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Replace this reading?', exact: true })
      .getByRole('button', { name: 'Read photo again', exact: true })
      .click();
    await expect.poll(() => reached, { timeout: 15000 }).toBe(true);
    await page.route('**/api/me', (route) =>
      route.fulfill({
        json: { user: { id: 'other-photo-account', email: 'other@example.test', displayName: 'Other' } },
      }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
    await expect(page.getByRole('heading', { name: 'Accounts changed.', exact: true })).toBeVisible();
    const cdp = await context.newCDPSession(page);
    await expect
      .poll(
        async () =>
          (await cdp.send('Target.getTargets')).targetInfos.filter((target) => target.type === 'worker')
            .length,
      )
      .toBe(0);
    await capture(page, 'account-change', info.project.name);
    await page.getByRole('button', { name: 'Reload Worth', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Read or pasted text', exact: true })).toHaveValue('');
    await expect(page.locator('.photo-text-source img')).toHaveCount(0);
    expect(archive.writes).toHaveLength(0);
  } finally {
    release();
  }
});

test('a private photo handoff cannot reappear as an incoming share for another account', async ({
  page,
  archive,
}) => {
  await page.goto('/read');
  await page
    .getByRole('textbox', { name: 'Name to keep', exact: true })
    .fill('Original account private find');
  await page.getByText('Private note optional', { exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Private note to keep', exact: true })
    .fill('Original account private note');
  const navigation: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigation.push(frame.url());
  });
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page).toHaveURL(/\/capture$/);
  expect(navigation.some((url) => url.includes('Original'))).toBe(false);
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    'Original account private note',
  );
  archive.signedIn = false;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Keep this find.', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toHaveCount(0);
  archive.signedIn = true;
  await page.reload();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    'Original account private note',
  );
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { user: { id: 'changed-after-handoff', email: 'changed@example.test', displayName: 'Changed' } },
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await page.getByRole('button', { name: 'Reload Worth', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('');
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});
