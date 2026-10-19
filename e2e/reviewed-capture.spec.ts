import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list, item, type State } from './fixtures';
import type { Page } from '@playwright/test';
import type { Item } from '../src/shared/models';

type Attempt = { key: string; body: { items: unknown[] }; frozen: unknown };
async function importer(page: Page, archive: State, failAfterSave = false) {
  const receipts = new Map<string, Item[]>();
  const attempts: Attempt[] = [];
  await page.route(`**/api/lists/${list.id}/items/import`, async (route) => {
    const body = route.request().postDataJSON();
    const key = route.request().headers()['idempotency-key'];
    const frozen = await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem(`worth:draft:v1:browser-preview:reviewed-capture:${id}`) || 'null')
          ?.form.frozen,
      list.id,
    );
    attempts.push({ key, body, frozen });
    archive.writes.push({ path: `/lists/${list.id}/items/import`, body });
    let saved = receipts.get(key);
    if (!saved) {
      saved = body.items.map((input: Partial<Item>, index: number) => ({
        ...item,
        ...input,
        id: `imported-${archive.items.length + index}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        decision: input.decision ?? null,
      }));
      receipts.set(key, saved!);
      archive.items.push(...saved!);
    }
    if (failAfterSave && attempts.length === 1)
      return route.fulfill({
        status: 503,
        json: { message: 'The response was interrupted. Retry this same request.' },
      });
    return route.fulfill({ status: 201, json: { items: saved } });
  });
  return attempts;
}
async function open(page: Page) {
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Import & capture', exact: true }).click();
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_REVIEWED_CAPTURE_QA) return;
  await mkdir(process.env.WORTH_REVIEWED_CAPTURE_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_REVIEWED_CAPTURE_QA}/${name}-${project}.png` });
}

test('CSV mapping previews exact fields and only imports explicitly selected duplicates', async ({
  page,
  archive,
}, info) => {
  const attempts = await importer(page, archive);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const csv =
    'Name,Type,Note,Call,Source,Secret\nCoffee,Drink,,,,SECRET_UNMAPPED\nRamen,Food,"Warm\nStill good.",Meh,https://example.test/ramen,SECRET_UNMAPPED\nRamen,Food,,Favorite,,SECRET_UNMAPPED\nUnsafe,Food,,,javascript:alert(1),SECRET_UNMAPPED\nBook,Book,,Not again,,SECRET_UNMAPPED';
  await page
    .getByLabel('Choose a CSV file', { exact: true })
    .setInputFiles({ name: 'finds.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByRole('combobox', { name: 'Note column', exact: true })).toHaveValue('2');
  await page.locator('.capture-mapping').scrollIntoViewIfNeeded();
  await capture(page, 'mapping', info.project.name);
  await page.getByRole('checkbox', { name: 'Save to Want to try', exact: true }).check();
  await page.getByRole('button', { name: 'Preview records', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Keep row 2: Coffee', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Keep row 4: Ramen', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Row 5', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Records to save', exact: true })).not.toContainText(
    'context.sourceUrl',
  );
  await expect(page.getByRole('button', { name: 'Save 2 records', exact: true })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Keep row 2: Coffee', exact: true }).check();
  await page.locator('.capture-record-preview summary').first().click();
  await expect(page.getByText('Warm\nStill good.', { exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Records to save', exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'review', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  expect(archive.writes).toEqual([]);
  await page.getByRole('button', { name: 'Save 3 records', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '3 records saved to My drinks.' })).toBeVisible();
  expect(attempts).toHaveLength(1);
  expect(JSON.stringify(attempts[0].body)).not.toContain('SECRET_UNMAPPED');
  expect(attempts[0].body.items).toMatchObject([
    { title: 'Coffee', decision: null, wantToTry: true },
    { title: 'Ramen', decision: 'meh', note: 'Warm\nStill good.' },
    { title: 'Book', decision: 'would_not_again' },
  ]);
  expect(attempts[0].frozen).toEqual(attempts[0].body.items);
  expect(archive.items).toHaveLength(5);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual(['coffee']);
});

test('an interrupted import recovers its frozen request and retry identity after closing', async ({
  page,
  archive,
}, info) => {
  const attempts = await importer(page, archive, true);
  await open(page);
  await page.getByRole('textbox', { name: 'Or paste CSV', exact: true }).fill('Name\nA small find');
  await page.getByRole('button', { name: 'Preview records', exact: true }).click();
  await page.getByRole('button', { name: 'Save 1 record', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('response was interrupted');
  await expect(page.getByRole('button', { name: 'Edit input', exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeInViewport();
  await capture(page, 'retry', info.project.name);
  await page.getByRole('button', { name: 'Close workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Workbench', exact: true }).click();
  await page.getByRole('button', { name: 'Import & capture', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Keep row 1: A small find', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry saving these records', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 record saved to My drinks.' })).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1].key).toBe(attempts[0].key);
  expect(attempts[1].body).toEqual(attempts[0].body);
  expect(archive.items).toHaveLength(3);
});

test('link capture uses a reviewed address suggestion and retains the source without fetching it', async ({
  page,
  archive,
}, info) => {
  const attempts = await importer(page, archive);
  const external: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith('https://example.test/')) external.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.getByRole('radio', { name: 'A link', exact: true }).check();
  await page.getByRole('textbox', { name: 'Source URL', exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Suggest a name from the address', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('http or https');
  const url = 'https://example.test/a-good-book.html?private=keep#section';
  await page.getByRole('textbox', { name: 'Source URL', exact: true }).fill(url);
  await page.getByRole('button', { name: 'Suggest a name from the address', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('a good book');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('My chosen name');
  await page.getByRole('textbox', { name: 'Type', exact: true }).fill('Book');
  await capture(page, 'link', info.project.name);
  await page.getByRole('button', { name: 'Preview records', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Records to save', exact: true })).toContainText(url);
  expect(archive.writes).toEqual([]);
  await page.getByRole('button', { name: 'Save 1 record', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 record saved to My drinks.' })).toBeVisible();
  expect(attempts[0].body.items).toMatchObject([
    { title: 'My chosen name', type: 'Book', decision: null, context: { sourceUrl: url } },
  ]);
  expect(external).toEqual([]);
});

test('long source links and names fit narrow capture and review layouts', async ({ page }, info) => {
  await open(page);
  await page.getByRole('radio', { name: 'A link', exact: true }).check();
  await page
    .getByRole('textbox', { name: 'Source URL', exact: true })
    .fill('https://example.test/' + 'x'.repeat(900));
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('x'.repeat(120));
  const widths = info.project.name === 'desktop' ? [320, 430, 768, 1440] : [390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    expect(
      await page.getByRole('dialog').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(
      await page
        .getByRole('region', { name: 'Reviewed capture', exact: true })
        .evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
  }
  await page.getByRole('button', { name: 'Preview records', exact: true }).click();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    expect(
      await page.getByRole('dialog').evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
    expect(
      await page
        .getByRole('region', { name: 'Records to save', exact: true })
        .evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1);
  }
});
