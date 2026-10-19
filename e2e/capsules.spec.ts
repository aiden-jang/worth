import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type State } from './fixtures';
import type { Page } from '@playwright/test';
import { sourceReviewHash, type SourcePreview, type SourceSelection } from '../src/shared/record-snapshots';
import type { CapsuleInput, CapsuleView } from '../src/shared/capsules';
async function setup(page: Page, state: State) {
  const id = '22222222-2222-4222-8222-222222222222';
  state.items[0].id = id;
  state.list.rankedIds = [id];
  state.items[0].decision = null;
  const saved = new Map<string, { input: CapsuleInput; view: CapsuleView }>();
  let lose = false,
    failCompare = false,
    stale = false;
  await page.route('**/api/items/*/photos', (r) =>
    r.fulfill({ json: { gallery: { entries: [], revision: 0, coverId: null } } }),
  );
  await page.route('**/api/capsules**', async (r) => {
    const req = r.request(),
      parts = new URL(req.url()).pathname.split('/'),
      key = parts[3],
      action = parts[4],
      method = req.method();
    const reply = (json: unknown, status = 200) => r.fulfill({ json, status });
    if (key === 'source-preview') {
      const selection = req.postDataJSON() as SourceSelection,
        item = state.items.find((i) => i.id === selection.id)!;
      const data: SourcePreview['data'] = { title: item.title };
      for (const field of selection.fields) {
        if (field === 'type') data.type = item.type;
        if (field === 'note') data.note = item.note;
        if (field === 'decision') data.decision = item.decision;
        if (field === 'rank') data.rank = state.list.rankedIds.includes(id) ? 1 : null;
        if (field === 'dates') data.dates = { startedOn: null, endedOn: null };
      }
      const preview = { selection, listName: state.list.name, data, photos: [], previewedAt: Date.now() };
      return reply({ preview: { ...preview, hash: await sourceReviewHash(preview) } });
    }
    if (!key && method === 'GET') return reply({ capsules: [...saved.values()].map((s) => s.view.summary) });
    if (!key && method === 'POST') {
      if (stale) {
        stale = false;
        return reply({ error: 'SOURCE_CHANGED', message: 'Source changed. Review it again.' }, 409);
      }
      const key = req.headers()['idempotency-key'],
        input = req.postDataJSON() as CapsuleInput;
      const previous = saved.get(key);
      if (previous) {
        expect(input).toEqual(previous.input);
        return reply(previous.view, 201);
      }
      const now = Date.now(),
        view: CapsuleView = {
          summary: {
            id: key,
            name: input.name,
            opening: input.opening,
            createdAt: now,
            openedAt: null,
            entryCount: input.sources.length,
            ready: input.opening.opensAt <= now,
          },
          serverNow: now,
          capsule: null,
          current: [],
        };
      saved.set(key, { input, view });
      state.writes.push({ path: '/capsules', body: { key, input } });
      if (lose) {
        lose = false;
        return r.abort('failed');
      }
      return reply(view, 201);
    }
    const row = saved.get(key);
    if (!row) return reply({ error: 'NOT_FOUND', message: 'Capsule not found.' }, 404);
    if (action === 'check') {
      expect(req.postDataJSON()).toEqual(row.input);
      return reply(row.view);
    }
    if (action === 'open') {
      if (!row.view.summary.ready) return reply({ message: 'This capsule is not ready.' }, 409);
      row.view.summary.openedAt ??= Date.now();
      row.view.capsule = {
        ...row.input,
        entries: row.input.sources.map((s) => ({
          id: s.id,
          kind: s.selection.kind,
          reference: { kind: s.selection.kind, id: s.selection.id },
          referenceMissing: false,
          listName: state.list.name,
          data: {
            title: 'Coffee',
            decision: null,
            rank: 1,
            ...(s.selection.fields.includes('note') ? { note: 'PRIVATE NOTE' } : {}),
          },
          photos: [],
        })),
        id: key,
        createdAt: row.view.summary.createdAt,
        openedAt: row.view.summary.openedAt,
      };
      return reply(row.view);
    }
    if (action === 'current') {
      if (failCompare) return reply({ message: 'Comparison unavailable.' }, 503);
      return reply({
        current: row.input.sources.map((s) => ({ entryId: s.id, available: false, photos: [] })),
      });
    }
    if (method === 'DELETE') {
      saved.delete(key);
      return r.fulfill({ status: 204 });
    }
    return reply(row.view);
  });
  return {
    lose: () => {
      lose = true;
    },
    stale: () => {
      stale = true;
    },
    failCompare: () => {
      failCompare = true;
    },
    saved,
  };
}
async function start(page: Page) {
  await page.goto('/capsules/new');
  await expect(page.getByRole('heading', { name: 'New capsule', exact: true })).toBeVisible();
  await page.getByLabel('Capsule name', { exact: true }).fill('A small time capsule');
  await page.getByLabel('Message optional').fill('For later, exactly as written.');
  await page.getByLabel('Opening date').fill('2020-01-01');
}
async function source(page: Page) {
  await page.getByText('Add an archive snapshot', { exact: false }).click();
  await page
    .getByRole('combobox', { name: 'Collection or activity', exact: true })
    .selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button', { name: 'Load records and visits' }).click();
  await page.getByRole('button', { name: /Review record Coffee/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Review this snapshot' });
  await expect(dialog.getByRole('button', { name: 'Keep reviewed snapshot' })).toBeEnabled();
  return dialog;
}
async function shot(page: Page, name: string) {
  await mkdir('art/ui-qa/capsules', { recursive: true });
  await page.screenshot({ path: `art/ui-qa/capsules/${name}.png`, fullPage: true });
}
test('capsule reviews keep calls independent, hide closed contents and compare only after opening', async ({
  page,
  archive: state,
}, info) => {
  await setup(page, state);
  await start(page);
  const dialog = await source(page);
  await expect(dialog.getByText('No call', { exact: true })).toBeVisible();
  await expect(dialog.getByText('#1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('PRIVATE NOTE', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Include private note').check();
  await expect(dialog.getByRole('button', { name: 'Keep reviewed snapshot' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Review chosen fields and photos' }).click();
  await expect(dialog.getByText('PRIVATE NOTE', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep reviewed snapshot' }).click();
  await shot(page, `compose-${info.project.name}`);
  await page.getByRole('button', { name: 'Seal capsule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your capsule is ready.' })).toBeVisible();
  await expect(page.getByText('PRIVATE NOTE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('For later, exactly as written.')).toHaveCount(0);
  await shot(page, `closed-${info.project.name}`);
  await page.getByRole('button', { name: 'Open capsule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'As it was.' })).toBeVisible();
  await expect(page.getByText('PRIVATE NOTE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Compare with current archive' }).click();
  await expect(page.getByText('The original record is unavailable.', { exact: false })).toBeVisible();
  await shot(page, `opened-${info.project.name}`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Remove capsule', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove capsule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Time capsules', exact: true })).toBeVisible();
  expect(state.items).toHaveLength(2);
});
test('capsule lost reply preserves exact retry across reload', async ({ page, archive: state }) => {
  const server = await setup(page, state);
  await start(page);
  server.lose();
  await page.getByRole('button', { name: 'Seal capsule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Save needs checking.' })).toBeVisible();
  await expect(page.getByLabel('Capsule name', { exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Check saved capsule' })).toBeVisible();
  await page.getByRole('button', { name: 'Check saved capsule' }).click();
  await expect(page.getByRole('heading', { name: 'Your capsule is ready.' })).toBeVisible();
  expect(state.writes.filter((w) => w.path === '/capsules')).toHaveLength(1);
});
test('capsule stale review stays editable and comparison failure preserves the opened message', async ({
  page,
  archive: state,
}) => {
  const server = await setup(page, state);
  await start(page);
  server.stale();
  await page.getByRole('button', { name: 'Seal capsule', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Source changed');
  await expect(page.getByLabel('Capsule name', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Seal capsule', exact: true }).click();
  await page.getByRole('button', { name: 'Open capsule', exact: true }).click();
  server.failCompare();
  await page.getByRole('button', { name: 'Compare with current archive' }).click();
  await expect(page.getByText('Comparison unavailable.', { exact: false })).toBeVisible();
  await expect(page.getByText('For later, exactly as written.')).toBeVisible();
});
test('capsule directory and compose reflow at narrow and tablet widths', async ({
  page,
  archive: state,
}, info) => {
  test.skip(info.project.name !== 'desktop');
  await setup(page, state);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/capsules');
    await expect(page.getByRole('heading', { name: 'Time capsules', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await shot(page, `directory-${width}`);
    await start(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await shot(page, `compose-${width}`);
    await page.getByRole('button', { name: 'Discard device draft' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Discard device draft' }).click();
  }
});

test('a future capsule stays closed and blocked draft storage remains visible', async ({
  page,
  archive: state,
}, info) => {
  await setup(page, state);
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'QuotaExceededError');
    };
  });
  await start(page);
  await page.getByLabel('Opening date').fill('2099-01-01');
  await expect(page.getByRole('status').filter({ hasText: 'could not be saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Seal capsule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kept for another day.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open capsule', exact: true })).toBeDisabled();
  await expect(page.getByText('For later, exactly as written.')).toHaveCount(0);
  await shot(page, `waiting-${info.project.name}`);
  await page.getByRole('link', { name: 'Back to Capsules →' }).click();
  await expect(page.getByRole('heading', { name: 'Time capsules', exact: true })).toBeVisible();
  await shot(page, `directory-${info.project.name}`);
});
