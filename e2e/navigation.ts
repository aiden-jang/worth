import type { Page } from '@playwright/test';

export async function closeItemSheet(page: Page) {
  const close = page.getByRole('button', { name: 'Close item', exact: true });
  if (await close.isVisible()) await close.click();
}

export async function collectionOptions(page: Page) {
  await closeItemSheet(page);
  const summary = page.getByLabel('Collection options', { exact: true });
  if (!(await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open)))
    await summary.click();
}

export async function entryOptions(page: Page) {
  await closeItemSheet(page);
  const summary = page.getByLabel('Entry options', { exact: true });
  if (!(await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open)))
    await summary.click();
}

export async function activityTools(
  page: Page,
  section: 'Routines' | 'Progress & exercise history' | 'Search past activity',
) {
  const summary = page.locator('.activity-secondary > summary').filter({ hasText: section });
  if (!(await summary.evaluate((node) => (node.parentElement as HTMLDetailsElement).open)))
    await summary.click();
}
