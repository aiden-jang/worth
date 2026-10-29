import { collectionOptions } from './navigation';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list } from './fixtures';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_ARCHIVING_QA) return;
  await mkdir(process.env.WORTH_ARCHIVING_QA, { recursive: true });
  await page.screenshot({
    path: `${process.env.WORTH_ARCHIVING_QA}/${name}-${project}.png`,
    fullPage: name !== 'settings',
  });
}

test('collections archive and unarchive without changing records or calls', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'List settings', exact: true }).click();
  const settings = page.getByRole('region', { name: 'Archive collection', exact: true });
  await settings.scrollIntoViewIfNeeded();
  await capture(page, 'settings', info.project.name);
  await settings.getByRole('button', { name: 'Archive collection', exact: true }).click();
  await expect(settings.getByRole('button', { name: 'Unarchive collection', exact: true })).toBeVisible();
  expect(archive.writes.at(-1)?.body).toEqual({ archived: true });
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Archived collection.' })).toBeVisible();
  await capture(page, 'collection', info.project.name);
  expect(archive.items.map((i) => i.decision)).toEqual(['favorite', null]);
  expect(archive.list.rankedIds).toEqual(['coffee']);
  await page.goto('/lists?kind=collection');
  await expect(page.locator('.collection-directory-card')).toHaveCount(0);
  await expect(page.locator('.starter-intro')).toHaveText('Start a collection, or open Archived.');
  await capture(page, 'current-empty', info.project.name);
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archived', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.collection-directory-card')).toHaveCount(1);
  await capture(page, 'directory', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.locator('.collection-directory-card').click();
  await page.getByRole('button', { name: 'Open settings to unarchive', exact: true }).click();
  await page.getByRole('button', { name: 'Unarchive collection', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Archived collection.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.goto('/lists?kind=collection');
  await expect(page.locator('.collection-directory-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No archived collections.', exact: true })).toBeVisible();
});

test('unsaved settings block archive and a failed archive keeps the current collection', async ({
  page,
  archive,
}) => {
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'List settings', exact: true }).click();
  const archiveButton = page.getByRole('button', { name: 'Archive collection', exact: true });
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Unfinished name');
  await expect(archiveButton).toBeDisabled();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  expect(archive.writes).toEqual([]);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'List settings', exact: true }).click();
  await page.route(`**/api/lists/${list.id}`, async (route) => {
    if (route.request().method() === 'PATCH')
      return route.fulfill({ status: 503, json: { message: 'Could not archive. Try again.' } });
    return route.fallback();
  });
  await archiveButton.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not archive.' })).toBeVisible();
  expect(archive.list.archived).toBeFalsy();
  await expect(archiveButton).toBeEnabled();
});

test('archived directory loading failures recover and long names fit narrow layouts', async ({
  page,
  archive,
}, info) => {
  archive.list.archived = true;
  archive.list.name = 'The long collection name I still want to read in full without losing a single word';
  let failed = true;
  await page.route('**/api/lists?archived=1', (route) =>
    failed ? route.fulfill({ status: 503, json: { message: 'Unavailable' } }) : route.fallback(),
  );
  await page.goto('/lists?kind=collection&archived=1');
  await expect(page.getByRole('alert')).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.collection-directory-card')).toHaveCount(1);
  const widths = info.project.name === 'desktop' ? [320, 430, 768, 1440] : [390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    await expect(page.locator('.collection-directory-copy strong')).toHaveText(archive.list.name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    const toggle = await page.getByRole('button', { name: 'Archived', exact: true }).boundingBox();
    expect(toggle?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Archived', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('search explicitly labels archived records and opens the retained collection', async ({
  page,
  archive,
}) => {
  archive.list.archived = true;
  await page.route('**/api/search?*', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: archive.items[0].id,
            listId: list.id,
            listName: list.name,
            kind: 'item',
            itemId: null,
            title: 'Coffee',
            detail: 'Drink',
            listArchived: true,
          },
        ],
      },
    }),
  );
  await page.goto('/search?q=Coffee');
  const result = page.getByRole('link').filter({ hasText: 'Coffee' });
  await expect(result).toContainText('ARCHIVED');
  await result.click();
  await expect(page.getByRole('status').filter({ hasText: 'Archived collection.' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Coffee', exact: true })).toBeVisible();
});
