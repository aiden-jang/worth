import { test, expect, list, item } from './fixtures';
import { experienceInput } from '../src/shared/memories';
import { itemInput } from '../src/shared/validation';
import type { Item, Log } from '../src/shared/models';

test('product details require an explicit switch before clearing and survive a lost dated-experience reply', async ({
  page,
  archive,
}) => {
  archive.list.name = 'Skincare';
  const activityId = '22222222-2222-4222-8222-222222222222';
  archive.extraLists.push({ ...list, id: activityId, name: 'Gym', kind: 'activity' });
  const requests: unknown[] = [];
  let receipt: { item: Item; log: Log } | null = null;
  await page.route('**/api/lists/*/experiences', async (route) => {
    const body = experienceInput.parse(route.request().postDataJSON());
    requests.push({ body, key: route.request().headers()['idempotency-key'] });
    if (receipt) return route.fulfill({ json: receipt, status: 201 });
    const created: Item = {
      ...item,
      ...itemInput.parse({ title: body.title, type: body.type, context: body.itemContext }),
      id: crypto.randomUUID(),
      logCount: 1,
    };
    const log: Log = {
      id: crypto.randomUUID(),
      listId: list.id,
      itemId: created.id,
      title: body.title,
      happenedOn: body.happenedOn,
      context: body.context,
      note: body.note,
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    archive.items.push(created);
    archive.logs.push(log);
    receipt = { item: created, log };
    return route.abort('failed');
  });
  await page.goto('/lists/' + list.id);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Sample lotion');
  await dialog.getByText('Add details', { exact: true }).click();
  await dialog.getByLabel('Type', { exact: true }).fill('Moisturizer');
  await dialog.getByLabel('Brand or maker', { exact: true }).fill('Harbor');
  await dialog.getByRole('combobox', { name: 'Save in', exact: true }).selectOption(activityId);
  const confirmation = page.getByRole('dialog', { name: 'Leave these item details behind?' });
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(dialog.getByRole('combobox', { name: 'Save in', exact: true })).toHaveValue(list.id);
  await expect(dialog.getByLabel('Brand or maker', { exact: true })).toHaveValue('Harbor');
  await dialog.getByLabel('Record a dated experience', { exact: true }).check();
  await dialog.getByLabel('When', { exact: true }).fill('2026-10-31');
  await dialog.getByRole('button', { name: 'Favorite', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await expect(dialog.getByLabel('Brand or maker', { exact: true })).toHaveValue('Harbor');
  await expect(dialog.getByLabel('Brand or maker', { exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(archive.items.filter((entry) => entry.title === 'Sample lotion')).toHaveLength(1);
  expect(archive.items.find((entry) => entry.title === 'Sample lotion')).toMatchObject({
    type: 'Moisturizer',
    decision: null,
    context: { fields: [{ name: 'Brand', value: 'Harbor' }] },
  });
  expect(archive.logs).toHaveLength(1);
  expect(archive.logs[0].context?.reaction).toBe('favorite');
});
