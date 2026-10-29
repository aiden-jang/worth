import { entryOptions } from './navigation';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';

test('Want to try capture and filtering leave opinions and rankings alone', async ({ page, archive }) => {
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('checkbox', { name: 'Want to try', exact: true }).check();
  await page.getByRole('textbox', { name: 'Add a name' }).fill('Next café');
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved on this device.' })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await entryOptions(page);
  await expect(page.getByRole('checkbox', { name: 'Want to try', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Add a name' })).toHaveValue('Next café');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Next café added' })).toBeVisible();
  expect(archive.items.at(-1)).toMatchObject({ wantToTry: true, decision: null });
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await page.getByRole('combobox', { name: 'Browse collection' }).selectOption('want');
  await expect(page.getByRole('button', { name: /Next café Want to try/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Coffee Drink', exact: true })).toHaveCount(0);
});

test('merge previews, retries and separation preserve original private notes', async ({
  page,
  archive,
}, info) => {
  archive.items[1].note = 'Original tea note';
  archive.failAction = true;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('button', { name: 'Select items', exact: true }).click();
  await page.getByRole('button', { name: 'Select visible', exact: true }).click();
  await page.getByRole('button', { name: 'Merge', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Merge items' });
  await expect(dialog.getByText(/Original notes, dates, calls, photos and visits/)).toBeVisible();
  await dialog.getByLabel('Main entry').selectOption('coffee');
  await dialog.getByRole('button', { name: 'Merge items', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save');
  archive.failAction = false;
  await dialog.getByRole('button', { name: 'Merge items', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tea Drink', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
  await page
    .getByRole('region', { name: 'Your call for Coffee' })
    .filter({ visible: true })
    .getByRole('button', { name: 'Edit' })
    .click();
  const originals = page.getByRole('region', { name: 'Merged originals' });
  await expect(originals.getByText('Original tea note')).toBeVisible();
  await originals.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`merged-${info.project.name}.png`), fullPage: false });
  await originals.getByRole('button', { name: 'Separate Tea' }).click();
  await expect(originals).toHaveCount(0);
  expect(archive.items[1]).toMatchObject({ note: 'Original tea note', mergedIntoId: null });
});

test('bulk move requires a destination and keeps the other collection ranking intact', async ({
  page,
  archive,
}) => {
  archive.extraLists = [
    {
      ...list,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Other drinks',
      rankedIds: [],
      itemCount: 0,
    },
  ];
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('button', { name: 'Select items', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Tea' }).check();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Move items' });
  await expect(dialog.getByRole('button', { name: 'Move items', exact: true })).toBeDisabled();
  await dialog.getByLabel('Destination').selectOption(archive.extraLists[0].id);
  await dialog.getByRole('button', { name: 'Move items', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tea Drink', exact: true })).toHaveCount(0);
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await page.goto(`/lists/${archive.extraLists[0].id}`);
  await expect(page.getByRole('button', { name: 'Tea Drink', exact: true })).toBeVisible();
});

test('bulk Trash has immediate Undo and recovery from Settings', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('button', { name: 'Select items', exact: true }).click();
  await page.getByRole('button', { name: 'Select visible', exact: true }).click();
  await page.screenshot({ path: info.outputPath(`selection-${info.project.name}.png`), fullPage: true });
  await page
    .getByRole('region', { name: 'Selected items' })
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Move to Trash' });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nothing to judge. Yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tea Drink', exact: true })).toBeVisible();
  await entryOptions(page);
  await page.getByRole('button', { name: 'Select items', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Tea' }).check();
  await page
    .getByRole('region', { name: 'Selected items' })
    .getByRole('button', { name: 'Move to Trash', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await page.getByRole('link', { name: 'Open Trash', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Trash.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore Tea' })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`trash-${info.project.name}.png`), fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Restore Tea' }).click();
  await expect(page.getByText('Trash is empty.', { exact: true })).toBeVisible();
});
