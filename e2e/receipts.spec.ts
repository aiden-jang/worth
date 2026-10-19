import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import { receiptInput, receiptLineSuggestions, type ReceiptView } from '../src/shared/receipts';
import { itemInput } from '../src/shared/validation';
const first = '22222222-2222-4222-8222-222222222222',
  second = '33333333-3333-4333-8333-333333333333';
async function setup(page: Page, state: State) {
  state.items[0].id = first;
  state.items[1].id = second;
  state.list.rankedIds = [first];
  const rows = new Map<string, ReceiptView>(),
    hashes = new Map<string, string>(),
    images = new Map<string, Buffer>(),
    removed = new Set<string>();
  const uploads: Buffer[] = [];
  let lost = false,
    broken = false,
    missing = false;
  const sources = (receipt: ReceiptView) =>
    missing
      ? []
      : receipt.lines.flatMap((line) => {
          const mapping = line.mapping;
          const source =
            mapping.mode === 'none' ? undefined : state.items.find((item) => item.id === mapping.itemId);
          return source
            ? [
                {
                  id: source.id,
                  title: source.title,
                  listId: source.listId,
                  listName: list.name,
                  archived: false,
                },
              ]
            : [];
        });
  await page.route('**/api/receipts**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      id = path.split('/')[3],
      method = req.method(),
      reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (method === 'GET') {
      if (path.endsWith('/attachment'))
        return !broken && images.has(id)
          ? route.fulfill({ contentType: rows.get(id)!.attachment!.contentType, body: images.get(id)! })
          : reply({ message: 'Attachment unavailable.' }, 404);
      if (!id)
        return reply({
          receipts: [...rows.values()].map((receipt) => ({ ...receipt, lineCount: receipt.lines.length })),
        });
      const receipt = rows.get(id);
      return receipt
        ? reply({ receipt: { ...receipt, sources: sources(receipt) } })
        : reply({ message: 'Receipt not found.' }, 404);
    }
    if (method === 'DELETE') {
      if (!rows.has(id) && !removed.has(id)) return reply({ message: 'Receipt not found.' }, 404);
      rows.delete(id);
      images.delete(id);
      removed.add(id);
      state.writes.push({ path: '/receipts/remove', body: id });
      return route.fulfill({ status: 204 });
    }
    const buffer = req.postDataBuffer()!,
      form = await new Request('https://worth.test/receipt', {
        method: 'POST',
        headers: { 'Content-Type': req.headers()['content-type'] },
        body: new Uint8Array(buffer),
      }).formData(),
      input = receiptInput.parse(JSON.parse(form.get('receipt') as string)),
      file = form.get('attachment'),
      key = req.headers()['idempotency-key'];
    if (file instanceof File) uploads.push(Buffer.from(await file.arrayBuffer()));
    if (removed.has(key))
      return reply({ message: 'This receipt was removed.', error: 'RECEIPT_REMOVED' }, 410);
    const before = rows.get(key);
    if (before) {
      if (hashes.get(key) !== JSON.stringify(input))
        return reply({ message: 'This retry differs from the saved receipt.' }, 409);
      return reply({ receipt: { ...before, sources: sources(before) } }, 201);
    }
    if (missing && input.lines.some((line) => line.mapping.mode !== 'none'))
      return reply(
        {
          message:
            'A chosen record or collection changed. Your reviewed receipt is kept; check sources before another review.',
        },
        409,
      );
    const receipt: ReceiptView = { ...input, id: key, createdAt: 1, sources: [] };
    rows.set(key, receipt);
    hashes.set(key, JSON.stringify(input));
    if (file instanceof File) images.set(key, Buffer.from(await file.arrayBuffer()));
    for (const line of input.lines)
      if (line.mapping.mode === 'create') {
        state.items.push({
          ...state.items[0],
          ...itemInput.parse({ title: line.mapping.title }),
          id: line.mapping.itemId,
          listId: line.mapping.listId,
          hasPhoto: false,
          createdAt: 1,
          updatedAt: 1,
          logCount: 0,
          lastLoggedOn: null,
        });
        state.list.itemCount++;
      }
    state.writes.push({ path: '/receipts/save', body: { key, input } });
    if (lost) {
      lost = false;
      return route.abort('failed');
    }
    return reply({ receipt: { ...receipt, sources: sources(receipt) } }, 201);
  });
  return {
    rows,
    uploads,
    setLost: () => (lost = true),
    setBroken: (v: boolean) => (broken = v),
    setMissing: (v: boolean) => (missing = v),
    seed: () => {
      const id = crypto.randomUUID();
      rows.set(id, {
        id,
        createdAt: 1,
        name: 'A small receipt',
        merchant: 'The corner shop',
        day: '2026-10-01',
        text: 'COFFEE 4.00',
        note: 'A note kept with the copy.',
        lines: receiptLineSuggestions('Coffee 4.00').map((line) => ({
          ...line,
          mapping: { mode: 'existing' as const, itemId: first },
        })),
        attachment: null,
        sources: [],
      });
      return id;
    },
  };
}
async function capture(page: Page, name: string, project: string, target?: string) {
  if (!process.env.WORTH_RECEIPTS_QA) return;
  if (name === 'entry')
    await expect(page.getByRole('heading', { name: 'Keep a receipt.', exact: true })).toBeVisible();
  await mkdir(process.env.WORTH_RECEIPTS_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (target)
    await page
      .locator(target)
      .first()
      .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_RECEIPTS_QA}/${name}-${project}.png` });
}
async function sample(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1000, 600);
    ctx.fillStyle = '#181915';
    ctx.font = '48px Arial';
    ctx.fillText('COFFEE 4.00', 60, 130);
    ctx.fillText('BOOK 18.00', 60, 240);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Choose receipt photo', { exact: true }).setInputFiles({
    name: 'example-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Read receipt on this device', exact: true })).toBeEnabled();
}
async function draft(page: Page, name = 'My reviewed receipt') {
  await page.goto('/receipts/new');
  await page.getByRole('textbox', { name: 'Receipt name', exact: true }).fill(name);
  await page
    .getByRole('textbox', { name: 'Read or pasted receipt text', exact: true })
    .fill('Coffee 4.00\nBook 18.00');
  await page.getByRole('button', { name: 'Make line suggestions from this text', exact: true }).click();
}
async function attach(page: Page) {
  await sample(page);
  await page.getByRole('button', { name: 'Prepare exact attachment copy', exact: true }).click();
  const image = page.getByRole('img', { name: 'Exact receipt attachment copy', exact: true });
  await expect(image).toBeVisible();
  await image.evaluate((img: HTMLImageElement) => img.decode());
  await page
    .getByRole('checkbox', { name: 'Include this exact copy with the saved receipt', exact: true })
    .check();
  await page.getByRole('checkbox', { name: 'I checked that this copy is readable', exact: true }).check();
  return preparedBytes(page);
}

async function preparedBytes(page: Page) {
  let bytes: number[] | null = null;
  await expect
    .poll(async () => {
      bytes = await page.evaluate(async () => {
        const file = await new Promise<File | undefined>((resolve, reject) => {
          const request = indexedDB.open('worth-draft-photos', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction('files', 'readonly');
            const result = tx.objectStore('files').get('browser-preview:receipt-prepared');
            tx.oncomplete = () => {
              db.close();
              resolve(result.result?.file);
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
        return file ? Array.from(new Uint8Array(await file.arrayBuffer())) : null;
      });
      return bytes?.length ?? 0;
    })
    .toBeGreaterThan(0);
  return Buffer.from(bytes ?? []);
}

async function pixels(page: Page, name: string) {
  return page.getByRole('img', { name, exact: true }).evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    try {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
      );
      return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  });
}

test('reviewed receipt lines link or create only by choice, with on-device reading and exact attachment bytes', async ({
  page,
  archive,
}, info) => {
  if (info.project.name === 'desktop') test.setTimeout(90000);
  const fixture = await setup(page, archive),
    external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (['https:', 'http:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:34320')
      external.push(url.href);
  });
  await page.goto('/receipts/new');
  await capture(page, 'entry', info.project.name);
  await page.getByRole('textbox', { name: 'Receipt name', exact: true }).fill('The useful bits');
  await sample(page);
  if (info.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Read receipt on this device', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Read or pasted receipt text', exact: true })).toHaveValue(
      /COFFEE/,
      { timeout: 60000 },
    );
  }
  // A reading is only a suggestion; the reviewed lines stay deliberate on both viewports.
  await page
    .getByRole('textbox', { name: 'Read or pasted receipt text', exact: true })
    .fill('Coffee 4.00\nBook 18.00');
  await page.getByRole('button', { name: 'Make line suggestions from this text', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Record choice for line 1', exact: true })).toHaveValue(
    'none',
  );
  await expect(
    page.getByRole('textbox', { name: 'Amount as written for line 1 · optional', exact: true }),
  ).toHaveValue('');
  await page
    .getByRole('combobox', { name: 'Record choice for line 1', exact: true })
    .selectOption('existing');
  await page.getByRole('combobox', { name: 'Collection for line 1', exact: true }).selectOption(list.id);
  await page.getByRole('combobox', { name: 'Existing record for line 1', exact: true }).selectOption(first);
  await page
    .getByRole('textbox', { name: 'Amount as written for line 1 · optional', exact: true })
    .fill('$4.00 as entered');
  await page.getByRole('combobox', { name: 'Record choice for line 2', exact: true }).selectOption('create');
  await page.getByRole('combobox', { name: 'Collection for line 2', exact: true }).selectOption(list.id);
  await page
    .getByRole('textbox', { name: 'New record name for line 2', exact: true })
    .fill('My entered book');
  await capture(page, 'lines', info.project.name, '.receipt-lines');
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Prepare exact attachment copy', exact: true }).click();
  const image = page.getByRole('img', { name: 'Exact receipt attachment copy', exact: true });
  await expect(image).toBeVisible();
  await image.evaluate((img: HTMLImageElement) => img.decode());
  await page
    .getByRole('checkbox', { name: 'Include this exact copy with the saved receipt', exact: true })
    .check();
  await page.getByRole('button', { name: 'Save reviewed receipt', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('confirm it is readable');
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('checkbox', { name: 'I checked that this copy is readable', exact: true }).check();
  const bytes = await preparedBytes(page),
    previewPixels = await pixels(page, 'Exact receipt attachment copy');
  await capture(page, 'attachment-review', info.project.name, '.receipt-copy-preview');
  await page.getByRole('button', { name: 'Save reviewed receipt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The useful bits', exact: true, level: 1 })).toBeVisible();
  expect(fixture.uploads[0].equals(bytes)).toBe(true);
  expect(await pixels(page, 'Reviewed attachment for The useful bits')).toBe(previewPixels);
  expect(archive.writes).toHaveLength(1);
  expect(archive.items.at(-1)).toMatchObject({
    title: 'My entered book',
    note: '',
    decision: null,
    hasPhoto: false,
  });
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.list.rankedIds).toEqual([first]);
  expect(external).toEqual([]);
  await capture(page, 'saved', info.project.name, '.receipt-saved-lines');
  archive.items.at(-1)!.title = 'Renamed after this review';
  await page.reload();
  await expect(
    page.getByText('Created record name in this review: My entered book', { exact: true }),
  ).toBeVisible();
  await capture(page, 'renamed-source', info.project.name, '.receipt-saved-lines');
  await page.getByRole('link', { name: 'Back to Receipts →', exact: true }).click();
  await expect(page.getByRole('link', { name: /The useful bits/ })).toBeVisible();
  await capture(page, 'directory', info.project.name);
});

test('a lost receipt reply recovers the exact attachment and frozen choice without duplicating new records', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  await draft(page, 'Pending receipt');
  await page.getByRole('combobox', { name: 'Record choice for line 1', exact: true }).selectOption('create');
  await page.getByRole('combobox', { name: 'Collection for line 1', exact: true }).selectOption(list.id);
  await page.getByRole('textbox', { name: 'New record name for line 1', exact: true }).fill('Created once');
  const bytes = await attach(page);
  fixture.setLost();
  await page.getByRole('button', { name: 'Save reviewed receipt', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t connect');
  await expect(page.getByRole('textbox', { name: 'Receipt name', exact: true })).toBeDisabled();
  await capture(page, 'pending', info.project.name, '.receipt-save');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Receipt name', exact: true })).toHaveValue(
    'Pending receipt',
  );
  await expect(page.getByRole('img', { name: 'Exact receipt attachment copy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry exact receipt save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pending receipt', exact: true, level: 1 })).toBeVisible();
  expect(fixture.rows.size).toBe(1);
  expect(archive.items.filter((item) => item.title === 'Created once')).toHaveLength(1);
  expect(fixture.uploads).toHaveLength(2);
  expect(fixture.uploads.every((upload) => upload.equals(bytes))).toBe(true);
  expect(archive.writes).toHaveLength(1);
});

test('an uncertain receipt can check its saved address instead of resending', async ({ page, archive }) => {
  const fixture = await setup(page, archive);
  await draft(page, 'Checked receipt');
  fixture.setLost();
  await page.getByRole('button', { name: 'Save reviewed receipt', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t connect');
  await page.getByRole('button', { name: 'Check saved receipt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checked receipt', exact: true, level: 1 })).toBeVisible();
  expect(fixture.rows.size).toBe(1);
  expect(archive.writes).toHaveLength(1);
});

test('missing linked records retain reviewed lines and removal leaves originals untouched', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive),
    id = fixture.seed();
  fixture.setMissing(true);
  await page.goto(`/receipts/${id}`);
  await expect(page.getByRole('list', { name: 'Reviewed receipt lines', exact: true })).toContainText(
    'Coffee 4.00',
  );
  await expect(page.getByText('Linked record unavailable.', { exact: false })).toBeVisible();
  await capture(page, 'missing-source', info.project.name, '.receipt-saved-lines');
  await page.getByRole('button', { name: 'Remove receipt', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Remove A small receipt?', exact: true })
    .getByRole('button', { name: 'Remove receipt', exact: true })
    .click();
  await expect(page).toHaveURL(/\/receipts$/);
  await expect(page.getByRole('heading', { name: 'Nothing to squint at yet.', exact: true })).toBeVisible();
  await capture(page, 'empty-directory', info.project.name);
  expect(fixture.rows.size).toBe(0);
  expect(archive.items).toHaveLength(2);
});

test('blocked device recovery needs a deliberate save and navigation choice, and account changes remove the private draft', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error('blocked');
    };
  });
  await draft(page, 'Copy these notes');
  await expect(page.getByText('Draft could not be saved on this device.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save reviewed receipt', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Save without device recovery?', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('link', { name: 'Back to Receipts →', exact: true }).click();
  const leaving = page.getByRole('dialog', { name: 'Leave this receipt draft?', exact: true });
  await expect(leaving).toBeVisible();
  for (const button of await leaving.getByRole('button').all()) {
    const box = await button.boundingBox();
    // Browser rectangles can differ from a 44px CSS target by a fraction of a device pixel.
    expect(box?.height ?? 0, '44px touch target with 0.01px rounding tolerance').toBeGreaterThanOrEqual(
      43.99,
    );
  }
  await capture(page, 'navigation', info.project.name);
  await leaving.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(page.getByRole('textbox', { name: 'Receipt name', exact: true })).toHaveValue(
    'Copy these notes',
  );
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { user: { id: 'other', email: 'other@example.test', displayName: 'Other' } } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
  await expect(page.getByRole('textbox', { name: 'Receipt name', exact: true })).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});

test('receipt review controls, literal amounts and long text reflow accessibly', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive);
  await draft(page, 'A long but readable receipt');
  await page
    .getByRole('textbox', { name: 'Text for line 1', exact: true })
    .fill('A very long entered receipt line without a forced opinion '.repeat(4));
  await page
    .getByRole('textbox', { name: 'Amount as written for line 1 · optional', exact: true })
    .fill('Two for $5; entered as printed');
  await page.getByRole('button', { name: 'Make line suggestions from this text', exact: true }).hover();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await capture(page, 'reflow', info.project.name, '.receipt-lines');
  expect(archive.writes).toHaveLength(0);
});

test('receipt-only backups preview and restore without creating a second set of linked records', async ({
  page,
  archive,
}) => {
  const fixture = await setup(page, archive),
    id = fixture.seed(),
    receipt = fixture.rows.get(id)!;
  const file = {
    schemaVersion: 7,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    receipts: [
      {
        name: receipt.name,
        merchant: receipt.merchant,
        day: receipt.day,
        text: receipt.text,
        note: receipt.note,
        lines: [],
        attachment: null,
        id,
        createdAt: 1,
      },
    ],
  };
  let imported: unknown;
  await page.route('**/api/import', (route) => {
    imported = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ids: [] } });
  });
  await page.goto('/settings');
  await page.getByLabel('Choose backup', { exact: false }).setInputFiles({
    name: 'receipts.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByRole('region', { name: 'Receipts to restore', exact: true })).toContainText(
    'A small receipt',
  );
  await page.getByRole('button', { name: 'Restore previewed data', exact: true }).click();
  await expect(
    page.getByText('0 lists and 0 templates and 1 receipt restored. Existing data was kept.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(imported).toMatchObject({ schemaVersion: 7, receipts: [{ id, lines: [] }] });
  expect(archive.items).toHaveLength(2);
});

test('stopping attachment preparation cannot publish a delayed copy over the next review', async ({
  page,
  archive,
}) => {
  await setup(page, archive);
  await draft(page, 'Stopped copy');
  await sample(page);
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let held = true;
    const waiting: (() => void)[] = [];
    const testWindow = window as Window & {
      pendingReceiptCopies?: () => number;
      releaseReceiptCopies?: () => void;
    };
    testWindow.pendingReceiptCopies = () => waiting.length;
    testWindow.releaseReceiptCopies = () => {
      held = false;
      for (const run of waiting.splice(0)) run();
    };
    HTMLCanvasElement.prototype.toBlob = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      const run = () => original.apply(this, args);
      if (held) waiting.push(run);
      else run();
    };
  });
  await page.getByRole('button', { name: 'Prepare exact attachment copy', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { pendingReceiptCopies?: () => number }).pendingReceiptCopies?.() ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Stop attachment preparation', exact: true }).click();
  await page.evaluate(() =>
    (window as Window & { releaseReceiptCopies?: () => void }).releaseReceiptCopies?.(),
  );
  await expect(
    page.getByText('Attachment preparation stopped. Your previous copy is kept.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Exact receipt attachment copy', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Prepare exact attachment copy', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Exact receipt attachment copy', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Exact attachment copy', exact: true })).toBeFocused();
  expect(archive.writes).toHaveLength(0);
});

test('a missing device copy cannot resend another image and can still check a saved receipt', async ({
  page,
  archive,
}) => {
  const fixture = await setup(page, archive);
  await draft(page, 'Missing device copy');
  await attach(page);
  fixture.setLost();
  await page.getByRole('button', { name: 'Save reviewed receipt', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t connect');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('worth-draft-photos', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').delete('browser-preview:receipt-prepared');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  });
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'pending attachment copy could not recover' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'Exact receipt attachment copy', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry exact receipt save', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'exact pending attachment is unavailable' }),
  ).toBeVisible();
  expect(fixture.uploads).toHaveLength(1);
  await page.getByRole('button', { name: 'Check saved receipt', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Missing device copy', exact: true, level: 1 }),
  ).toBeVisible();
  expect(fixture.rows.size).toBe(1);
  expect(archive.writes).toHaveLength(1);
});
