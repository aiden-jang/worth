import { mkdir, readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
const record = '22222222-2222-4222-8222-222222222222',
  a = '33333333-3333-4333-8333-333333333333',
  b = '44444444-4444-4444-8444-444444444444';
async function setup(page: Page, state: State) {
  state.items[0].id = record;
  state.items[0].hasPhoto = true;
  state.list.rankedIds = [record];
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#bdc7ad';
    ctx.fillRect(0, 0, 300, 400);
    ctx.fillStyle = '#181915';
    ctx.font = '30px sans-serif';
    ctx.fillText('Source one', 40, 200);
    const first = canvas.toDataURL('image/png').split(',')[1];
    canvas.width = 500;
    canvas.height = 250;
    ctx.fillStyle = '#c6a48a';
    ctx.fillRect(0, 0, 500, 250);
    ctx.fillStyle = '#181915';
    ctx.font = '30px sans-serif';
    ctx.fillText('Source two', 120, 130);
    return [first, canvas.toDataURL('image/png').split(',')[1]];
  });
  const bytes = new Map([
    [a, Buffer.from(images[0], 'base64')],
    [b, Buffer.from(images[1], 'base64')],
  ]);
  let cover: Buffer | null = null,
    type = 'image/webp',
    lostReply = false,
    missing = false,
    brokenCover = false,
    held: Promise<void> | null = null;
  let release: (() => void) | null = null;
  const uploads: Buffer[] = [];
  let galleryReads = 0;
  await page.route(`**/api/items/${record}/photos**`, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/')[5];
    if (id && route.request().headers()['x-worth-account'] && held) await held;
    if (id)
      return missing
        ? route.fulfill({ status: 404, json: { message: 'Unavailable original' } })
        : route.fulfill({ contentType: 'image/png', body: bytes.get(id)! });
    galleryReads++;
    return route.fulfill({
      json: {
        gallery: {
          kind: 'items',
          recordId: record,
          listId: list.id,
          revision: 2,
          coverId: a,
          entries: [a, b].map((id, i) => ({
            id,
            caption: `Private source ${i + 1}`,
            arrows: [],
            source: {
              id,
              kind: 'item',
              recordId: record,
              contentType: 'image/png',
              fingerprint: null,
              createdAt: 1,
              available: true,
            },
          })),
        },
      },
    });
  });
  await page.route(`**/api/lists/${list.id}/cover*`, async (route) => {
    const req = route.request();
    if (req.method() === 'GET')
      return cover
        ? route.fulfill({
            contentType: brokenCover ? 'image/png' : type,
            body: brokenCover ? bytes.get(b)!.subarray(0, 24) : cover,
          })
        : route.fulfill({ status: 404, json: { message: 'No cover' } });
    const blob = req.postDataBuffer()!;
    uploads.push(blob);
    const version = Number(req.headers()['x-worth-cover-revision']);
    if (version !== (state.list.coverRevision ?? 0)) {
      if (cover?.equals(blob))
        return route.fulfill({ json: { hasCoverPhoto: true, revision: state.list.coverRevision ?? 0 } });
      return route.fulfill({
        status: 409,
        json: {
          error: 'COVER_CHANGED',
          message: 'This collection changed elsewhere. Review its current cover before trying again.',
        },
      });
    }
    cover = blob;
    type = req.headers()['content-type'];
    state.list.hasCoverPhoto = true;
    state.list.updatedAt++;
    state.list.coverRevision = (state.list.coverRevision ?? 0) + 1;
    state.writes.push({ path: new URL(req.url()).pathname, body: 'cover' });
    if (lostReply) {
      lostReply = false;
      return route.abort('failed');
    }
    return route.fulfill({ json: { hasCoverPhoto: true, revision: state.list.coverRevision ?? 0 } });
  });
  await page.route(`**/api/items/${record}/photo?*`, (route) =>
    route.fulfill({ contentType: 'image/png', body: bytes.get(a)! }),
  );
  return {
    uploads,
    bytes,
    galleryReads: () => galleryReads,
    setMissing: (v: boolean) => (missing = v),
    breakCover: (v: boolean) => (brokenCover = v),
    setLostReply: () => (lostReply = true),
    hold: () => {
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    release: () => {
      held = null;
      release?.();
      release = null;
    },
    replaceElsewhere: () => {
      cover = bytes.get(b)!;
      type = 'image/png';
      state.list.updatedAt++;
      state.list.coverRevision = (state.list.coverRevision ?? 0) + 1;
      state.list.hasCoverPhoto = true;
    },
    cover: () => cover,
  };
}
async function open(page: Page) {
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Cover collage', exact: true }).click();
  return page.getByRole('dialog', { name: 'Cover collage', exact: true });
}
async function add(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cover collage', exact: true });
  await dialog.getByLabel('Record or visit').selectOption(`items:${record}`);
  await dialog.getByRole('button', { name: 'Load its photos', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Add photo 1', exact: true })).toHaveAttribute(
    'aria-description',
    'Private source 1',
  );
  await dialog.getByRole('button', { name: 'Add photo 1', exact: true }).click();
  return dialog;
}
async function prepare(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Cover collage', exact: true });
  await dialog.getByRole('button', { name: 'Prepare exact image', exact: true }).click();
  await expect(dialog.getByRole('img', { name: 'Exact prepared collage', exact: true })).toBeVisible();
  return dialog;
}
async function capture(page: Page, name: string, project: string, target?: string) {
  if (!process.env.WORTH_COLLAGE_QA) return;
  await mkdir(process.env.WORTH_COLLAGE_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (target)
    await page
      .locator(target)
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_COLLAGE_QA}/${name}-${project}.png` });
}
test('manual collage layers and keyboard positions prepare the exact downloadable cover without altering originals or calls', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  await open(page);
  const dialog = await add(page);
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await capture(page, 'overview', info.project.name);
  await dialog.getByRole('button', { name: 'Load its photos', exact: true }).click();
  await expect.poll(() => fixture.galleryReads()).toBe(2);
  await dialog.getByRole('button', { name: 'Add photo 2', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false }).fill('A little detail');
  const across = dialog.getByRole('slider', { name: 'Across for frame 2', exact: false });
  await across.focus();
  await across.press('End');
  await expect(across).toHaveValue('50');
  await dialog.getByRole('button', { name: 'Move frame 2 back', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: 'Caption for frame 2', exact: false })).toHaveValue(
    'A little detail',
  );
  await capture(page, 'arrangement', info.project.name, '.collage-layout');
  await capture(page, 'keyboard-controls', info.project.name, '.collage-frame-list');
  await prepare(page);
  await capture(page, 'prepared', info.project.name, '.collage-prepared');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download cover image' }).click();
  const file = await download;
  const downloaded = await readFile((await file.path())!);
  expect(file.suggestedFilename()).toMatch(/worth-cover-collage\.(webp|png)$/);
  const dimensions = await dialog
    .getByRole('img', { name: 'Exact prepared collage', exact: true })
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });
  expect(dimensions).toEqual([1280, 800]);
  await dialog.getByRole('button', { name: 'Save as collection cover', exact: true }).click();
  await expect(
    dialog.getByText('Collage saved as the private collection cover.', { exact: false }),
  ).toBeVisible();
  expect(fixture.uploads[0].equals(downloaded)).toBe(true);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual([record]);
  expect(archive.writes).toHaveLength(1);
  await dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false }).fill('Changed draft');
  await expect(dialog.getByRole('img', { name: 'Exact prepared collage', exact: true })).toHaveCount(0);
  expect(fixture.bytes.get(a)!.toString('base64')).toContain('iVBOR');
  await dialog.getByRole('button', { name: 'Close collage', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Close the collage?', exact: true })
    .getByRole('button', { name: 'Close collage', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cover collage', exact: true })).toBeFocused();
});
test('a lost cover response retries the same prepared bytes and never overwrites a later cover without review', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  await open(page);
  await add(page);
  const dialog = await prepare(page);
  fixture.setLostReply();
  await dialog.getByRole('button', { name: 'Save as collection cover', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Couldn’t connect');
  await dialog.getByRole('button', { name: 'Save as collection cover', exact: true }).click();
  await expect(
    dialog.getByText('Collage saved as the private collection cover.', { exact: false }),
  ).toBeVisible();
  expect(fixture.uploads[0].equals(fixture.uploads[1])).toBe(true);
  expect(archive.writes).toHaveLength(1);
  fixture.replaceElsewhere();
  const newer = fixture.cover();
  await dialog.getByRole('button', { name: 'Save as collection cover', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('changed elsewhere');
  expect(fixture.cover()).toBe(newer);
  fixture.breakCover(true);
  await dialog.getByRole('button', { name: 'Review current cover', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be displayed');
  await expect(dialog.getByRole('button', { name: 'Use this reviewed cover version' })).toBeDisabled();
  fixture.breakCover(false);
  await dialog.getByRole('button', { name: 'Review current cover', exact: true }).click();
  await expect(
    dialog.getByRole('img', { name: 'Current saved collection cover', exact: true }),
  ).toBeVisible();
  await capture(page, 'conflict-review', info.project.name, '.collage-cover-review');
  await dialog.getByRole('button', { name: 'Use this reviewed cover version' }).click();
  expect(fixture.cover()).toBe(newer);
  await dialog.getByRole('button', { name: 'Save as collection cover', exact: true }).click();
  await expect(
    dialog.getByText('Collage saved as the private collection cover.', { exact: false }),
  ).toBeVisible();
  expect(archive.writes).toHaveLength(2);
});
test('arrangements recover without a stale prepared file and missing originals retain captions with usable reflow and retry', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  await open(page);
  let dialog = await add(page);
  await dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false }).fill('Keep this caption');
  await page.reload();
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Cover collage', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Cover collage', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false })).toHaveValue(
    'Keep this caption',
  );
  await expect(dialog.getByRole('img', { name: 'Exact prepared collage', exact: true })).toHaveCount(0);
  fixture.setMissing(true);
  await dialog.getByRole('button', { name: 'Prepare exact image', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('unavailable');
  await expect(dialog.getByRole('alert')).not.toContainText('prepared image are kept');
  await capture(page, 'unavailable', info.project.name, '.collage-prepared, .form-error');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  fixture.setMissing(false);
  await prepare(page);
  expect(archive.writes).toHaveLength(0);
});
test('blocked device storage asks before closing and an account change removes the collage without moving its draft', async ({
  page,
  archive,
}) => {
  await setup(page, archive);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('blocked');
    };
  });
  await open(page);
  const dialog = await add(page);
  await dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false }).fill('Copy this first');
  await expect(dialog.getByRole('status').filter({ hasText: 'Draft could not be saved' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close collage', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Close the collage?', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false })).toHaveValue(
    'Copy this first',
  );
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { user: { id: 'other', email: 'other@example.test', displayName: 'Other' } } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await expect(dialog).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});

test('stopping preparation discards delayed work and a fresh preparation can succeed', async ({
  page,
  archive,
}) => {
  const fixture = await setup(page, archive);
  await open(page);
  const dialog = await add(page);
  fixture.hold();
  await dialog.getByRole('button', { name: 'Prepare exact image', exact: true }).click();
  await expect(dialog.getByText('Preparing the image…', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Stop preparation', exact: true }).click();
  fixture.release();
  await expect(
    dialog.getByText('Preparation stopped. Your arrangement is kept.', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Exact prepared collage', exact: true })).toHaveCount(0);
  await prepare(page);
  expect(archive.writes).toHaveLength(0);
});

test('collage controls and caption backing pass accessibility checks', async ({ page, archive }) => {
  await setup(page, archive);
  await open(page);
  const dialog = await add(page);
  await dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false }).fill('A readable caption');
  await prepare(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('browser Back preserves a blocked-storage arrangement until the user deliberately leaves', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('blocked');
    };
  });
  await page.goto('/');
  await page.locator('main').getByRole('link').filter({ hasText: 'My drinks' }).first().click();
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Cover collage', exact: true }).click();
  const dialog = await add(page);
  await dialog
    .getByRole('textbox', { name: 'Caption for frame 1', exact: false })
    .fill('Keep my route draft');
  await expect(dialog.getByRole('status').filter({ hasText: 'Draft could not be saved' })).toBeVisible();
  await page.evaluate(() => history.back());
  const confirm = page.getByRole('dialog', { name: 'Leave this page?', exact: true });
  await expect(confirm).toBeVisible();
  for (const button of await confirm.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await capture(page, 'navigation', info.project.name);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}$`));
  await expect(dialog.getByRole('textbox', { name: 'Caption for frame 1', exact: false })).toHaveValue(
    'Keep my route draft',
  );
  await page.evaluate(() => history.back());
  await confirm.getByRole('button', { name: 'Leave page', exact: true }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.locator('.cover-collage-dialog')).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});
