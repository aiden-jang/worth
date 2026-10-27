import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import type { OfflineOperation, OfflineSnapshot } from '../src/shared/offline';
test.use({ serviceWorkers: 'allow' });
const password = 'My separate offline phrase',
  listId = '11111111-1111-4111-8111-111111111111',
  itemId = '22222222-2222-4222-8222-222222222222';
function server() {
  return {
    owner: 'preview',
    epoch: '33333333-3333-4333-8333-333333333333',
    note: 'Snapshot note',
    updatedAt: 1,
    requests: [] as OfflineOperation[],
    confirmed: new Map<string, unknown>(),
    lose: false,
  };
}
async function setup(page: Page, s: ReturnType<typeof server>) {
  await page.route('**/api/me', (r) =>
    r.fulfill({
      json: {
        user: { id: s.owner, email: `${s.owner}@example.test`, displayName: s.owner, emailVerified: true },
      },
    }),
  );
  await page.route('**/api/offline/**', async (r) => {
    const req = r.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith('/snapshot')) {
      const snapshot: OfflineSnapshot = {
        owner: s.owner,
        epoch: s.epoch,
        savedAt: Date.now(),
        lists: [{ id: listId, name: 'My drinks', kind: 'collection' }],
        records: [
          {
            id: itemId,
            kind: 'item',
            listId,
            title: 'Offline coffee',
            note: s.note,
            updatedAt: s.updatedAt,
            date: null,
            decision: null,
            rank: 1,
          },
        ],
      };
      return r.fulfill({ json: snapshot });
    }
    const op = req.postDataJSON() as OfflineOperation;
    s.requests.push(op);
    if (req.headers()['x-worth-account'] !== s.owner)
      return r.fulfill({
        status: 409,
        json: { error: 'ACCOUNT_CHANGED', message: 'Another account is signed in.' },
      });
    if (op.epoch !== s.epoch)
      return r.fulfill({
        status: 409,
        json: {
          error: 'OFFLINE_RESET',
          message: 'Worth data was reset after this device copy. Pending saves were kept.',
        },
      });
    let result = s.confirmed.get(op.id);
    if (!result) {
      if (op.kind === 'note' && (op.expectedNote !== s.note || op.expectedUpdatedAt !== s.updatedAt))
        return r.fulfill({
          status: 409,
          json: {
            error: 'OFFLINE_CONFLICT',
            message: 'This record changed. Your queued note is kept. Compare before making a new edit.',
          },
        });
      s.updatedAt++;
      if (op.kind === 'note') s.note = op.note;
      result = {
        record: {
          id: op.kind === 'capture' ? op.id : op.recordId,
          updatedAt: s.updatedAt,
          note: op.note,
          ...(op.kind === 'capture'
            ? { title: op.title, kind: 'inbox', listId: null, date: null, decision: null, rank: null }
            : {}),
        },
      };
      s.confirmed.set(op.id, result);
    }
    if (s.lose) {
      s.lose = false;
      return r.abort('failed');
    }
    return r.fulfill({ json: result });
  });
}
async function create(page: Page) {
  await page.goto('/offline/?account=preview');
  await expect(page.getByRole('heading', { name: 'Prepare a device copy', exact: true })).toBeVisible();
  await page.getByLabel('Offline passphrase', { exact: true }).fill(password);
  await page.getByLabel('Repeat offline passphrase', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Save offline copy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved text archive', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}
async function unlock(page: Page, phrase = password) {
  await page.getByLabel('Offline passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Unlock copy', exact: true }).click();
}
async function queue(page: Page, title: string) {
  await page.getByRole('textbox', { name: 'Find name', exact: true }).fill(title);
  await page.getByRole('button', { name: 'Queue Inbox capture', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Capture queued');
}
async function disk(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('worth-offline-vaults', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result,
            get = db.transaction('vaults', 'readonly').objectStore('vaults').getAll();
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
          get.onerror = () => reject(get.error);
        };
      }),
  );
}
async function shot(page: Page, name: string) {
  if (!process.env.WORTH_CAPTURE_UI) return;
  const directory = `${process.env.WORTH_CAPTURE_UI}/offline`;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}
test('encrypted text survives a real offline reload and exact lost replies sync once', async ({
  page,
}, info) => {
  const s = server();
  await setup(page, s);
  await create(page);
  await expect(page.getByRole('heading', { name: 'Saved text archive', exact: true })).toBeVisible();
  await page.locator('.offline-record').getByText('Offline coffee', { exact: true }).click();
  await expect(page.getByText('Snapshot note', { exact: true })).toBeVisible();
  await shot(page, `online-${info.project.name}`);
  await page.context().setOffline(true);
  await queue(page, 'PRIVATE PENDING PICNIC');
  expect(s.requests).toHaveLength(0);
  const saved = JSON.stringify(await disk(page));
  expect(saved).not.toContain('PRIVATE PENDING PICNIC');
  expect(saved).not.toContain('Snapshot note');
  expect(saved).not.toContain(password);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Unlock device copy', exact: true })).toBeVisible();
  await unlock(page);
  await expect(page.getByRole('region', { name: 'Pending saves' })).toContainText('PRIVATE PENDING PICNIC');
  await expect(page.getByRole('button', { name: 'Sync pending saves', exact: true })).toBeDisabled();
  await shot(page, `disconnected-${info.project.name}`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.context().setOffline(false);
  s.lose = true;
  await page.getByRole('button', { name: 'Sync pending saves', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pending saves' })).toContainText('PRIVATE PENDING PICNIC');
  await page.reload();
  await unlock(page);
  await page.getByRole('button', { name: 'Sync pending saves', exact: true }).click();
  await expect(page.getByText('No pending saves.', { exact: true })).toBeVisible();
  expect(s.requests).toHaveLength(2);
  expect(s.requests[0]).toEqual(s.requests[1]);
  expect(s.confirmed.size).toBe(1);
  const keys = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
    return urls;
  });
  expect(keys.length).toBeGreaterThan(3);
  expect(
    keys.every((p) => p.startsWith('/assets/') || ['/offline/', '/offline/index.html'].includes(p)),
  ).toBe(true);
  expect(keys.some((p) => p.startsWith('/api/'))).toBe(false);
});
test('wrong passphrases and damaged ciphertext keep the device copy intact', async ({ page }, info) => {
  const s = server();
  await setup(page, s);
  await create(page);
  await page.getByRole('button', { name: 'Lock copy', exact: true }).click();
  await unlock(page, 'A different wrong phrase');
  await expect(page.getByRole('alert')).toContainText('saved encrypted copy is kept');
  expect(await disk(page)).toHaveLength(1);
  await unlock(page);
  await expect(page.getByRole('heading', { name: 'Saved text archive', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lock copy', exact: true }).click();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('worth-offline-vaults', 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction('vaults', 'readwrite'),
            store = tx.objectStore('vaults'),
            get = store.get('preview');
          get.onsuccess = () => {
            const value = get.result;
            value.cipher = (value.cipher[0] === 'A' ? 'B' : 'A') + value.cipher.slice(1);
            store.put(value);
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  const before = JSON.stringify(await disk(page));
  await unlock(page);
  await expect(page.getByRole('alert')).toContainText('saved encrypted copy is kept');
  expect(JSON.stringify(await disk(page))).toBe(before);
  await shot(page, `locked-error-${info.project.name}`);
});
test('queued note conflicts, account changes and data resets preserve the exact queue', async ({ page }) => {
  const s = server();
  await setup(page, s);
  await create(page);
  await page.locator('.offline-record').getByText('Offline coffee', { exact: true }).click();
  await page.getByRole('button', { name: 'Edit note offline', exact: true }).click();
  await page.getByRole('textbox', { name: 'Offline note text', exact: true }).fill('My pending offline note');
  await page.getByRole('button', { name: 'Queue note edit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Note edit queued');
  s.owner = 'other';
  await page.getByRole('button', { name: 'Sync pending saves', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Another account is signed in');
  expect(s.requests).toHaveLength(0);
  s.owner = 'preview';
  s.note = 'A newer connected note';
  s.updatedAt++;
  await page.getByRole('button', { name: 'Sync pending saves', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This record changed');
  await page.locator('.offline-pending-row').getByText('Note edit · Offline coffee', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Queued text', exact: true })).toHaveValue(
    'My pending offline note',
  );
  const request = s.requests[0];
  s.epoch = crypto.randomUUID();
  await page.getByRole('button', { name: 'Sync pending saves', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Worth data was reset');
  expect(s.requests[1]).toEqual(request);
  await page.getByRole('button', { name: 'Discard pending save', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard pending save', exact: true }).click();
  await expect(page.getByText('No pending saves.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh offline copy', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Offline copy refreshed');
});
test('cross-tab changes never overwrite another queue and reopening reads the latest device copy', async ({
  page,
}) => {
  const s = server();
  await setup(page, s);
  await create(page);
  const other = await page.context().newPage();
  await setup(other, s);
  await other.goto('/offline/?account=preview');
  await unlock(other);
  await expect(other.getByRole('heading', { name: 'Saved text archive', exact: true })).toBeVisible();
  await queue(other, 'Other tab find');
  await page.getByRole('textbox', { name: 'Find name', exact: true }).fill('This tab unsaved text');
  await page.getByRole('button', { name: 'Queue Inbox capture', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed in another tab');
  await expect(page.getByRole('textbox', { name: 'Find name', exact: true })).toHaveValue(
    'This tab unsaved text',
  );
  await page.getByRole('button', { name: 'Lock copy', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lock copy', exact: true }).click();
  await unlock(page);
  await expect(page.getByRole('region', { name: 'Pending saves' })).toContainText('Other tab find');
  await other.close();
});
test('storage failures retain typed text, prior ciphertext and usable narrow layouts', async ({
  page,
}, info) => {
  const s = server();
  await setup(page, s);
  await create(page);
  const before = JSON.stringify(await disk(page));
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Device full', 'QuotaExceededError');
    };
  });
  await page.getByRole('textbox', { name: 'Find name', exact: true }).fill('Keep this unfinished capture');
  await page.getByRole('button', { name: 'Queue Inbox capture', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save the encrypted device copy');
  await expect(page.getByRole('textbox', { name: 'Find name', exact: true })).toHaveValue(
    'Keep this unfinished capture',
  );
  expect(JSON.stringify(await disk(page))).toBe(before);
  if (info.project.name === 'desktop')
    for (const width of [320, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await shot(page, `storage-error-${width}`);
    }
});

test('refresh repairs an evicted static shell before claiming it is prepared', async ({ page }) => {
  const s = server();
  await setup(page, s);
  await create(page);
  await page.evaluate(async () => {
    for (const name of await caches.keys())
      if (name.startsWith('worth-offline-shell-')) await caches.delete(name);
  });
  await page.getByRole('button', { name: 'Refresh offline copy', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Offline copy refreshed');
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Unlock device copy', exact: true })).toBeVisible();
  await unlock(page);
  await expect(page.getByRole('heading', { name: 'Saved text archive', exact: true })).toBeVisible();
});

test('removing a locked device copy requires its actual signed-in account', async ({ page }) => {
  const s = server();
  await setup(page, s);
  await create(page);
  await page.getByRole('button', { name: 'Lock copy', exact: true }).click();
  s.owner = 'other';
  await page.getByRole('button', { name: 'Remove device copy', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove device copy', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Another account is signed in');
  expect(await disk(page)).toHaveLength(1);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .filter({ hasText: 'Cancel' })
    .click();
  s.owner = 'preview';
  await page.getByRole('button', { name: 'Remove device copy', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove device copy', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Device copy removed');
  expect(await disk(page)).toEqual([]);
});
