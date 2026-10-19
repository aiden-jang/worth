import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';

async function details(page: import('@playwright/test').Page) {
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
  await page
    .getByRole('region', { name: 'Your call for Coffee' })
    .filter({ visible: true })
    .getByRole('button', { name: 'Details', exact: true })
    .click();
  await page.locator('.item-context > summary').click();
}

test('private context saves, filters by personal labels and downloads an explicit return reminder', async ({
  page,
  archive,
}) => {
  await details(page);
  await page.getByRole('textbox', { name: 'Why I saved this', exact: true }).fill('For rainy Sundays');
  await page.getByRole('textbox', { name: 'Recommended by', exact: true }).fill('Mina');
  await page.getByRole('textbox', { name: 'After trying it', exact: true }).fill('Tell Mina about it');
  await page.getByRole('textbox', { name: 'Source link', exact: true }).fill('https://example.test/find');
  await page.getByRole('textbox', { name: 'Version or edition', exact: true }).fill('Second edition');
  if (process.env.WORTH_CONTEXT_QA) {
    await page.getByRole('textbox', { name: 'Why I saved this', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${process.env.WORTH_CONTEXT_QA}/recommendation-${test.info().project.name}.png`,
    });
  }
  await page.getByText('Labels and stamps', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Personal labels', exact: true }).fill('comfort watch');
  await page.getByRole('textbox', { name: 'Personal stamps', exact: true }).fill('worth the detour');
  await page.getByText('Purchase and ownership', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Price paid', exact: true }).fill('0');
  await page.getByRole('textbox', { name: 'Currency', exact: true }).fill('usd');
  await page.getByText('Borrowed or lent', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Loan direction', exact: true }).selectOption('lent');
  await page.getByRole('textbox', { name: 'Person', exact: true }).fill('Sam');
  await page.getByLabel('Return by', { exact: true }).fill('2026-11-01');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download calendar reminder', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('worth-return-reminder.ics');
  const calendar = await readFile((await download.path())!, 'utf8');
  expect(calendar).toContain('Collect: Coffee');
  expect(calendar).toContain('20261101');
  expect(calendar).not.toContain('Sam');
  expect(calendar).not.toContain('Mina');
  if (process.env.WORTH_CONTEXT_QA)
    await page.screenshot({
      path: `${process.env.WORTH_CONTEXT_QA}/context-${test.info().project.name}.png`,
    });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  expect(archive.items[0].context).toMatchObject({
    whySaved: 'For rainy Sundays',
    recommendedBy: 'Mina',
    labels: ['comfort watch'],
    purchase: { price: 0, currency: 'USD' },
    loan: { direction: 'lent', person: 'Sam' },
  });
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('combobox', { name: 'Personal label', exact: true }).selectOption('comfort watch');
  await expect(page.locator('.collection-index')).toContainText('Coffee');
  await expect(page.locator('.collection-index')).not.toContainText('Tea');
});

test('unfinished source, price and custom details survive draft reload', async ({ page }) => {
  await details(page);
  await page.getByRole('textbox', { name: 'Source link', exact: true }).fill('https:');
  await page.getByText('Custom details', { exact: true }).click();
  await page.getByRole('button', { name: 'Add a custom detail', exact: true }).click();
  await page.getByRole('textbox', { name: 'Detail value 1', exact: true }).fill('Still writing');
  await page.getByText('Purchase and ownership', { exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Price paid', exact: true }).fill('12');
  await page.reload();
  await details(page);
  await expect(page.getByRole('textbox', { name: 'Source link', exact: true })).toHaveValue('https:');
  await page.getByText('Custom details', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Detail value 1', exact: true })).toHaveValue(
    'Still writing',
  );
  await page.getByText('Purchase and ownership', { exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Price paid', exact: true })).toHaveValue('12');
});

test('context conflicts preserve the draft and reload only context after confirmation', async ({
  page,
  archive,
}) => {
  archive.items[0].context = structuredClone(emptyItemContext);
  archive.items[0].contextRevision = 0;
  await details(page);
  await page.getByRole('textbox', { name: 'Why I saved this', exact: true }).fill('My local draft');
  await page.getByRole('textbox', { name: /Private note/ }).fill('Keep my note edit');
  archive.items[0].context = { ...emptyItemContext, whySaved: 'Saved elsewhere' };
  archive.items[0].contextRevision = 1;
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' }).first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Why I saved this', exact: true })).toHaveValue(
    'My local draft',
  );
  await page.getByRole('button', { name: 'Reload saved context', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Replace this context draft?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Reload saved context', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Why I saved this', exact: true })).toHaveValue(
    'Saved elsewhere',
  );
  await expect(page.getByRole('textbox', { name: /Private note/ })).toHaveValue('Keep my note edit');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  expect(archive.items[0].context.whySaved).toBe('Saved elsewhere');
  expect(archive.items[0].note).toBe('Keep my note edit');
});
