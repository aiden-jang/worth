import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, list, test } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';
import { editItem } from './navigation';

test('item editing separates calls from ranking and keeps saving visible', async ({
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
  await page.goto('/lists/' + list.id);
  await editItem(page, 'Light Citrus Wheat');
  const editor = page.getByRole('dialog', { name: 'Light Citrus Wheat', exact: true });
  const call = editor.getByRole('region', { name: 'Your call for Light Citrus Wheat' });
  const save = editor.getByRole('button', { name: 'Save changes', exact: true });
  await expect(call.locator('.opinion-slip-title')).toHaveCount(0);
  await expect(call.getByText('UNRANKED', { exact: true })).toHaveCount(0);
  await expect(call.getByRole('button', { name: 'Not again', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(editor.getByText('Saved.', { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  for (const width of info.project.name === 'desktop' ? [1440, 768, 430, 390, 320] : [390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    await editor.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(save).toBeInViewport();
    await expect(page.getByRole('dialog', { name: 'Saved item: Light Citrus Wheat' })).toHaveCount(0);
    const card = await call.boundingBox();
    expect(card!.height).toBeLessThanOrEqual(280);
    expect(await editor.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    if (process.env.WORTH_EDITOR_QA) {
      await mkdir(process.env.WORTH_EDITOR_QA, { recursive: true });
      await page.screenshot({
        path: `${process.env.WORTH_EDITOR_QA}/editor-${info.project.name}-${width}.png`,
        animations: 'disabled',
      });
    }
  }
  await call.getByRole('button', { name: 'Not again', exact: true }).click();
  await expect(call.getByText('Undecided.', { exact: true })).toBeVisible();
  await call.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(call.getByRole('button', { name: 'Favorite', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await call.getByRole('button', { name: 'Meh', exact: true }).click();
  await editor.getByLabel('Price paid', { exact: true }).fill('0');
  await editor.getByLabel('Currency', { exact: true }).fill('USD');
  await expect(editor.getByText('Unsaved changes.', { exact: true })).toBeVisible();
  expect(archive.items[0].decision).toBe('would_not_again');
  await expect(save).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await save.click();
  await expect(editor.getByText('Saved.', { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  expect(archive.items[0]).toMatchObject({
    decision: 'meh',
    context: { fields: [{ name: 'Brand', value: 'Blue Moon' }], purchase: { price: 0, currency: 'USD' } },
  });
  expect(archive.list.rankedIds).toEqual([]);
  const name = editor.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('Light Citrus Wheat revisit');
  await name.press('Enter');
  await expect(
    page
      .getByRole('dialog', { name: 'Light Citrus Wheat revisit', exact: true })
      .getByText('Saved.', { exact: true }),
  ).toBeVisible();
  expect(archive.items[0].title).toBe('Light Citrus Wheat revisit');
});
