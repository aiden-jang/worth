import { collectionOptions, entryOptions } from './navigation';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';

test('a stale sandbox refreshes the current ranking and never overwrites it', async ({ page, archive }) => {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByText('Add unranked items to the draft', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Tea', exact: true }).click();
  archive.list.rankedIds = ['tea'];
  archive.list.rankRevision++;
  await page.getByRole('button', { name: 'Preview ranking change', exact: true }).click();
  await page.getByRole('button', { name: 'Apply ranking', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Apply this ranking?' }).getByRole('alert')).toContainText(
    'changed elsewhere',
  );
  expect(archive.list.rankedIds).toEqual(['tea']);
  await page
    .getByRole('dialog', { name: 'Apply this ranking?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: 'Reset to saved ranking', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Draft order' })).toContainText('Tea');
  await expect(page.getByRole('list', { name: 'Draft order' })).not.toContainText('Coffee');
  expect(archive.writes.filter((write) => write.path.endsWith('/rank'))).toHaveLength(1);
});

test('saved views and context orders survive reload without changing the main ranking', async ({
  page,
  archive,
}) => {
  archive.items[0].id = '22222222-2222-4222-8222-222222222222';
  archive.items[1].id = '33333333-3333-4333-8333-333333333333';
  archive.items[1].wantToTry = true;
  archive.list.rankedIds = [archive.items[0].id];
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('combobox', { name: 'Browse collection' }).selectOption('want');
  await page.getByText('Saved views', { exact: true }).click();
  await page.getByRole('textbox', { name: 'View name', exact: true }).fill('Next weekend');
  await page.getByRole('button', { name: 'Save current view', exact: true }).click();
  await expect(page.getByText('View saved.', { exact: true })).toBeVisible();
  await page.reload();
  await entryOptions(page);
  await page.getByText('Saved views · 1', { exact: true }).click();
  await page.getByRole('button', { name: 'Next weekend', exact: true }).click();
  await expect(page.locator('.collection-index')).toContainText('Tea');
  await expect(page.locator('.collection-index')).not.toContainText('Coffee');
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByText('Context rankings', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Context name', exact: true }).fill('Best value');
  await page.getByRole('button', { name: 'Save this draft as context ranking', exact: true }).click();
  await expect(page.getByText('Context ranking saved.', { exact: true })).toBeVisible();
  expect(archive.list.rankedIds).toEqual([archive.items[0].id]);
  expect(archive.workspace.workspace.rankings[0].name).toBe('Best value');
  expect(archive.workspace.workspace.views[0].filters.browse).toBe('want');
  await page.getByRole('button', { name: 'Best value · 1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Load this context ranking?' })).toBeVisible();
  await page.getByRole('button', { name: 'Load into sandbox', exact: true }).click();
  expect(archive.list.rankedIds).toEqual([archive.items[0].id]);
  expect(archive.writes.filter((write) => write.path.endsWith('/rank'))).toHaveLength(0);
});

test('sandbox rankings recover, preview before applying, and preserve calls', async ({ page, archive }) => {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByText('Add unranked items to the draft', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Tea', exact: true }).click();
  await page.getByRole('button', { name: 'Move Tea up', exact: true }).click();
  await page.getByRole('dialog').evaluate((node) => {
    node.scrollTop = 0;
  });
  if (process.env.WORTH_CAPTURE_QA)
    await page.screenshot({
      path: `${process.env.WORTH_CAPTURE_QA}/sandbox-${test.info().project.name}.png`,
    });
  expect(archive.writes).toEqual([]);
  await page.getByRole('button', { name: 'Close workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Keep draft and close', exact: true }).click();
  await page.reload();
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Draft order' }).getByRole('listitem').first()).toContainText(
    'Tea',
  );
  await page.getByRole('button', { name: 'Preview ranking change', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Apply this ranking?' })).toContainText(
    'Proposed: Tea → Coffee',
  );
  await page.getByRole('button', { name: 'Apply ranking', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ranking applied');
  expect(archive.list.rankedIds).toEqual(['tea', 'coffee']);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.writes.filter((write) => write.path.endsWith('/rank'))).toHaveLength(1);
});

test('blind comparisons hide saved order, support undo, and need an explicit reveal', async ({
  page,
  archive,
}) => {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Start head-to-head', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Draft order' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Preview ranking change', exact: true })).toBeHidden();
  const choices = page.locator('.comparison-choice');
  await expect(choices).toHaveCount(2);
  await expect(choices.first()).not.toContainText('Saved rank');
  await choices.first().click();
  await page.getByRole('button', { name: 'Undo comparison', exact: true }).click();
  await expect(choices).toHaveCount(2);
  await page.getByRole('button', { name: 'Skip this item', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use this order in sandbox', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Reveal comparison with saved order', exact: true }).click();
  await expect(page.getByText(/Previously/)).toBeVisible();
  expect(archive.writes).toEqual([]);
});

test('comparison notes stay private and the decision draw only uses eligible records', async ({
  page,
  archive,
}) => {
  archive.items[1].wantToTry = true;
  archive.items[0].context = {
    ...emptyItemContext,
    sourceUrl: 'https://example.test/source',
    whySaved: 'Quiet mornings',
    stamps: ['worth the detour'],
  };
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Comparison table', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Coffee', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Tea', exact: true }).check();
  await expect(page.locator('.workbench-cards')).toContainText('PRIVATE NOTE');
  await expect(page.getByRole('dialog').locator('.workbench-record')).toHaveCount(2);
  await page.getByText('Saved context', { exact: true }).click();
  if (process.env.WORTH_CAPTURE_QA)
    await page.screenshot({
      path: `${process.env.WORTH_CAPTURE_QA}/comparison-${test.info().project.name}.png`,
    });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Decision draw', exact: true }).click();
  await page.getByRole('button', { name: 'Draw a record', exact: true }).click();
  await expect(page.locator('.workbench-draw-result')).toContainText('Tea');
  await expect(page.locator('.workbench-draw-result article')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Open record', exact: true }).focus();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  if (test.info().project.name === 'phone')
    await page.locator('.workbench-draw-result').scrollIntoViewIfNeeded();
  if (process.env.WORTH_CAPTURE_QA)
    await page.screenshot({ path: `${process.env.WORTH_CAPTURE_QA}/draw-${test.info().project.name}.png` });
  await expect(page.locator('.workbench-draw-result')).not.toContainText('Coffee');
  await page.getByRole('combobox', { name: 'Choose from', exact: true }).selectOption('favorite');
  await page.getByRole('button', { name: 'Draw a record', exact: true }).click();
  await expect(page.locator('.workbench-draw-result')).toContainText('Coffee');
  expect(archive.writes).toEqual([]);
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.getByRole('dialog').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(
      true,
    );
  }
});

test('collection artwork offers the new objects without inserting records', async ({ page, archive }) => {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'List settings', exact: true }).click();
  for (const label of ['Ramen', 'Sneaker', 'Plant', 'Camera']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await page.getByRole('button', { name: 'Clay', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Camera', exact: true }).locator('img')).toHaveAttribute(
    'src',
    '/art/collection-choices/camera-clay.svg',
  );
  await page
    .getByRole('button', { name: 'Camera', exact: true })
    .locator('img')
    .evaluate((node) => (node as HTMLImageElement).decode());
  if (process.env.WORTH_CAPTURE_QA)
    await page.screenshot({
      path: `${process.env.WORTH_CAPTURE_QA}/artwork-${test.info().project.name}.png`,
    });
  expect(archive.items).toHaveLength(2);
  expect(archive.writes).toEqual([]);
});
