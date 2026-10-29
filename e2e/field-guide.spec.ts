import { mkdir, readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';
const a = '22222222-2222-4222-8222-222222222222',
  b = '33333333-3333-4333-8333-333333333333',
  c = '44444444-4444-4444-8444-444444444444',
  otherList = '55555555-5555-4555-8555-555555555555';
async function setup(page: Page, state: State) {
  state.items[0].id = a;
  state.items[0].context = {
    ...emptyItemContext,
    location: 'PRIVATE Brooklyn address',
    recommendedBy: 'PRIVATE PERSON',
    sourceUrl: 'https://private.test/token',
  };
  state.items[1].id = b;
  state.list.rankedIds = [a];
  state.extraLists.push({
    ...state.list,
    id: otherList,
    name: 'PRIVATE Places',
    rankedIds: [],
    itemCount: 1,
    rankedCount: 0,
  });
  state.items.push({
    ...state.items[1],
    id: c,
    listId: otherList,
    title: 'A saved place',
    note: 'PRIVATE PLACE NOTE',
    context: { ...emptyItemContext, location: 'PRIVATE Kyoto address' },
  });
  const unavailable = new Set<string>();
  let failPhoto = false;
  await page.route('**/api/items/*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const id = new URL(route.request().url()).pathname.split('/')[3],
      item = state.items.find((item) => item.id === id);
    return item && !unavailable.has(id)
      ? route.fulfill({ json: { item } })
      : route.fulfill({ status: 404, json: { error: 'NOT_FOUND', message: 'Record not found' } });
  });
  await page.route('**/api/lists/*/items', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const id = new URL(route.request().url()).pathname.split('/')[3];
    return route.fulfill({
      json: { items: state.items.filter((item) => item.listId === id && !unavailable.has(item.id)) },
    });
  });
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#bec7ad';
    context.fillRect(0, 0, 240, 160);
    context.fillStyle = '#34382d';
    context.font = '24px sans-serif';
    context.fillText('Test photo', 28, 85);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  const jpeg = Buffer.from(png, 'base64'),
    description = Buffer.from('PRIVATE PHOTO LOCATION\0');
  const tiff = Buffer.alloc(26 + description.length);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x010e, 10);
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(description.length, 14);
  tiff.writeUInt32LE(26, 18);
  description.copy(tiff, 26);
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), tiff]),
    header = Buffer.alloc(4);
  header[0] = 255;
  header[1] = 225;
  header.writeUInt16BE(exif.length + 2, 2);
  const at = jpeg[2] === 255 && jpeg[3] === 224 ? 4 + jpeg.readUInt16BE(4) : 2;
  const photoBytes = Buffer.concat([jpeg.subarray(0, at), header, exif, jpeg.subarray(at)]);
  await page.route('**/api/items/*/photo?*', (route) => {
    expect(route.request().method()).toBe('GET');
    return failPhoto
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({ contentType: 'image/jpeg', body: photoBytes });
  });
  return {
    unavailable,
    photoBytes,
    failPhoto(value: boolean) {
      failPhoto = value;
    },
  };
}
async function add(page: Page, listId: string, id: string) {
  await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption(listId);
  await page.getByRole('combobox', { name: 'Record', exact: true }).selectOption(id);
  await page.getByRole('button', { name: 'Add to guide', exact: true }).click();
}
function preview(page: Page) {
  return page.getByRole('region', { name: 'Field guide preview', exact: true }).filter({ visible: true });
}
async function html(page: Page) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download guide (.html)', exact: true }).click();
  return readFile((await (await event).path())!, 'utf8');
}
async function capture(page: Page, name: string, project: string, target = '.field-guide-page') {
  if (!process.env.WORTH_GUIDE_QA) return;
  await mkdir(process.env.WORTH_GUIDE_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.locator(target).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_GUIDE_QA}/${name}-${project}.png` });
}

test('a cross-collection field guide exposes only chosen fields and prints the prepared file', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive);
  await page.goto('/patterns');
  await page.locator('.recall-more > summary').click();
  await page.getByRole('link', { name: 'Make a field guide →', exact: true }).click();
  await capture(page, 'overview', info.project.name);
  await add(page, list.id, a);
  await add(page, otherList, c);
  await expect(preview(page)).toContainText('Coffee');
  await expect(preview(page)).toContainText('A saved place');
  for (const text of ['PRIVATE NOTE', 'PRIVATE Brooklyn address', 'PRIVATE Places', 'Favorite'])
    await expect(preview(page)).not.toContainText(text);
  await page.getByRole('textbox', { name: 'Guide title', exact: true }).fill('A weekend guide');
  await page.getByRole('textbox', { name: 'Caption for Coffee', exact: true }).fill('Walk there.');
  await page.getByRole('checkbox', { name: 'Include record notes', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Include saved locations', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Include collection names', exact: true }).check();
  await expect(preview(page)).toContainText('Where: PRIVATE Brooklyn address');
  await expect(preview(page)).toContainText('PRIVATE NOTE');
  await capture(page, 'choices', info.project.name, '.guide-selection');
  await page.getByRole('button', { name: 'Prepare field guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeEnabled();
  await capture(page, 'preview', info.project.name, '.field-guide-page .booklet-preview');
  const file = await html(page);
  expect(file).toContain('A FIELD GUIDE FROM WORTH');
  expect(file).toContain('Where: PRIVATE Kyoto address');
  expect(file).toContain('PRIVATE NOTE');
  expect(file).toContain('SIL OPEN FONT LICENSE');
  for (const hidden of [
    'PRIVATE PERSON',
    'https://private.test',
    '/api/items/',
    'COLLECTION RANK',
    'Favorite',
  ])
    expect(file).not.toContain(hidden);
  await expect(page.getByRole('button', { name: 'Print / save PDF', exact: true })).toBeEnabled();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.booklet-print-root')).toBeVisible();
  await expect(page.locator('.booklet-print-root')).toContainText('A weekend guide');
  await expect(page.locator('#root')).toBeHidden();
  if (process.env.WORTH_GUIDE_QA && info.project.name === 'desktop') {
    await mkdir('/private/tmp/worth-polish/tmp/pdfs', { recursive: true });
    await page.pdf({
      path: '/private/tmp/worth-polish/tmp/pdfs/field-guide.pdf',
      format: 'A5',
      printBackground: true,
    });
  }
  expect(archive.writes).toEqual([]);
});

test('guide order and captions recover, changed sources invalidate files and unavailable records stay recoverable', async ({
  page,
  archive,
}, info) => {
  const model = await setup(page, archive);
  await page.goto('/patterns/field-guide');
  await add(page, list.id, a);
  await add(page, list.id, b);
  await page.getByRole('textbox', { name: 'Caption for Coffee', exact: true }).fill('Keep this caption');
  await page.getByRole('button', { name: 'Move Tea earlier', exact: true }).click();
  await expect(preview(page).locator('.booklet-paper').nth(1)).toContainText('Tea');
  await page.getByRole('button', { name: 'Prepare field guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeEnabled();
  archive.items[0].title = 'Coffee remembered';
  archive.items[0].updatedAt++;
  await page.getByRole('button', { name: 'Refresh current details', exact: true }).click();
  await expect(preview(page)).toContainText('Coffee remembered');
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Caption for Coffee remembered', exact: true })).toHaveValue(
    'Keep this caption',
  );
  model.unavailable.add(a);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Caption for Coffee', exact: true })).toHaveValue(
    'Keep this caption',
  );
  await expect(page.getByRole('alert').filter({ hasText: 'This record is unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prepare field guide', exact: true })).toBeDisabled();
  await capture(page, 'unavailable', info.project.name, '.guide-selection');
  expect(archive.writes).toEqual([]);
});

test('photo failures retain manual guide choices and successful files embed only opted-in photos', async ({
  page,
  archive,
}) => {
  const model = await setup(page, archive);
  archive.items[0].hasPhoto = true;
  model.failPhoto(true);
  await page.goto('/patterns/field-guide');
  await add(page, list.id, a);
  await page.getByRole('checkbox', { name: 'Include photos', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare field guide', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('A selected photo is unavailable');
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeDisabled();
  model.failPhoto(false);
  await page.getByRole('button', { name: 'Prepare field guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeEnabled();
  const withPhoto = await html(page);
  expect(withPhoto).toContain('data:image/jpeg;base64,');
  expect(model.photoBytes.toString('latin1')).toContain('PRIVATE PHOTO LOCATION');
  const embedded = withPhoto.match(/src="data:image\/jpeg;base64,([^"]+)"/);
  expect(embedded).not.toBeNull();
  expect(Buffer.from(embedded![1], 'base64').toString('latin1')).not.toContain('PRIVATE PHOTO LOCATION');
  expect(withPhoto).not.toContain('/api/items/');
  await page.getByRole('checkbox', { name: 'Include photos', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Prepare field guide', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toBeEnabled();
  expect(await html(page)).not.toContain('data:image/');
  expect(archive.writes).toEqual([]);
});

test('guide controls reflow accessibly and blocked storage protects unfinished captions on navigation', async ({
  page,
  archive,
}) => {
  await setup(page, archive);
  await page.goto('/patterns/field-guide');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Blocked');
    };
  });
  await add(page, list.id, a);
  await page.getByRole('textbox', { name: 'Caption for Coffee', exact: true }).fill('A caption for copying');
  await expect(page.getByText('Draft could not be saved on this device. Keep this page open.')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Look back' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this guide draft?' })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Leave this guide draft?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: 'Caption for Coffee', exact: true })).toHaveValue(
    'A caption for copying',
  );
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  archive.items[0].title = 'A long find '.repeat(10);
  await page.getByRole('button', { name: 'Refresh current details', exact: true }).click();
  await expect(preview(page)).toContainText('A long find');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('an account change cancels pending guide preparation and never retargets its draft', async ({
  page,
  archive,
}) => {
  await setup(page, archive);
  await page.goto('/patterns/field-guide');
  await add(page, list.id, a);
  await page.getByRole('textbox', { name: 'Caption for Coffee', exact: true }).fill('PRIVATE owner caption');
  let started!: () => void, release!: () => void;
  const began = new Promise<void>((resolve) => {
      started = resolve;
    }),
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
  await page.route('**/*dm-sans-latin-400-normal*.woff2', async (route: Route) => {
    started();
    await gate;
    await route.continue().catch(() => {});
  });
  await page.getByRole('button', { name: 'Prepare field guide', exact: true }).click();
  await began;
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { user: { id: 'other', email: 'other@example.test', displayName: 'Other' } } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await expect(page.getByRole('heading', { name: 'Accounts changed.' })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'Download guide (.html)', exact: true })).toHaveCount(0);
  await expect(page.getByText('PRIVATE owner caption', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('worth:draft:v1:other:field-guide'))).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem('worth:draft:v1:browser-preview:field-guide')),
  ).toContain('PRIVATE owner caption');
});
