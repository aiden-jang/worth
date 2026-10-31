import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';
import { closeItemSheet, entryOptions } from './navigation';

test('optional product details recover drafts, preserve free purchases, and remain searchable and filterable', async ({
  page,
  archive,
}, info) => {
  archive.list.name = 'Skincare';
  archive.items[0].context = { ...emptyItemContext, fields: [{ name: 'Brand', value: 'Harbor' }] };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lists/' + list.id);
  const originalRanks = [...archive.list.rankedIds];
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await expect(dialog.getByLabel('Brand or maker', { exact: true })).toBeHidden();
  await dialog.getByLabel('Name', { exact: true }).fill('Daily lotion');
  await dialog.getByText('Add details', { exact: true }).click();
  await dialog.getByLabel('Type', { exact: true }).fill('Moisturizer');
  await dialog.getByLabel('Brand or maker', { exact: true }).fill('Harbor');
  await expect(dialog.locator('datalist option[value="Harbor"]')).toHaveCount(1);
  await dialog.getByLabel('Variant', { exact: true }).fill('Unscented');
  await dialog.getByLabel('Size', { exact: true }).fill('50 ml');
  await dialog.getByLabel('Price paid', { exact: true }).fill('0');
  await page.reload();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await expect(dialog.getByLabel('Brand or maker', { exact: true })).toHaveValue('Harbor');
  await expect(dialog.getByLabel('Price paid', { exact: true })).toHaveValue('0');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('currency');
  await dialog.getByLabel('Currency', { exact: true }).fill('usd');
  if (process.env.WORTH_ITEM_DETAILS_QA) {
    await mkdir(process.env.WORTH_ITEM_DETAILS_QA, { recursive: true });
    await dialog.getByLabel('Brand or maker', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: process.env.WORTH_ITEM_DETAILS_QA + '/add-' + info.project.name + '.png',
      animations: 'disabled',
    });
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = archive.items.find((entry) => entry.title === 'Daily lotion')!;
  expect(saved).toMatchObject({
    type: 'Moisturizer',
    decision: null,
    context: {
      version: 'Unscented',
      fields: [
        { name: 'Brand', value: 'Harbor' },
        { name: 'Size', value: '50 ml' },
      ],
      purchase: { price: 0, currency: 'USD' },
    },
  });
  expect(archive.list.rankedIds).toEqual(originalRanks);
  expect(archive.logs).toHaveLength(0);
  await page.locator('.collection-index-row button').filter({ hasText: 'Daily lotion' }).click();
  const slip = page.getByRole('region', { name: 'Your call for Daily lotion' }).filter({ visible: true });
  await expect(slip.getByText('$0.00', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (process.env.WORTH_ITEM_DETAILS_QA)
    await page.screenshot({
      path: process.env.WORTH_ITEM_DETAILS_QA + '/selected-' + info.project.name + '.png',
      animations: 'disabled',
    });
  await slip.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Daily lotion', exact: true });
  await expect(editor.getByLabel('Brand or maker', { exact: true })).toHaveValue('Harbor');
  await expect(editor.getByLabel('Size', { exact: true })).toHaveValue('50 ml');
  await page.goto('/lists/' + list.id + '?focus=item:' + saved.id);
  for (const width of info.project.name === 'desktop' ? [1440, 320, 430, 768] : [390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    await editor.getByLabel('Brand or maker', { exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    if (process.env.WORTH_ITEM_DETAILS_QA)
      await page.screenshot({
        path: process.env.WORTH_ITEM_DETAILS_QA + '/editor-' + info.project.name + '-' + width + '.png',
        animations: 'disabled',
      });
  }
  await editor.getByLabel('Price paid', { exact: true }).fill('');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByText('Saved.', { exact: true })).toBeVisible();
  expect(saved.context?.purchase.price).toBeNull();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await closeItemSheet(page);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('combobox', { name: 'Brand or maker', exact: true }).selectOption('Harbor');
  await expect(page.locator('.collection-index')).toContainText('Daily lotion');
  await expect(page.locator('.collection-index')).not.toContainText('Tea');
  await entryOptions(page);
  await page.getByText('Saved views', { exact: true }).click();
  await page.getByLabel('View name').fill('Harbor picks');
  await page.getByRole('button', { name: 'Save current view', exact: true }).click();
  await expect.poll(() => archive.workspace.workspace.views.length).toBe(1);
  expect(archive.workspace.workspace.views[0].filters.brand).toBe('Harbor');
});

test('place capture keeps location first and a name-only capture creates no experience or product requirements', async ({
  page,
  archive,
}) => {
  archive.list.name = 'Places';
  await page.goto('/lists/' + list.id);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('The corner cafe');
  await dialog.getByText('Add details', { exact: true }).click();
  await expect(dialog.getByLabel('Brand or maker', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Price paid', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Location', { exact: true }).fill('Brooklyn');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.items.find((entry) => entry.title === 'The corner cafe')).toMatchObject({
    context: { location: 'Brooklyn' },
    decision: null,
  });
  expect(archive.logs).toHaveLength(0);
});

test('brand insights disclose the sample and link to the exact supporting brand filter', async ({ page }) => {
  await page.route('**/api/preferences', (route) =>
    route.fulfill({
      json: {
        groups: [
          {
            listId: list.id,
            listName: 'Skincare',
            kind: 'brand',
            basis: 'records',
            name: 'Harbor',
            favorite: 1,
            meh: 1,
            notAgain: 0,
            unrated: 2,
          },
        ],
        returns: [],
        rediscover: [],
      },
    }),
  );
  await page.goto('/patterns?view=insights');
  const group = page.locator('.preference-grid article').filter({ hasText: 'Harbor' });
  await expect(group).toContainText('1 of 2');
  await expect(group).toContainText('2 without a call');
  await expect(group).toContainText('A small sample');
  await group.getByRole('link', { name: 'See supporting records' }).click();
  await expect(page).toHaveURL(/brand=Harbor/);
  await expect(page.getByLabel('Brand or maker', { exact: true })).toHaveValue('Harbor');
  await expect(page.getByText(/Supporting records for Harbor/)).toBeVisible();
});
