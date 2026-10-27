import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import type { ConnectionInput, ConnectionView, ConnectedRecord } from '../src/shared/connections';
const a = '22222222-2222-4222-8222-222222222222',
  b = '33333333-3333-4333-8333-333333333333';
async function model(page: Page, state: State) {
  state.items[0].id = a;
  state.items[1].id = b;
  state.list.rankedIds = [a];
  const connections: ConnectionView[] = [],
    writes: { method: string; body: unknown; key: string | null }[] = [];
  let lost = false,
    conflict = false,
    failRead = false;
  const node = (id: string): ConnectedRecord => ({
    id,
    title: state.items.find((i) => i.id === id)!.title,
    listId: list.id,
    listName: list.name,
    currentId: id,
    merged: false,
    archived: false,
  });
  await page.route('**/api/connections**', (route) => {
    const request = route.request(),
      method = request.method(),
      id = new URL(request.url()).pathname.split('/')[3];
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (method === 'GET') {
      if (failRead) return reply({ error: 'DOWN', message: 'Connections unavailable.' }, 503);
      const found = connections.find((c) => c.id === id);
      return id
        ? found
          ? reply({ connection: found })
          : reply({ error: 'NOT_FOUND', message: 'Connection not found' }, 404)
        : reply({ connections });
    }
    const body = request.postDataJSON();
    writes.push({ method, body, key: request.headers()['idempotency-key'] ?? null });
    if (method === 'POST') {
      const input = body as ConnectionInput,
        key = request.headers()['idempotency-key'];
      const previous = connections.find((c) => c.id === key);
      if (previous) return reply({ connection: previous }, 201);
      const connection: ConnectionView = {
        ...input,
        id: key,
        revision: 0,
        createdAt: list.updatedAt,
        from: node(input.fromId),
        to: node(input.toId),
      };
      connections.unshift(connection);
      if (lost) {
        lost = false;
        return reply({ error: 'LOST', message: 'Could not read the saved reply.' }, 503);
      }
      return reply({ connection }, 201);
    }
    const connection = connections.find((c) => c.id === id)!;
    if (method === 'PUT') {
      if (conflict) {
        conflict = false;
        connection.reason = 'Saved elsewhere';
        connection.revision++;
        return reply(
          {
            error: 'CONNECTION_CHANGED',
            message: 'Connection changed. Keep your draft and reload saved details.',
          },
          409,
        );
      }
      expect(body.expectedRevision).toBe(connection.revision);
      connection.reason = body.reason;
      connection.revision++;
      return reply({ connection });
    }
    expect(body.expectedRevision).toBe(connection.revision);
    connections.splice(connections.indexOf(connection), 1);
    return route.fulfill({ status: 204 });
  });
  return {
    connections,
    writes,
    node,
    lose() {
      lost = true;
    },
    conflict() {
      conflict = true;
    },
    fail() {
      failRead = true;
    },
    recover() {
      failRead = false;
    },
  };
}
async function choose(page: Page, kind = 'related') {
  await page.getByRole('combobox', { name: 'First collection', exact: true }).selectOption(list.id);
  await page.getByRole('combobox', { name: 'Second collection', exact: true }).selectOption(list.id);
  await page.getByRole('combobox', { name: 'First record', exact: true }).selectOption(a);
  await page.getByRole('combobox', { name: 'Second record', exact: true }).selectOption(b);
  await page.getByRole('combobox', { name: 'Relationship', exact: true }).selectOption(kind);
}
async function capture(page: Page, name: string, project: string, target = '.connections-page') {
  if (!process.env.WORTH_CONNECTIONS_QA) return;
  await mkdir(process.env.WORTH_CONNECTIONS_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.locator(target).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_CONNECTIONS_QA}/${name}-${project}.png` });
}

test('reviewed connections preserve records and their constellation has a readable keyboard alternative', async ({
  page,
  archive,
}, info) => {
  const data = await model(page, archive);
  await page.goto('/patterns');
  await capture(page, 'patterns-entry', info.project.name, '.patterns-head');
  await page.locator('.pattern-more-tools > summary').click();
  await page.getByRole('link', { name: 'Connections →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connections', exact: true })).toBeVisible();
  await capture(page, 'overview', info.project.name);
  await choose(page, 'replaces');
  await expect(page.getByRole('button', { name: 'Save connection', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Connection reason', exact: true }).fill('Quieter, so I switched.');
  await capture(page, 'review', info.project.name, '.connection-create');
  await capture(page, 'save', info.project.name, '.connection-create textarea');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByText('Connection saved.', { exact: true })).toBeVisible();
  expect(data.connections[0]).toMatchObject({
    kind: 'replaces',
    fromId: a,
    toId: b,
    reason: 'Quieter, so I switched.',
  });
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual([a]);
  await page.getByRole('combobox', { name: 'Center on a record' }).selectOption(a);
  await expect(page.locator('.connection-constellation')).toContainText('1 of 1 neighbors shown');
  await expect(
    page.locator('.connection-constellation').getByRole('link', { name: 'Tea', exact: true }),
  ).toHaveAttribute('href', `/lists/${list.id}?focus=item:${b}`);
  await capture(page, 'constellation', info.project.name, '.connections-saved');
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('a lost connection reply retains an exact owner-bound retry across reload', async ({
  page,
  archive,
}) => {
  const data = await model(page, archive);
  data.lose();
  await page.goto('/patterns/connections');
  await choose(page, 'edition');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not read the saved reply.');
  await expect(page.getByRole('button', { name: 'Retry exact save' })).toBeEnabled();
  await page.reload();
  await expect(
    page.getByText('The exact request is kept for retry. A lost reply may mean it was saved already.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry exact save' }).click();
  await expect(page.getByText('Connection saved.', { exact: true })).toBeVisible();
  expect(data.connections).toHaveLength(1);
  expect(data.writes).toHaveLength(2);
  expect(data.writes[0]).toEqual(data.writes[1]);
});

test('connection reasons recover conflicts deliberately and removal leaves the records intact', async ({
  page,
  archive,
}, info) => {
  const data = await model(page, archive);
  data.connections.push({
    id: '44444444-4444-4444-8444-444444444444',
    fromId: a,
    toId: b,
    kind: 'place',
    reason: 'Different counters',
    revision: 0,
    createdAt: list.updatedAt,
    from: data.node(a),
    to: data.node(b),
  });
  await page.goto('/patterns/connections');
  await page.getByRole('button', { name: 'Edit reason', exact: true }).click();
  await page.getByRole('textbox', { name: 'Saved connection reason' }).fill('Changed here');
  data.conflict();
  await page.getByRole('button', { name: 'Save reason', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Connection changed');
  await page.getByRole('button', { name: 'Reload saved reason' }).click();
  await expect(page.getByText('Saved reason: Saved elsewhere')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Saved connection reason' })).toHaveValue('Changed here');
  await capture(page, 'conflict', info.project.name, '.connection-reason-dialog');
  await capture(page, 'conflict-details', info.project.name, '.connection-reason-dialog .connection-attempt');
  await page.getByRole('button', { name: 'Keep draft with this revision' }).click();
  await page.getByRole('button', { name: 'Save reason', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Why they connect' })).toBeHidden();
  expect(data.connections[0].reason).toBe('Changed here');
  await page.getByRole('button', { name: 'Remove connection', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Remove this connection?' })
    .getByRole('button', { name: 'Remove connection', exact: true })
    .click();
  await expect(
    page.getByText('No saved connections yet. Choose two records above to keep the first link.'),
  ).toBeVisible();
  expect(archive.items).toHaveLength(2);
});

test('failed reads retry, offline drafts remain manual and blocked storage requires a leave choice', async ({
  page,
  archive,
}, info) => {
  const data = await model(page, archive);
  data.fail();
  await page.goto('/patterns/connections');
  await expect(page.getByRole('alert').filter({ hasText: 'Connections unavailable.' })).toBeVisible();
  data.recover();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByText('No saved connections yet. Choose two records above to keep the first link.'),
  ).toBeVisible();
  await capture(page, 'empty', info.project.name, '.connections-saved');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Blocked');
    };
  });
  await choose(page);
  await page.getByRole('textbox', { name: 'Connection reason', exact: true }).fill('Keep for copying');
  await expect(page.getByText('Draft could not be saved on this device. Keep this page open.')).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByRole('button', { name: 'Save connection', exact: true })).toBeDisabled();
  await page.context().setOffline(false);
  await page.getByRole('link', { name: 'Back to Patterns' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave this connection draft?' })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Leave this connection draft?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .last()
    .click();
  await expect(page.getByRole('textbox', { name: 'Connection reason', exact: true })).toHaveValue(
    'Keep for copying',
  );
  expect(data.writes).toEqual([]);
});

test('a larger constellation keeps legible nodes, complete lists and bounded pagination', async ({
  page,
  archive,
}, info) => {
  const data = await model(page, archive);
  for (let index = 0; index < 26; index++) {
    const id = `55555555-5555-4555-8555-${String(index).padStart(12, '0')}`;
    const record = {
      ...archive.items[1],
      id,
      title: `A long edition ${index + 1} ` + 'with details '.repeat(6),
    };
    archive.items.push(record);
    data.connections.push({
      id: `66666666-6666-4666-8666-${String(index).padStart(12, '0')}`,
      fromId: a,
      toId: id,
      kind: 'edition',
      reason: 'Kept separately',
      revision: 0,
      createdAt: list.updatedAt + index,
      from: data.node(a),
      to: data.node(id),
    });
  }
  await page.goto('/patterns/connections');
  await page.getByRole('combobox', { name: 'Center on a record' }).selectOption(a);
  await expect(page.locator('.connection-constellation')).toContainText('12 of 26 neighbors shown');
  await expect(page.locator('.connection-map-node')).toHaveCount(12);
  await expect(page.locator('.connection-list > li')).toHaveCount(25);
  await page.getByRole('button', { name: 'Show more connections' }).click();
  await expect(page.locator('.connection-list > li')).toHaveCount(26);
  await capture(page, 'many-neighbors', info.project.name, '.connection-constellation');
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations).toEqual([]);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
