import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';

async function open(page: import('@playwright/test').Page) {
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Booklets & cards', exact: true }).click();
}

test('booklets preview exact fields, print only selected records, and download a self-contained copy', async ({
  page,
  archive,
}, info) => {
  await open(page);
  if (process.env.WORTH_PUBLISH_QA) {
    await expect(page.getByRole('button', { name: 'Booklets & cards', exact: true })).toHaveCSS(
      'background-color',
      'rgb(232, 220, 157)',
    );
    await page.getByRole('dialog').evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.screenshot({ path: `${process.env.WORTH_PUBLISH_QA}/controls-${info.project.name}.png` });
  }
  await page.getByRole('checkbox', { name: 'Coffee', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Tea', exact: true }).check();
  await page.getByRole('textbox', { name: 'Dedication', exact: true }).fill('For rainy Sundays');
  await page.getByRole('textbox', { name: 'Caption for Coffee', exact: true }).fill('The reliable one.');
  const preview = page.getByLabel('Booklet preview', { exact: true }).filter({ visible: true });
  await expect(preview).toContainText('The reliable one.');
  await expect(preview).not.toContainText('PRIVATE NOTE');
  await page.getByRole('button', { name: 'Prepare booklet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download booklet (.html)', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Print / save PDF', exact: true })).toBeEnabled();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download booklet (.html)', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('worth-my-drinks.html');
  const html = await readFile((await download.path())!, 'utf8');
  for (const hidden of ['PRIVATE NOTE', '/api/', 'favorite', 'browser-preview', 'preview@example.test'])
    expect(html).not.toContain(hidden);
  expect(html).toContain('For rainy Sundays');
  expect(html).toContain('data:font/woff2;base64,');
  const standalonePath = info.outputPath('booklet.html');
  await copyFile((await download.path())!, standalonePath);
  const standalone = await page.context().newPage();
  const external: string[] = [];
  standalone.on('request', (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await standalone.goto(pathToFileURL(standalonePath).href);
  await expect(standalone.getByRole('heading', { name: 'My drinks', exact: true })).toBeVisible();
  await expect(standalone.getByRole('heading', { name: 'Coffee', exact: true })).toBeVisible();
  expect(external).toEqual([]);
  if (process.env.WORTH_PDF_QA && info.project.name === 'desktop') {
    await mkdir(process.env.WORTH_PDF_QA, { recursive: true });
    await page.pdf({
      path: `${process.env.WORTH_PDF_QA}/booklet-in-app.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
    await standalone.pdf({
      path: `${process.env.WORTH_PDF_QA}/booklet-standalone.pdf`,
      preferCSSPageSize: true,
      printBackground: true,
    });
  }
  await standalone.close();
  if (process.env.WORTH_PUBLISH_QA) {
    await preview.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_PUBLISH_QA}/booklet-${info.project.name}.png` });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('checkbox', { name: 'Include private notes', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Download booklet (.html)', exact: true })).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: 'preview changed' })).toBeVisible();
  expect(archive.writes).toEqual([]);
});

test('recommendation cards prepare a real PNG and changing the message invalidates the prepared file', async ({
  page,
  archive,
}, info) => {
  await open(page);
  await page.getByRole('radio', { name: 'Recommendation card', exact: true }).check();
  await page.getByRole('radio', { name: 'Coffee', exact: true }).check();
  await page
    .getByRole('textbox', { name: 'Your reason or message', exact: true })
    .fill('The one I was telling you about.');
  await page.getByRole('textbox', { name: 'For someone', exact: true }).fill('Sam');
  await page.getByRole('button', { name: 'Prepare card', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Prepared recommendation card: Coffee', exact: true }),
  ).toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download card (.png)', exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe('worth-coffee.png');
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(400);
  if (process.env.WORTH_PUBLISH_QA) {
    await mkdir(process.env.WORTH_PUBLISH_QA, { recursive: true });
    if (info.project.name === 'desktop')
      await copyFile((await download.path())!, `${process.env.WORTH_PUBLISH_QA}/recommendation-card.png`);
    await page
      .getByRole('img', { name: 'Prepared recommendation card: Coffee', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_PUBLISH_QA}/card-${info.project.name}.png` });
  }
  await page
    .getByRole('textbox', { name: 'Your reason or message', exact: true })
    .fill('A different message');
  await expect(page.getByRole('button', { name: 'Download card (.png)', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Recommendation card preview', { exact: true })).toContainText(
    'A different message',
  );
  expect(archive.writes).toEqual([]);
});

test('photo export failures recover and export settings survive closing', async ({ page, archive }) => {
  archive.items[0].hasPhoto = true;
  let fail = true;
  const image = await readFile('public/icons/icon-192.png');
  await page.route('**/api/items/coffee/photo*', (route) =>
    fail
      ? route.fulfill({ status: 503 })
      : route.fulfill({ status: 200, contentType: 'image/png', body: image }),
  );
  await open(page);
  await page.getByRole('checkbox', { name: 'Coffee', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Include private photos', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare booklet', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('photo is unavailable');
  await expect(page.getByRole('checkbox', { name: 'Coffee', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Download booklet (.html)', exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: 'Prepare booklet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download booklet (.html)', exact: true })).toBeEnabled();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download booklet (.html)', exact: true }).click();
  const html = await readFile((await (await event).path())!, 'utf8');
  expect(html).toContain('data:image/png;base64,');
  await expect(
    page.getByLabel('Booklet preview', { exact: true }).filter({ visible: true }).locator('img'),
  ).toHaveAttribute('src', /^data:image\/png;base64,/);
  expect(html).not.toContain('/api/items/');
  await page.getByRole('button', { name: 'Close workbench', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Booklets & cards', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Coffee', exact: true })).toBeChecked();
});

test('cancelling native card sharing keeps the prepared file and never downloads automatically', async ({
  page,
  archive,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Cancelled', 'AbortError');
      },
    });
  });
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await open(page);
  await page.getByRole('radio', { name: 'Recommendation card', exact: true }).check();
  await page.getByRole('radio', { name: 'Coffee', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare card', exact: true }).click();
  await page.getByRole('button', { name: 'Share card', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download card (.png)', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(downloads).toEqual([]);
  expect(archive.writes).toEqual([]);
});
