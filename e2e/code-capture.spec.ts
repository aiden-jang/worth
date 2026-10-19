import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

const isbn = '9780140328721';
const catalog = {
  [`ISBN:${isbn}`]: {
    title: 'Fantastic Mr. Fox',
    authors: [{ name: 'Roald Dahl' }],
    publishers: [{ name: 'Puffin' }],
    publish_date: '1988',
    cover: { large: 'https://unrequested.test/cover.jpg' },
  },
};
async function barcodePhoto(page: Page, vertical = false) {
  const encoded = await page.evaluate(
    ({ code, vertical }) => {
      // Independent EAN-13 test artwork, with quiet margins. Never saved into the production archive.
      const left = [
        '0001101',
        '0011001',
        '0010011',
        '0111101',
        '0100011',
        '0110001',
        '0101111',
        '0111011',
        '0110111',
        '0001011',
      ];
      const alternate = [
        '0100111',
        '0110011',
        '0011011',
        '0100001',
        '0011101',
        '0111001',
        '0000101',
        '0010001',
        '0001001',
        '0010111',
      ];
      const parity = [
        'LLLLLL',
        'LLGLGG',
        'LLGGLG',
        'LLGGGL',
        'LGLLGG',
        'LGGLLG',
        'LGGGLL',
        'LGLGLG',
        'LGLGGL',
        'LGGLGL',
      ][Number(code[0])];
      let bits = '101';
      for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? left : alternate)[Number(code[i])];
      bits += '01010';
      for (let i = 7; i <= 12; i++)
        bits += [...left[Number(code[i])]].map((bit) => (bit === '1' ? '0' : '1')).join('');
      bits += '101';
      const canvas = document.createElement('canvas');
      canvas.width = vertical ? 340 : 700;
      canvas.height = vertical ? 700 : 340;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width / 2, canvas.height / 2);
      if (vertical) context.rotate(Math.PI / 2);
      context.fillStyle = '#000';
      [...bits].forEach((bit, index) => {
        if (bit === '1') context.fillRect(-237.5 + index * 5, -100, 5, 200);
      });
      context.font = '24px Arial';
      context.fillText(code, -100, 135);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { code: isbn, vertical },
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'example-book-code.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Read barcode on this device', exact: true })).toBeEnabled();
}
async function capture(page: Page, name: string, project: string, target?: string) {
  if (!process.env.WORTH_CODE_QA) return;
  await mkdir(process.env.WORTH_CODE_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (target)
    await page
      .locator(target)
      .evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  else await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_CODE_QA}/${name}-${project}.png` });
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a real local barcode read and explicit book lookup require separate reviewed capture', async ({
  page,
  archive,
}, info) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'https:') external.push(url.href);
  });
  let requests = 0;
  await page.route('https://openlibrary.org/api/books?**', async (route) => {
    requests++;
    const request = route.request(),
      url = new URL(request.url()),
      headers = request.headers();
    expect(Object.fromEntries(url.searchParams)).toEqual({
      bibkeys: `ISBN:${isbn}`,
      jscmd: 'data',
      format: 'json',
    });
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers['x-worth-account']).toBeUndefined();
    expect(headers.referer).toBeUndefined();
    expect(request.postData()).toBeNull();
    await route.fulfill({ json: catalog, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/code');
  await expect(page.getByRole('heading', { name: 'Read a code.', exact: true })).toBeVisible();
  await capture(page, 'entry', info.project.name);
  await barcodePhoto(page, info.project.name === 'phone');
  await page.getByRole('button', { name: 'Read barcode on this device', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true })).toHaveValue(isbn, {
    timeout: 20000,
  });
  await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue('');
  expect(external).toEqual([]);
  expect(archive.writes).toHaveLength(0);
  await capture(page, 'read', info.project.name, '.photo-text-source');
  await page.getByText('Book lookup optional', { exact: true }).click();
  await page.getByRole('button', { name: 'Look up ISBN with Open Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fantastic Mr. Fox', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue('');
  expect(requests).toBe(1);
  expect(external).toHaveLength(1);
  await page.getByRole('button', { name: 'Use this title', exact: true }).click();
  await page.getByRole('button', { name: 'Use book details as note', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Keep the Open Library source link', exact: true }).check();
  await capture(page, 'suggestion', info.project.name, '.code-book-result');
  await capture(page, 'review', info.project.name, '.photo-text-review');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.reload();
  await expect(page.locator('.photo-text-source img')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue(
    'Fantastic Mr. Fox',
  );
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    `ISBN: ${isbn}`,
  );
  await page.getByRole('button', { name: 'Use incoming share', exact: true }).click();
  await page.getByRole('button', { name: 'Review capture', exact: true }).click();
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Save reviewed capture', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open Inbox find →', exact: true })).toBeVisible();
  expect(archive.inbox[0]).toMatchObject({
    title: 'Fantastic Mr. Fox',
    decision: null,
    context: { sourceUrl: `https://openlibrary.org/isbn/${isbn}` },
  });
  expect(archive.inbox[0].note).toContain('Author: Roald Dahl');
  expect(JSON.stringify(archive.writes)).not.toContain('example-book-code');
});

test('lookup replacement is explicit, code edits clear stale suggestions, and unknown ISBNs remain manual', async ({
  page,
  archive,
}) => {
  await page.clock.install();
  let requests = 0;
  await page.route('https://openlibrary.org/api/books?**', (route) => {
    requests++;
    return route.fulfill({
      json: requests === 1 ? catalog : {},
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.goto('/code');
  await page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true }).fill(isbn);
  await page.getByRole('textbox', { name: 'Name to keep', exact: true }).fill('My name');
  await page.getByText('Private note optional', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Private note to keep', exact: true }).fill('My note');
  await page.getByText('Book lookup optional', { exact: true }).click();
  await page.getByRole('button', { name: 'Look up ISBN with Open Library', exact: true }).click();
  await page.getByRole('button', { name: 'Use this title', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Replace this name?', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue('My name');
  await page.getByRole('button', { name: 'Use book details as note', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Replace this private note?', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: 'Private note to keep', exact: true })).toHaveValue(
    'My note',
  );
  await page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true }).fill('080442957X');
  await expect(page.getByRole('heading', { name: 'Fantastic Mr. Fox', exact: true })).toHaveCount(0);
  await page.clock.fastForward(1200);
  await page.getByRole('button', { name: 'Look up ISBN with Open Library', exact: true }).click();
  await expect(
    page.getByText('No book found for this ISBN. You can keep the code and name it yourself.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText('My note');
  expect(archive.writes).toHaveLength(0);
});

test('invalid or unreadable codes and offline lookup keep a narrow manual path usable', async ({
  page,
  archive,
}, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'OffscreenCanvas', { configurable: true, value: undefined }),
  );
  await page.goto('/code');
  await expect(
    page.getByText('Barcode reading is unavailable in this browser. Type or paste the digits below.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'not-a-photo.png', mimeType: 'image/png', buffer: Buffer.from('<svg>no</svg>') });
  await expect(page.getByRole('alert')).toContainText('Choose a complete');
  await page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true }).fill('9780140328722');
  await page
    .getByRole('textbox', { name: 'Name to keep', exact: true })
    .fill('A manually named find '.repeat(5));
  await expect(page.getByRole('button', { name: 'Review this capture →', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Keep the code in the private note', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Review this capture →', exact: true })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true }).fill(isbn);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await page.getByText('Book lookup optional', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Look up ISBN with Open Library', exact: true }),
  ).toBeDisabled();
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(
    info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  );
  await capture(page, 'manual', info.project.name, '.photo-text-review');
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    'A manually named find',
  );
  expect(archive.writes).toHaveLength(0);
});

test('account changes abort a pending external lookup without exposing the old draft', async ({
  page,
  archive,
}) => {
  let release!: () => void,
    reached = false;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://openlibrary.org/api/books?**', async (route) => {
    reached = true;
    await hold;
    try {
      await route.fulfill({ json: catalog, headers: { 'Access-Control-Allow-Origin': '*' } });
    } catch {
      /* Account recovery closes the original lookup. */
    }
  });
  try {
    await page.goto('/code');
    await page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true }).fill(isbn);
    await page.getByRole('textbox', { name: 'Name to keep', exact: true }).fill('Original private name');
    await page.getByText('Book lookup optional', { exact: true }).click();
    await page.getByRole('button', { name: 'Look up ISBN with Open Library', exact: true }).click();
    await expect.poll(() => reached).toBe(true);
    await page.route('**/api/me', (route) =>
      route.fulfill({
        json: { user: { id: 'another-code-account', email: 'another@example.test', displayName: 'Another' } },
      }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
    await page.getByRole('button', { name: 'Reload Worth', exact: true }).click();
    release();
    await expect(page.getByRole('textbox', { name: 'Name to keep', exact: true })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true })).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Fantastic Mr. Fox', exact: true })).toHaveCount(0);
    expect(archive.writes).toHaveLength(0);
  } finally {
    release();
  }
});

test('an unreadable photo retains a previous code and a rejected lookup remains recoverable', async ({
  page,
  archive,
}) => {
  await page.route('https://openlibrary.org/api/books?**', (route) =>
    route.fulfill({ status: 429, json: {}, headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  await page.goto('/code');
  await page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true }).fill(isbn);
  const blank = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 100, 100);
    return canvas.toDataURL().split(',')[1];
  });
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank, 'base64') });
  await page.getByRole('button', { name: 'Read barcode on this device', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Replace this code?', exact: true })
    .getByRole('button', { name: 'Read barcode again', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t read a supported barcode');
  await expect(page.getByRole('textbox', { name: 'Barcode or ISBN', exact: true })).toHaveValue(isbn);
  await page.getByText('Book lookup optional', { exact: true }).click();
  await page.getByRole('button', { name: 'Look up ISBN with Open Library', exact: true }).click();
  await expect(
    page.getByText('Open Library is busy. Wait a minute, or enter the name manually.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Name to keep', exact: true }).fill('Kept manually');
  await page.getByRole('button', { name: 'Review this capture →', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Incoming share', exact: true })).toContainText(
    'Kept manually',
  );
  expect(archive.writes).toHaveLength(0);
});

test('Stop terminates a barcode worker while its reading code is loading', async ({ page, context }) => {
  let release!: () => void,
    reached = false;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/barcode.worker-*.js', async (route) => {
    reached = true;
    await hold;
    try {
      await route.continue();
    } catch {
      /* A stopped worker closes the request. */
    }
  });
  try {
    await page.goto('/code');
    await barcodePhoto(page);
    await page.getByRole('button', { name: 'Read barcode on this device', exact: true }).click();
    await expect.poll(() => reached).toBe(true);
    await page.getByRole('button', { name: 'Stop reading', exact: true }).click();
    release();
    const cdp = await context.newCDPSession(page);
    await expect
      .poll(async () =>
        (await cdp.send('Target.getTargets')).targetInfos
          .filter((target) => target.type === 'worker')
          .map((target) => target.url),
      )
      .toEqual([]);
    await expect(
      page.getByText('Reading stopped. Your previous code is still here.', { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});
