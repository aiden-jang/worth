import { collectionOptions } from './navigation';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list } from './fixtures';
import { emptyItemContext } from '../src/shared/item-context';
import type { CollectionTemplate } from '../src/shared/templates';

const template: CollectionTemplate = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Coffee tasting',
  collectionName: 'Weekend coffee',
  description: 'Small cups, clear opinions.',
  artwork: { object: 'cup', tone: 'sage' },
  detailFields: ['Roaster', 'Origin'],
};
async function setup(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Collection setup', exact: true }).click();
  return page.getByRole('region', { name: 'Collection setup', exact: true });
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_TEMPLATE_QA) return;
  await mkdir(process.env.WORTH_TEMPLATE_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_TEMPLATE_QA}/${name}-${project}.png` });
}

test('reusable details save without changing records and template creation freezes only reviewed setup', async ({
  page,
  archive,
}, info) => {
  const original = structuredClone(archive.items);
  const region = await setup(page);
  await region.getByRole('textbox', { name: 'Reusable detail names', exact: true }).fill('Roaster\nOrigin');
  await region.getByRole('button', { name: 'Save detail names', exact: true }).click();
  await expect(region.getByText('Reusable detail names saved.', { exact: true })).toBeVisible();
  expect(archive.workspace.workspace.detailFields).toEqual(['Roaster', 'Origin']);
  expect(archive.items).toEqual(original);
  await region.getByRole('textbox', { name: 'Template name', exact: true }).fill('Coffee tasting');
  await region.getByRole('textbox', { name: 'Reusable detail names', exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'setup', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await region.locator('.template-preview').scrollIntoViewIfNeeded();
  await capture(page, 'save-template', info.project.name);
  await region.getByRole('button', { name: 'Save setup as template', exact: true }).click();
  await expect(region.getByText(/Template “Coffee tasting” saved/)).toBeVisible();
  expect(archive.templates).toHaveLength(1);
  expect(Object.keys(archive.templates[0]).sort()).toEqual([
    'artwork',
    'collectionName',
    'description',
    'detailFields',
    'id',
    'name',
  ]);
  expect(archive.templates[0].detailFields).toEqual(['Roaster', 'Origin']);
});

test('detail drafts recover, concurrent edits require a deliberate reload and duplicate names are rejected', async ({
  page,
  archive,
}) => {
  let region = await setup(page);
  await region
    .getByRole('textbox', { name: 'Reusable detail names', exact: true })
    .fill('My unfinished field');
  await expect(region.getByText('Draft saved on this device.', { exact: true })).toBeVisible();
  await page.reload();
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Collection setup', exact: true }).click();
  region = page.getByRole('region', { name: 'Collection setup', exact: true });
  await expect(region.getByRole('textbox', { name: 'Reusable detail names', exact: true })).toHaveValue(
    'My unfinished field',
  );
  archive.workspace = {
    workspace: { ...archive.workspace.workspace, detailFields: ['Saved elsewhere'] },
    revision: 1,
  };
  await region.getByRole('button', { name: 'Save detail names', exact: true }).click();
  await expect(region.getByText(/Your draft is still here/)).toBeVisible();
  await expect(region.getByRole('textbox', { name: 'Reusable detail names', exact: true })).toHaveValue(
    'My unfinished field',
  );
  await region.getByRole('button', { name: 'Reload saved detail names', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Replace this detail-name draft?', exact: true });
  await confirm.getByRole('button', { name: 'Reload detail names', exact: true }).click();
  await expect(region.getByRole('textbox', { name: 'Reusable detail names', exact: true })).toHaveValue(
    'Saved elsewhere',
  );
  await region
    .getByRole('textbox', { name: 'Reusable detail names', exact: true })
    .fill('Origin\n Ｏｒｉｇｉｎ ');
  await expect(region.getByRole('alert')).toContainText('Use each detail name once');
  await expect(region.getByRole('button', { name: 'Save detail names', exact: true })).toBeDisabled();
});

test('a lost template response retries the same payload across reload without another template', async ({
  page,
  archive,
}) => {
  let loseResponse = true;
  await page.route('**/api/templates', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const payload = route.request().postDataJSON();
    archive.writes.push({ path: '/templates', body: payload });
    if (!archive.templates.some((entry) => entry.id === payload.id)) archive.templates.push(payload);
    if (loseResponse) {
      loseResponse = false;
      return route.abort('failed');
    }
    return route.fulfill({ json: { template: payload } });
  });
  let region = await setup(page);
  await region.getByRole('textbox', { name: 'Template name', exact: true }).fill('No duplicate please');
  await region.getByRole('button', { name: 'Save setup as template', exact: true }).click();
  await expect(region.getByRole('alert')).toContainText('Couldn’t connect');
  await expect(region.getByRole('textbox', { name: 'Template name', exact: true })).toBeDisabled();
  await page.reload();
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Collection setup', exact: true }).click();
  region = page.getByRole('region', { name: 'Collection setup', exact: true });
  await region.getByRole('button', { name: 'Retry template save', exact: true }).click();
  await expect(region.getByText(/Template “No duplicate please” saved/)).toBeVisible();
  expect(archive.templates).toHaveLength(1);
  const writes = archive.writes.filter((entry) => entry.path === '/templates');
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toEqual(writes[1].body);
});

test('template application reviews replacement, creates an empty collection and supports removal', async ({
  page,
  archive,
}, info) => {
  archive.templates = [structuredClone(template)];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lists?kind=collection&create=1');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('My unfinished idea');
  await page.locator('.collection-templates > summary').click();
  await page.getByRole('combobox', { name: 'Saved template', exact: true }).selectOption(template.id);
  await page.locator('.template-preview').scrollIntoViewIfNeeded();
  await capture(page, 'template', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Use template', exact: true }).click();
  let confirm = page.getByRole('dialog', { name: 'Replace this collection draft?', exact: true });
  await confirm.locator('.confirm-actions').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('My unfinished idea');
  await page.getByRole('button', { name: 'Use template', exact: true }).click();
  confirm = page.getByRole('dialog', { name: 'Replace this collection draft?', exact: true });
  await confirm.getByRole('button', { name: 'Use template', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Weekend coffee');
  await page.getByRole('button', { name: 'Remove saved template', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Remove this template?', exact: true })
    .getByRole('button', { name: 'Remove template', exact: true })
    .click();
  await expect(page.getByText('No saved templates.', { exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Weekend coffee');
  await page.getByRole('button', { name: 'Create collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Weekend coffee', exact: true })).toBeVisible();
  const creation = archive.writes.find((entry) => entry.path === '/lists');
  expect(creation?.body).toMatchObject({
    name: 'Weekend coffee',
    description: template.description,
    artwork: template.artwork,
    detailFields: ['Roaster', 'Origin'],
  });
  expect(archive.items).toEqual([]);
  expect(archive.list.rankedIds).toEqual([]);
});

test('suggested details add blank fields explicitly and preserve matching existing names and values', async ({
  page,
  archive,
}, info) => {
  archive.workspace.workspace.detailFields = ['Roaster', 'Origin'];
  archive.items[0].context = {
    ...emptyItemContext,
    fields: [{ name: 'Ｒｏａｓｔｅｒ', value: 'Existing private value' }],
  };
  await page.goto(`/lists/${list.id}?focus=item:coffee`);
  await page.locator('.item-context > summary').click();
  await page.getByText('Custom details', { exact: true }).click();
  await page.getByText('Detail names from this collection', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Roaster', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add all missing details', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Detail name 2', exact: true })).toHaveValue('Origin');
  await expect(page.getByRole('textbox', { name: 'Detail value 1', exact: true })).toHaveValue(
    'Existing private value',
  );
  await expect(page.getByRole('textbox', { name: 'Detail value 2', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Detail name 2', exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'suggested', info.project.name);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(archive.items[0].context?.fields).toEqual([
    { name: 'Ｒｏａｓｔｅｒ', value: 'Existing private value' },
    { name: 'Origin', value: '' },
  ]);
});

test('templates and fields reflow at narrow widths and loading failures leave name-only creation available', async ({
  page,
  archive,
}) => {
  archive.templates = [structuredClone(template)];
  await page.route('**/api/templates', (route) =>
    route.fulfill({ status: 503, json: { message: 'Templates unavailable' } }),
  );
  await page.goto('/lists?kind=collection&create=1');
  await page.locator('.collection-templates > summary').click();
  await expect(page.getByRole('alert')).toContainText('Templates unavailable', { timeout: 15000 });
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Just a name');
  await expect(page.getByRole('button', { name: 'Create collection', exact: true })).toBeEnabled();
  await page.unroute('**/api/templates');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('combobox', { name: 'Saved template', exact: true }).selectOption(template.id);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('template-only backups are previewed and restored as private setup data', async ({
  page,
  archive,
}, info) => {
  const file = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    collectionTemplates: [template],
  };
  await page.route('**/api/import', async (route) => {
    archive.writes.push({ path: '/import', body: route.request().postDataJSON() });
    return route.fulfill({ json: { ids: [] }, status: 201 });
  });
  await page.goto('/settings');
  await page.locator('input[type=file]').setInputFiles({
    name: 'setups.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole('list', { name: 'Templates to restore', exact: true })).toContainText(
    'Coffee tasting',
  );
  await expect(page.getByRole('button', { name: 'Restore previewed data', exact: true })).toBeEnabled();
  await page.locator('.restore-preview').scrollIntoViewIfNeeded();
  await capture(page, 'restore', info.project.name);
  await page.getByRole('button', { name: 'Restore previewed data', exact: true }).click();
  await expect(
    page.getByText('0 lists and 1 template restored. Existing data was kept.', { exact: true }),
  ).toBeVisible();
  expect(archive.writes.find((entry) => entry.path === '/import')?.body).toMatchObject({
    lists: [],
    collectionTemplates: [template],
  });
});

test('suggested details respect remaining capacity and collection field drafts stay with their account', async ({
  page,
  archive,
}) => {
  archive.workspace.workspace.detailFields = ['Origin', 'Roaster'];
  archive.items[0].context = {
    ...emptyItemContext,
    fields: Array.from({ length: 11 }, (_, i) => ({ name: `Existing ${i}`, value: `${i}` })),
  };
  await page.goto(`/lists/${list.id}?focus=item:coffee`);
  await page.locator('.item-context > summary').click();
  await page.getByText('Custom details', { exact: true }).click();
  await page.getByText('Detail names from this collection', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add all missing details', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Add Origin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add Roaster', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Detail name 12', exact: true })).toHaveValue('Origin');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  let region = await setup(page);
  await region
    .getByRole('textbox', { name: 'Reusable detail names', exact: true })
    .fill('A private unfinished definition');
  await expect(region.getByText('Draft saved on this device.', { exact: true })).toBeVisible();
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: { user: { id: 'different-account', email: 'other@example.test', displayName: 'Other' } },
    }),
  );
  await page.reload();
  await collectionOptions(page);
  await page.getByRole('button', { name: 'Ranking & tools', exact: true }).click();
  await page.getByRole('button', { name: 'Collection setup', exact: true }).click();
  region = page.getByRole('region', { name: 'Collection setup', exact: true });
  await expect(region.getByRole('textbox', { name: 'Reusable detail names', exact: true })).toHaveValue(
    'Origin\nRoaster',
  );
});
