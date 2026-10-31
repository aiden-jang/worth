import { mkdir } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';
import { inboxPayload } from '../src/shared/inbox';

async function emulateVisibleViewport(page: Page) {
  await page.addInitScript(() => {
    let height: number | undefined,
      top = 0;
    class VisibleViewport extends EventTarget {
      get height() {
        return height ?? innerHeight;
      }
      get width() {
        return innerWidth;
      }
      get offsetTop() {
        return top;
      }
      get offsetLeft() {
        return 0;
      }
      get pageTop() {
        return scrollY + top;
      }
      get pageLeft() {
        return scrollX;
      }
      get scale() {
        return 1;
      }
    }
    const viewport = new VisibleViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    Reflect.set(window, 'resizeSaveViewport', (nextHeight?: number, nextTop = 0) => {
      height = nextHeight;
      top = nextTop;
      viewport.dispatchEvent(new Event('resize'));
      viewport.dispatchEvent(new Event('scroll'));
    });
  });
}
async function visibleViewport(page: Page, height?: number, top = 0) {
  await page.evaluate(
    async ({ height, top }) => {
      Reflect.get(window, 'resizeSaveViewport')(height, top);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    },
    { height, top },
  );
}
async function within(save: Locator, top: number, height: number) {
  await expect
    .poll(async () => {
      const box = await save.boundingBox();
      return !!box && box.height >= 44 && box.y >= top && box.y + box.height <= top + height;
    })
    .toBe(true);
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_MOBILE_SAVE_QA) return;
  await mkdir(process.env.WORTH_MOBILE_SAVE_QA, { recursive: true });
  await page.screenshot({
    path: process.env.WORTH_MOBILE_SAVE_QA + '/' + name + '-' + project + '.png',
    animations: 'disabled',
  });
}

test('Add keeps Save and the focused field clear in a short visible viewport without losing retry data', async ({
  page,
  archive,
}, info) => {
  await emulateVisibleViewport(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  archive.list.name = 'Skincare';
  archive.failCapture = true;
  await page.goto('/lists/' + list.id);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  const save = dialog.getByRole('button', { name: 'Save', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('The little lotion');
  await capture(page, 'name-only', info.project.name);
  if (info.project.name === 'desktop')
    await expect(dialog.locator('.dialog-save-footer')).toHaveCSS('display', 'contents');
  await dialog.getByText('Add details', { exact: true }).click();
  await dialog.getByLabel('Brand or maker', { exact: true }).fill('Harbor');
  const note = dialog.getByRole('textbox', { name: /^Note/ });
  await note.fill('A note from a small-screen journey.');
  await page.setViewportSize({ width: 390, height: 780 });
  await note.focus();
  await within(save, 0, 780);
  await capture(page, 'expanded', info.project.name);
  for (const [height, top] of [
    [360, 0],
    [350, 50],
  ]) {
    await visibleViewport(page, height, top);
    await within(save, top, height);
    await expect
      .poll(async () => {
        const input = await note.boundingBox(),
          footer = await dialog.locator('.dialog-save-footer').boundingBox();
        return !!input && !!footer && input.y >= top && input.y + input.height <= footer.y - 8;
      })
      .toBe(true);
  }
  await capture(page, 'keyboard-space', info.project.name);
  await dialog.evaluate((node) => {
    node.scrollTop = 0;
  });
  await within(save, 50, 350);
  await dialog.getByLabel('Brand or maker', { exact: true }).focus();
  await within(save, 50, 350);
  await save.click();
  const retry = dialog.getByRole('button', { name: 'Retry save', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('Couldn’t save');
  await within(retry, 50, 350);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  archive.failCapture = false;
  await retry.click();
  await expect(dialog).toHaveCount(0);
  expect(archive.items.find((item) => item.title === 'The little lotion')).toMatchObject({
    context: { fields: [{ name: 'Brand', value: 'Harbor' }] },
  });
  const writes = archive.writes.filter((write) => write.path.endsWith('/items'));
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
});

test('item saving stays reachable through phone resizing and leaves discard confirmation independent', async ({
  page,
  archive,
}, info) => {
  await emulateVisibleViewport(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  archive.list.name = 'Skincare';
  archive.items[0].context = {
    ...emptyItemContext,
    fields: [
      { name: 'Brand', value: 'Harbor' },
      { name: 'Size', value: '50 ml' },
    ],
  };
  await page.goto('/lists/' + list.id + '?focus=item:coffee');
  const dialog = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await dialog.getByLabel('Brand or maker', { exact: true }).fill('Harbor Studio');
  const save = dialog.getByRole('button', { name: 'Save changes', exact: true });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 420 });
    await within(save, 0, 420);
    await dialog.getByLabel('Size', { exact: true }).focus();
    await within(save, 0, 420);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    await capture(page, 'item-width-' + width, info.project.name);
  }
  if (info.project.name === 'phone') {
    for (const [width, height] of [
      [768, 780],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await dialog.getByLabel('Size', { exact: true }).focus();
      await within(save, 0, height);
      await capture(page, 'item-touch-' + width, info.project.name);
    }
  }
  await page.setViewportSize({ width: 390, height: 780 });
  await visibleViewport(page, 360);
  await within(save, 0, 360);
  await capture(page, 'item-keyboard-space', info.project.name);
  await visibleViewport(page);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Leave without saving?', exact: true });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).not.toHaveClass(/has-dialog-save/);
  await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await visibleViewport(page, 360);
  await within(save, 0, 360);
  await save.click();
  await expect(dialog.getByText('Saved.', { exact: true })).toBeVisible();
  expect(archive.items[0].context?.fields[0].value).toBe('Harbor Studio');
  expect(archive.items[0].decision).toBe('favorite');
});

test('Unfiled keeps both save and reload actions reachable without covering the note', async ({
  page,
  archive,
}, info) => {
  await emulateVisibleViewport(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 780 });
  const id = '77777777-7777-4777-8777-777777777777';
  archive.inbox.push({
    ...inboxPayload.parse({ title: 'A little find' }),
    id,
    revision: 0,
    createdAt: 1,
    updatedAt: 1,
  });
  await page.goto('/inbox?focus=' + id);
  const dialog = page.getByRole('dialog', { name: 'Keep the details.', exact: true });
  const note = dialog.getByLabel('Private note', { exact: true });
  await note.fill('Keep this unfinished thought.');
  await visibleViewport(page, 360);
  const save = dialog.getByRole('button', { name: 'Save changes', exact: true });
  await within(save, 0, 360);
  await within(dialog.getByRole('button', { name: 'Reload saved details', exact: true }), 0, 360);
  await capture(page, 'unfiled-keyboard-space', info.project.name);
  await save.click();
  await expect.poll(() => archive.inbox[0].note).toBe('Keep this unfinished thought.');
  await expect(save).toBeDisabled();
});

test('activity logging keeps Save reachable with optional details open and saves no invented sets', async ({
  page,
  archive,
}, info) => {
  await emulateVisibleViewport(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  archive.list.kind = 'activity';
  archive.list.name = 'Gym';
  archive.items = [];
  await page.route('**/api/lists/*/workouts', (route) => route.fulfill({ json: { workouts: [] } }));
  await page.route('**/api/lists/*/routines', (route) => route.fulfill({ json: { routines: [] } }));
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/lists/' + list.id);
  await page.getByRole('button', { name: 'Add first log', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'What happened?', exact: true });
  await dialog.getByLabel('What', { exact: true }).fill('Evening mobility');
  await dialog.locator('summary').filter({ hasText: 'More details' }).click();
  await dialog.getByRole('textbox', { name: /^Private note/ }).fill('A little movement.');
  await visibleViewport(page, 360);
  const save = dialog.getByRole('button', { name: 'Save log', exact: true });
  await within(save, 0, 360);
  await capture(page, 'activity-keyboard-space', info.project.name);
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect(archive.logs).toHaveLength(1);
  expect(archive.logs[0]).toMatchObject({
    title: 'Evening mobility',
    note: 'A little movement.',
    amount: null,
    sets: null,
    reps: null,
  });
});
