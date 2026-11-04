import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, list, test } from './fixtures';
import { closeItemSheet } from './navigation';
import { emptyItemContext } from '../src/shared/item-context';

test('collection previews show saved information without editing it at any width', async ({
  page,
  archive,
}, info) => {
  archive.list.name = 'Drinks';
  archive.list.rankedIds = [];
  archive.items[0] = {
    ...archive.items[0],
    title: 'Light Citrus Wheat',
    type: '',
    decision: 'would_not_again',
    context: { ...structuredClone(emptyItemContext), fields: [{ name: 'Brand', value: 'Blue Moon' }] },
  };
  archive.items[1].title = 'Goose Island IPA';
  for (const width of info.project.name === 'desktop' ? [1440, 960, 768, 430, 320] : [390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    await page.goto('/lists/' + list.id);
    await expect(page.locator('.collection-row-options select')).toHaveCount(0);
    const row = page.locator('.collection-index-row').filter({ hasText: 'Light Citrus Wheat' });
    const title = row.locator('strong');
    const start = (await title.boundingBox())!.x;
    await row.locator(':scope > button').hover();
    expect((await title.boundingBox())!.x).toBeCloseTo(start, 0);
    await row.locator(':scope > button').click();
    const preview = page.getByRole('region', { name: 'Your call for Light Citrus Wheat' });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS('opacity', '1');
    expect((await title.boundingBox())!.x).toBeCloseTo(start, 0);
    await expect(preview.getByText('Not again.', { exact: true })).toBeVisible();
    await expect(preview.getByText('Blue Moon', { exact: true })).toBeVisible();
    await expect(preview.locator('.call-choices, select, input, .item-more')).toHaveCount(0);
    await expect(preview.getByText('UNRANKED', { exact: true })).toHaveCount(0);
    await expect(preview.getByRole('button')).toHaveCount(width <= 960 ? 2 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    if (process.env.WORTH_PREVIEW_QA) {
      await mkdir(process.env.WORTH_PREVIEW_QA, { recursive: true });
      await page.screenshot({
        path: `${process.env.WORTH_PREVIEW_QA}/preview-${info.project.name}-${width}.png`,
        animations: 'disabled',
      });
    }
    await page.keyboard.press('Escape');
    await expect(row.locator(':scope > button')).toBeFocused();
    if (process.env.WORTH_PREVIEW_QA)
      await page.screenshot({
        path: `${process.env.WORTH_PREVIEW_QA}/rows-${info.project.name}-${width}.png`,
        animations: 'disabled',
      });
    const edit = row.getByRole('button', { name: 'Edit Light Citrus Wheat', exact: true });
    expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await row.getByLabel('More options for Light Citrus Wheat', { exact: true }).click();
    await expect(row.getByRole('button', { name: 'Add experience for Light Citrus Wheat' })).toBeInViewport();
    if (process.env.WORTH_PREVIEW_QA && [1440, 390].includes(width))
      await page.screenshot({
        path: `${process.env.WORTH_PREVIEW_QA}/menu-${info.project.name}-${width}.png`,
        animations: 'disabled',
      });
    await page.keyboard.press('Escape');
    await expect(row.getByLabel('More options for Light Citrus Wheat', { exact: true })).toBeFocused();
  }
  expect(archive.writes).toEqual([]);
  expect(archive.items[0].decision).toBe('would_not_again');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('row editing has explicit save and discard while phone preview navigation stays reachable', async ({
  page,
  archive,
}, info) => {
  await page.goto('/lists/' + list.id);
  const edit = page.getByRole('button', { name: 'Edit Coffee', exact: true });
  await edit.focus();
  await page.keyboard.press('Enter');
  const editor = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await editor.getByRole('button', { name: 'Meh', exact: true }).click();
  await expect(editor.getByText('Unsaved changes.', { exact: true })).toBeVisible();
  expect(archive.writes).toEqual([]);
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Leave without saving?', exact: true })
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect(edit).toBeFocused();
  expect(archive.items[0].decision).toBe('favorite');
  await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Your call for Coffee' });
  if (info.project.name === 'phone') await preview.getByRole('button', { name: 'Edit', exact: true }).click();
  else await edit.click();
  await expect(page.getByRole('dialog', { name: 'Saved item: Coffee' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Not again', exact: true }).click();
  expect(archive.items[0].decision).toBe('favorite');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByText('Saved.', { exact: true })).toBeVisible();
  expect(archive.items[0].decision).toBe('would_not_again');
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
  await expect(preview.getByText('Not again.', { exact: true })).toBeVisible();
  if (info.project.name === 'phone') {
    await preview.getByRole('button', { name: 'Add experience for Coffee' }).click();
    await expect(editor.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  }
});

test('row options preserve queues and rank separately with visible failure recovery', async ({
  page,
  archive,
}) => {
  let failQueue = true;
  await page.route('**/api/items/coffee', async (route) => {
    if (failQueue && route.request().method() === 'PATCH' && route.request().postDataJSON().revisitQueued) {
      return route.fulfill({ status: 503, json: { message: 'Queue unavailable. Try again.' } });
    }
    return route.fallback();
  });
  await page.goto('/lists/' + list.id);
  const row = page.locator('.collection-index-row').filter({ hasText: 'Coffee' });
  const more = row.getByLabel('More options for Coffee', { exact: true });
  await more.click();
  await row.getByRole('button', { name: 'Add to revisit queue', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Queue unavailable' })).toBeVisible();
  expect(archive.items[0].revisitQueued).toBeFalsy();
  failQueue = false;
  await more.click();
  await row.getByRole('button', { name: 'Add to revisit queue', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Added to revisit queue.' })).toBeVisible();
  await more.click();
  await row.getByRole('button', { name: 'Save to Want to try', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved to Want to try.' })).toBeVisible();
  await more.click();
  await row.getByLabel('Rank Coffee', { exact: true }).click();
  await row.getByRole('combobox', { name: 'Place Coffee in your ranking', exact: true }).selectOption('none');
  await expect(page.getByRole('status').filter({ hasText: 'Ranking saved.' })).toBeVisible();
  await expect(more).toBeFocused();
  expect(archive.list.rankedIds).toEqual([]);
  expect(archive.items[0]).toMatchObject({ decision: 'favorite', wantToTry: true, revisitQueued: true });
  await more.click();
  await row.getByRole('button', { name: 'Add note to Coffee', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await expect(editor.getByRole('textbox', { name: /^Private note/ })).toBeFocused();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await closeItemSheet(page);
  await more.click();
  await row.getByRole('button', { name: 'Add experience for Coffee', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  expect(archive.logs).toHaveLength(0);
});

test('long rows keep secondary actions reachable near the viewport edge', async ({ page, archive }, info) => {
  archive.items = Array.from({ length: 12 }, (_, index) => ({
    ...structuredClone(archive.items[0]),
    id: 'edge-' + index,
    title: `A deliberately long saved name for a small collection ${index + 1}`,
  }));
  archive.list.rankedIds = [];
  await page.setViewportSize({ width: info.project.name === 'desktop' ? 1024 : 390, height: 600 });
  await page.goto('/lists/' + list.id);
  await expect(page.locator('.collection-row-options select')).toHaveCount(0);
  const row = page.locator('.collection-index-row').last();
  await row.evaluate(
    (node, block: ScrollLogicalPosition) => node.scrollIntoView({ block }),
    info.project.name === 'desktop' ? 'end' : 'center',
  );
  const more = row.locator('.collection-row-options > summary');
  await more.click();
  const panel = row.locator('.entry-options-panel');
  await expect(panel).toBeVisible();
  const title = await row.locator('strong').innerText();
  await row.getByLabel(`Rank ${title}`, { exact: true }).click();
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
      return !!box && box.y >= 12 && box.y + box.height <= 588;
    })
    .toBe(true);
  const queue = row.getByRole('button', { name: 'Add to revisit queue', exact: true });
  await queue.focus();
  await expect(queue).toBeInViewport();
  expect((await queue.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  expect(archive.writes).toEqual([]);
});

test('reordering beyond the displayed page follows the moved item without opening its preview', async ({
  page,
  archive,
}) => {
  archive.items = Array.from({ length: 60 }, (_, index) => ({
    ...structuredClone(archive.items[0]),
    id: 'ranked-' + index,
    title: `Saved drink ${index + 1}`,
  }));
  archive.list.rankedIds = archive.items.map((item) => item.id);
  await page.goto('/lists/' + list.id);
  await expect(page.locator('.collection-index-row')).toHaveCount(50);
  const row = page
    .locator('.collection-index-row')
    .filter({ has: page.getByRole('button', { name: 'Edit Saved drink 1', exact: true }) });
  const more = row.getByLabel('More options for Saved drink 1', { exact: true });
  await more.click();
  await row.getByLabel('Rank Saved drink 1', { exact: true }).click();
  await row
    .getByRole('combobox', { name: 'Place Saved drink 1 in your ranking', exact: true })
    .selectOption('60');
  await expect(page.getByRole('status').filter({ hasText: 'Ranking saved.' })).toBeVisible();
  await expect(page.locator('.collection-index-row')).toHaveCount(60);
  await expect(more).toBeFocused();
  await expect(more).toBeInViewport();
  await expect(page.locator('.opinion-slip')).toHaveCount(0);
  expect(archive.list.rankedIds.at(-1)).toBe('ranked-0');
  expect(archive.items[0].decision).toBe('favorite');
});

test('narrow archives open a reachable preview instead of placing it after their records', async ({
  page,
  archive,
}, info) => {
  archive.items = Array.from({ length: 60 }, (_, index) => ({
    ...structuredClone(archive.items[0]),
    id: 'narrow-' + index,
    title: `Saved drink ${index + 1}`,
  }));
  archive.list.rankedIds = [];
  await page.setViewportSize({ width: 768, height: 780 });
  await page.goto('/lists/' + list.id);
  const row = page.locator('.collection-index-row > button').first();
  const start = (await row.boundingBox())!.y;
  await row.click();
  const preview = page.getByRole('dialog', { name: 'Saved item: Saved drink 1', exact: true });
  await expect(preview).toBeInViewport();
  await expect(page.locator('.cabinet-collection-body > .opinion-slip')).toHaveCount(0);
  expect((await row.boundingBox())!.y).toBeCloseTo(start, 0);
  if (process.env.WORTH_PREVIEW_QA) {
    await mkdir(process.env.WORTH_PREVIEW_QA, { recursive: true });
    await page.screenshot({
      path: `${process.env.WORTH_PREVIEW_QA}/narrow-${info.project.name}-768.png`,
      animations: 'disabled',
    });
  }
  await preview.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(preview).toHaveCount(0);
  const editor = page.getByRole('dialog', { name: 'Saved drink 1', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(row).toBeFocused();
  expect(archive.writes).toEqual([]);
});
