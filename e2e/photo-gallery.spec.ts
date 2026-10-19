import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import type { GalleryEntry, PhotoGallery } from '../src/shared/photo-gallery';
const record = '22222222-2222-4222-8222-222222222222',
  a = '33333333-3333-4333-8333-333333333333',
  b = '44444444-4444-4444-8444-444444444444';
async function setup(page: Page, state: State) {
  state.items[0].id = record;
  state.items[0].hasPhoto = true;
  state.list.rankedIds = [record];
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 300;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#bdc7ad';
    context.fillRect(0, 0, 420, 300);
    context.fillStyle = '#283027';
    context.font = '32px sans-serif';
    context.fillText('Earlier photo', 60, 165);
    const one = canvas.toDataURL('image/png').split(',')[1];
    context.fillStyle = '#c6a48a';
    context.fillRect(0, 0, 420, 300);
    context.fillStyle = '#342a24';
    context.fillText('Later photo', 60, 165);
    return [one, canvas.toDataURL('image/png').split(',')[1]];
  });
  const bytes = new Map<string, Buffer>([
      [a, Buffer.from(image[0], 'base64')],
      [b, Buffer.from(image[1], 'base64')],
    ]),
    removed = new Set<string>();
  const entry = (id: string, caption: string): PhotoGallery['entries'][number] => ({
    id,
    caption,
    arrows: [],
    source: {
      id,
      kind: 'item',
      recordId: record,
      contentType: 'image/png',
      fingerprint: createHash('sha256').update(bytes.get(id)!).digest('hex'),
      createdAt: 1,
      available: true,
    },
  });
  const gallery: PhotoGallery = {
    kind: 'items',
    recordId: record,
    listId: list.id,
    revision: 0,
    coverId: a,
    entries: [entry(a, 'Earlier source'), entry(b, 'Later source')],
  };
  let failRead = false,
    failUploadReply = false,
    failImage = false;
  const uploads: { id: string; body: Buffer }[] = [];
  function changed() {
    state.items[0].updatedAt++;
    state.items[0].hasPhoto = !!gallery.entries.find(
      (entry) => entry.id === gallery.coverId && entry.source.available,
    );
  }
  await page.route(`**/api/items/${record}/photos**`, async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      assetId = path.split('/')[5],
      method = request.method();
    if (!assetId) {
      if (method === 'GET')
        return failRead
          ? route.fulfill({ status: 503, json: { message: 'Saved photos unavailable. Your draft is kept.' } })
          : route.fulfill({ json: { gallery } });
      if (method === 'PUT') {
        const body = request.postDataJSON();
        state.writes.push({ path, body });
        if (body.expectedRevision !== gallery.revision)
          return route.fulfill({
            status: 409,
            json: { message: 'These photos changed elsewhere. Load saved photos to compare.' },
          });
        gallery.entries = body.entries.map((row: GalleryEntry) => ({
          ...row,
          source: gallery.entries.find((entry) => entry.id === row.id)!.source,
        }));
        gallery.coverId = body.coverId;
        gallery.revision++;
        changed();
        return route.fulfill({ json: { gallery } });
      }
    }
    if (method === 'GET')
      return !failImage && bytes.has(assetId) && !removed.has(assetId)
        ? route.fulfill({ contentType: 'image/png', body: bytes.get(assetId) })
        : route.fulfill({ status: 404, json: { message: 'Original unavailable' } });
    if (method === 'PUT') {
      const body = request.postDataBuffer()!;
      uploads.push({ id: assetId, body });
      if (removed.has(assetId))
        return route.fulfill({
          status: 410,
          json: { message: 'This upload was removed. Choose a new photo.' },
        });
      if (bytes.has(assetId)) {
        expect(body).toEqual(bytes.get(assetId));
        return route.fulfill({ json: { gallery } });
      }
      if (Number(request.headers()['x-worth-gallery-revision']) !== gallery.revision)
        return route.fulfill({
          status: 409,
          json: { message: 'Photos changed. Load saved photos to compare.' },
        });
      bytes.set(assetId, body);
      gallery.entries.push(entry(assetId, ''));
      gallery.coverId = assetId;
      gallery.revision++;
      changed();
      if (failUploadReply) {
        failUploadReply = false;
        return route.abort('failed');
      }
      return route.fulfill({ json: { gallery } });
    }
    if (method === 'DELETE') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      if (body.expectedRevision !== gallery.revision)
        return route.fulfill({ status: 409, json: { message: 'Photos changed. Reload before removing.' } });
      gallery.entries = gallery.entries.filter((entry) => entry.id !== assetId);
      removed.add(assetId);
      if (gallery.coverId === assetId) gallery.coverId = null;
      gallery.revision++;
      changed();
      return route.fulfill({ json: { gallery } });
    }
    return route.fallback();
  });
  await page.route(`**/api/items/${record}/photo?*`, (route) =>
    gallery.coverId && bytes.has(gallery.coverId)
      ? route.fulfill({ contentType: 'image/png', body: bytes.get(gallery.coverId) })
      : route.fulfill({ status: 404, body: 'No cover' }),
  );
  return {
    gallery,
    bytes,
    uploads,
    failRead(value: boolean) {
      failRead = value;
    },
    failUploadReply() {
      failUploadReply = true;
    },
    failImage(value: boolean) {
      failImage = value;
    },
  };
}
async function open(page: Page) {
  await page.goto(`/lists/${list.id}?focus=item:${record}`);
  const parent = page.getByRole('dialog', { name: 'Coffee', exact: true });
  const photos = parent.locator('.record-photo');
  if ((await photos.getAttribute('open')) === null) await photos.locator(':scope > summary').click();
  await parent.getByRole('button', { name: 'Manage photos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Photos', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Caption for photo 1', exact: true })).toBeVisible();
  return dialog;
}
async function capture(page: Page, name: string, project: string, target?: string) {
  if (!process.env.WORTH_GALLERY_QA) return;
  await mkdir(process.env.WORTH_GALLERY_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (target)
    await page
      .locator(target)
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_GALLERY_QA}/${name}-${project}.png` });
}

test('captions and arrows keep original bytes and explicit cover/order choices with keyboard controls', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    dialog = await open(page),
    original = fixture.bytes.get(a)!;
  await capture(page, 'overview', info.project.name);
  await dialog
    .getByRole('textbox', { name: 'Caption for photo 1', exact: true })
    .fill('A caption kept separately.');
  await dialog.getByText('Arrows 0/6', { exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Add arrow to photo 1', exact: true }).click();
  await dialog
    .getByRole('textbox', { name: 'Arrow label 1 for photo 1', exact: true })
    .fill('This little detail');
  const across = dialog.getByRole('slider', { name: 'End across for arrow 1 on photo 1', exact: true });
  await across.focus();
  await across.press('ArrowRight');
  await expect(across).toHaveValue('71');
  await capture(page, 'annotated', info.project.name, '.gallery-figure');
  await capture(page, 'arrows', info.project.name, '.gallery-arrows');
  await expect(dialog.getByRole('button', { name: 'Remove original photo 1', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Move photo 1 later', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Use as cover', exact: true }).first().check();
  await dialog.getByRole('button', { name: 'Save photo choices', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Photo choices saved.' })).toBeVisible();
  expect(fixture.gallery.entries.map((entry) => entry.id)).toEqual([b, a]);
  expect(fixture.gallery.coverId).toBe(b);
  expect(fixture.gallery.entries[1]).toMatchObject({
    caption: 'A caption kept separately.',
    arrows: [{ label: 'This little detail', toX: 0.71 }],
  });
  expect(fixture.bytes.get(a)).toEqual(original);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual([record]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Close photos', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('before/after uses deliberate originals, a keyboard slider and a full side-by-side alternative', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    dialog = await open(page);
  await dialog.locator('.photo-comparison > summary').click();
  await dialog.getByRole('combobox', { name: 'Before photo', exact: true }).selectOption(a);
  await dialog.getByRole('combobox', { name: 'After photo', exact: true }).selectOption(b);
  const slider = dialog.getByRole('slider', { name: 'Reveal after photo', exact: true });
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('51');
  await expect(
    dialog.getByRole('img', { name: /Before: Earlier source. After: Later source./ }),
  ).toBeVisible();
  await capture(page, 'comparison', info.project.name, '.photo-comparison');
  await dialog.getByRole('button', { name: 'Side by side', exact: true }).click();
  await expect(dialog.getByRole('img', { name: 'Before: Earlier source', exact: true })).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'After: Later source', exact: true })).toBeVisible();
  await capture(page, 'side-by-side', info.project.name, '.photo-comparison-side');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(fixture.gallery.revision).toBe(0);
  expect(archive.writes).toHaveLength(0);
  await page.reload();
  const restored = await open(page);
  await restored.locator('.photo-comparison > summary').click();
  await expect(restored.getByRole('combobox', { name: 'Before photo', exact: true })).toHaveValue(a);
  await expect(restored.getByRole('button', { name: 'Side by side', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('lost upload replies recover the same frozen file and retry identity after reload', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    dialog = await open(page);
  fixture.failUploadReply();
  await dialog.locator('.gallery-upload summary').click();
  await dialog
    .getByLabel('Choose photo', { exact: true })
    .setInputFiles({ name: 'new-memory.png', mimeType: 'image/png', buffer: fixture.bytes.get(b)! });
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Photo draft saved on this device.' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Upload selected photo', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Your photo draft is kept');
  await expect(dialog.getByRole('alert')).toBeInViewport();
  expect(fixture.gallery.entries).toHaveLength(3);
  const key = fixture.uploads[0].id;
  await capture(page, 'upload-recovery', info.project.name, '.gallery-upload');
  await page.reload();
  const restored = await open(page);
  await expect(restored.getByText('Photo restored from this device.', { exact: true })).toBeVisible();
  await restored.getByRole('button', { name: 'Retry exact upload', exact: true }).click();
  await expect(restored.getByRole('status').filter({ hasText: 'Photo saved.' })).toBeVisible();
  expect(fixture.uploads.map((upload) => upload.id)).toEqual([key, key]);
  expect(fixture.uploads[0].body).toEqual(fixture.uploads[1].body);
  expect(fixture.gallery.entries).toHaveLength(3);
});

test('conflict review preserves a previous caption draft and removal clears only the chosen original', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    dialog = await open(page);
  await dialog
    .getByRole('textbox', { name: 'Caption for photo 1', exact: true })
    .fill('My unfinished caption');
  fixture.gallery.entries[0].caption = 'Newer saved caption';
  fixture.gallery.revision++;
  await dialog.getByRole('button', { name: 'Save photo choices', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed elsewhere');
  await dialog.getByRole('button', { name: 'Load saved photos to compare', exact: true }).click();
  await expect(
    dialog.getByRole('region', { name: 'Current saved photo choices', exact: true }),
  ).toContainText('Newer saved caption');
  await expect(dialog.getByRole('textbox', { name: 'Caption for photo 1', exact: true })).toHaveValue(
    'My unfinished caption',
  );
  await capture(page, 'conflict', info.project.name, '.gallery-review');
  await dialog.getByRole('button', { name: 'Use saved photo choices', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Start from the saved photo choices?', exact: true })
    .getByRole('button', { name: 'Use saved choices', exact: true })
    .click();
  await dialog.getByText('Previous replaced draft', { exact: true }).click();
  await expect(dialog.locator('.gallery-previous')).toContainText('My unfinished caption');
  await page.reload();
  const restored = await open(page);
  await restored.getByText('Previous replaced draft', { exact: true }).click();
  await expect(restored.locator('.gallery-previous')).toContainText('My unfinished caption');
  await restored.getByRole('button', { name: 'Remove original photo 1', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Remove this original photo?', exact: true })
    .getByRole('button', { name: 'Remove original', exact: true })
    .click();
  await expect(restored.getByRole('radio', { name: 'No cover selected', exact: true })).toBeChecked();
  expect(fixture.gallery.entries.map((entry) => entry.id)).toEqual([b]);
  expect(fixture.gallery.coverId).toBeNull();
  await restored.getByRole('radio', { name: 'Use as cover', exact: true }).check();
  await restored.getByRole('button', { name: 'Save photo choices', exact: true }).click();
  await expect(restored.getByRole('status').filter({ hasText: 'Photo choices saved.' })).toBeVisible();
  expect(fixture.gallery.coverId).toBe(b);
});

test('unavailable originals and blocked storage keep recovery usable at narrow widths', async ({
  page,
  archive,
}, info) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  const fixture = await setup(page, archive);
  fixture.gallery.entries[1].source.available = false;
  const dialog = await open(page);
  await expect(dialog).toContainText('Original unavailable. This caption and its arrows are kept');
  await dialog
    .getByRole('textbox', { name: 'Caption for photo 1', exact: true })
    .fill('A caption while storage is blocked');
  await expect(
    dialog.getByRole('status').filter({ hasText: 'Draft could not be saved on this device.' }),
  ).toBeVisible();
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await expect(dialog.getByRole('radio', { name: 'Use as cover', exact: true }).nth(1)).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close photos', exact: true }).click();
  const leave = page.getByRole('dialog', { name: 'Leave these photo drafts?', exact: true });
  await expect(leave).toBeVisible();
  await leave.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(dialog.getByRole('textbox', { name: 'Caption for photo 1', exact: true })).toHaveValue(
    'A caption while storage is blocked',
  );
  await page.setViewportSize(
    info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  );
  await capture(page, 'unavailable', info.project.name, '.gallery-unavailable');
});

test('an interrupted zero-length arrow remains a recoverable draft and fails before any save', async ({
  page,
  archive,
}) => {
  await setup(page, archive);
  const dialog = await open(page);
  await dialog
    .getByRole('textbox', { name: 'Caption for photo 1', exact: true })
    .fill('Interrupted arrow draft');
  await dialog.getByText('Arrows 0/6', { exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Add arrow to photo 1', exact: true }).click();
  for (const label of ['End across', 'End down']) {
    const slider = dialog.getByRole('slider', { name: `${label} for arrow 1 on photo 1`, exact: true });
    await slider.focus();
    await slider.press('Home');
    for (let i = 0; i < 20; i++) await slider.press('ArrowRight');
    await expect(slider).toHaveValue('20');
  }
  await dialog.getByRole('button', { name: 'Save photo choices', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Give this arrow a start and an end');
  expect(archive.writes).toHaveLength(0);
  await page.reload();
  const restored = await open(page);
  await expect(restored.getByRole('textbox', { name: 'Caption for photo 1', exact: true })).toHaveValue(
    'Interrupted arrow draft',
  );
  await restored.getByText('Arrows 1/6', { exact: true }).click();
  const across = restored.getByRole('slider', { name: 'End across for arrow 1 on photo 1', exact: true });
  await expect(across).toHaveValue('20');
  await across.focus();
  await across.press('ArrowRight');
  await restored.getByRole('button', { name: 'Save photo choices', exact: true }).click();
  await expect(restored.getByRole('status').filter({ hasText: 'Photo choices saved.' })).toBeVisible();
  expect(archive.writes).toHaveLength(1);
});

test('failed original images can retry and an account switch removes the body-level gallery without moving its draft', async ({
  page,
  archive,
}) => {
  const fixture = await setup(page, archive);
  fixture.failImage(true);
  const dialog = await open(page);
  await expect(dialog.getByRole('button', { name: 'Retry original photo 1', exact: true })).toBeVisible();
  fixture.failImage(false);
  await dialog.getByRole('button', { name: 'Retry original photo 1', exact: true }).click();
  await expect
    .poll(() =>
      dialog
        .getByRole('img', { name: 'Earlier source', exact: true })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await dialog
    .getByRole('textbox', { name: 'Caption for photo 1', exact: true })
    .fill('PRIVATE account photo caption');
  await expect(dialog.getByRole('status').filter({ hasText: 'Draft saved on this device.' })).toBeVisible();
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { user: { id: 'other', email: 'other@example.test', displayName: 'Other' } } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await expect(page.getByRole('heading', { name: 'Accounts changed.', exact: true })).toBeVisible();
  await expect(page.locator('.photo-gallery-dialog')).toHaveCount(0);
  expect(
    await page.evaluate((id) => localStorage.getItem(`worth:draft:v1:other:gallery:items:${id}`), record),
  ).toBeNull();
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`worth:draft:v1:browser-preview:gallery:items:${id}`),
      record,
    ),
  ).toContain('PRIVATE account photo caption');
  expect(archive.writes).toHaveLength(0);
});
