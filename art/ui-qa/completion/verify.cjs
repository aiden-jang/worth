const { chromium } = require(process.env.WORTH_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.WORTH_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const dir = __dirname,
    base = process.env.WORTH_PREVIEW_URL || 'http://localhost:34300';
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let signedIn = true,
      authDown = false,
      failExport = true,
      failRestore = true,
      deletes = 0,
      restores = [],
      failClear = false;
    const owner = 'qa-completion',
      id = '11111111-1111-4111-8111-111111111111';
    const archive = {
      schemaVersion: 1,
      exportedAt: '2026-10-10T12:00:00Z',
      photosExcluded: true,
      lists: [
        {
          id,
          name: 'My drinks',
          kind: 'collection',
          description: '',
          artwork: null,
          rankedIds: [],
          updatedAt: 10,
        },
      ],
      items: [],
      logs: [],
      workoutSessions: [],
      workoutRoutines: [],
      photos: [],
    };
    await page.route('**/api/**', async (r) => {
      const u = new URL(r.request().url());
      const p = u.pathname;
      if (p === '/api/me')
        return r.fulfill({
          status: authDown ? 503 : 200,
          json: authDown
            ? { message: 'Accounts unavailable' }
            : {
                user: signedIn ? { id: owner, email: 'preview@example.test', displayName: 'Preview' } : null,
              },
        });
      if (p === '/api/lists') return r.fulfill({ json: { lists: [] } });
      if (p === '/api/export/records' || p === '/api/export/backup') {
        if (failExport) {
          failExport = false;
          return r.fulfill({ status: 500, json: { message: 'Could not prepare export' } });
        }
        return r.fulfill({ json: { ...archive, photosExcluded: p.endsWith('/records') } });
      }
      if (p === '/api/import') {
        restores.push({ key: r.request().headers()['idempotency-key'], body: r.request().postDataJSON() });
        if (failRestore) {
          failRestore = false;
          return r.fulfill({ status: 503, json: { message: 'Restore interrupted. Try again.' } });
        }
        return r.fulfill({ status: 201, json: { ids: [id] } });
      }
      if (p === '/api/data') {
        assert.equal(r.request().headers()['x-worth-confirmation'], 'delete-all-worth-data');
        deletes++;
        return r.fulfill({ status: 204 });
      }
      throw new Error('Unhandled API request: ' + p);
    });
    await page.goto(base + '/settings');
    await page.getByRole('heading', { name: 'Settings.', exact: true }).waitFor();
    for (const [name, w, h] of [
      ['desktop', 1440, 900],
      ['mobile', 390, 780],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(dir, 'settings-' + name + '.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Export records', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Could not prepare export' }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export records', exact: true }).click();
    assert.match((await download).suggestedFilename(), /worth-records/);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
    await page.getByRole('alert').filter({ hasText: 'not valid JSON' }).waitFor();
    await page.locator('input[type=file]').setInputFiles({
      name: 'worth-records.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(archive)),
    });
    await page.getByRole('heading', { name: 'worth-records.json' }).waitFor();
    await page.screenshot({ path: path.join(dir, 'restore-preview-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Restore as new lists' }).click();
    await page.getByRole('alert').filter({ hasText: 'Restore interrupted' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Settings.', exact: true }).waitFor();
    await page.locator('input[type=file]').setInputFiles({
      name: 'worth-records.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(archive)),
    });
    await page.getByRole('heading', { name: 'worth-records.json' }).waitFor();
    await page.getByRole('button', { name: 'Restore as new lists' }).click();
    await page.getByRole('status').filter({ hasText: '1 list restored' }).waitFor();
    assert.equal(restores[0].key, restores[1].key);
    assert.equal(restores.length, 2);
    assert(
      !(await page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith('worth:restore:qa-completion:')),
      )),
    );
    await page.evaluate(
      async ({ owner }) => {
        localStorage.setItem(
          `worth:draft:v1:${owner}:old`,
          JSON.stringify({ updatedAt: 1, form: { title: 'old' } }),
        );
        localStorage.setItem(
          `worth:draft:v1:${owner}:fresh`,
          JSON.stringify({ updatedAt: Date.now(), form: { title: 'new' } }),
        );
        localStorage.setItem('worth:draft:v1:other:old', JSON.stringify({ updatedAt: 1 }));
        localStorage.setItem(`worth:rest:${owner}:visit`, String(Date.now() + 10000));
        await new Promise((resolve, reject) => {
          const q = indexedDB.open('worth-draft-photos', 1);
          q.onupgradeneeded = () => q.result.createObjectStore('files');
          q.onerror = () => reject(q.error);
          q.onsuccess = () => {
            const db = q.result,
              t = db.transaction('files', 'readwrite'),
              s = t.objectStore('files');
            s.put({ file: new File(['old'], 'old.png'), updatedAt: 1 }, `${owner}:old`);
            s.put({ file: new File(['new'], 'new.png'), updatedAt: Date.now() }, `${owner}:fresh`);
            s.put({ file: new File(['other'], 'other.png'), updatedAt: 1 }, 'other:old');
            t.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        });
      },
      { owner },
    );
    await page.reload();
    await page.getByRole('heading', { name: 'Settings.', exact: true }).waitFor();
    const storageState = () =>
      page.evaluate(
        async ({ owner }) => {
          const keys = Object.keys(localStorage);
          const photos = await new Promise((resolve) => {
            const q = indexedDB.open('worth-draft-photos', 1);
            q.onsuccess = () => {
              const db = q.result,
                t = db.transaction('files'),
                r = t.objectStore('files').getAllKeys();
              r.onsuccess = () => resolve(r.result);
              t.oncomplete = () => db.close();
            };
          });
          return { keys, photos };
        },
        { owner },
      );
    await page.waitForFunction(() => !localStorage.getItem('worth:draft:v1:qa-completion:old'));
    let state = await storageState();
    assert(!state.photos.includes(owner + ':old'));
    assert(state.photos.includes(owner + ':fresh'));
    assert(state.photos.includes('other:old'));
    await page.getByRole('button', { name: 'Clear device drafts', exact: true }).click();
    await page
      .getByRole('dialog')
      .locator('.confirm-actions')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    assert((await storageState()).keys.includes(`worth:draft:v1:${owner}:fresh`));
    await page.getByRole('button', { name: 'Clear device drafts', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear device drafts', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Device drafts and timers cleared.' }).waitFor();
    state = await storageState();
    assert(
      !state.keys.some(
        (k) => k.startsWith(`worth:draft:v1:${owner}:`) || k.startsWith(`worth:rest:${owner}:`),
      ),
    );
    assert(!state.photos.some((k) => k.startsWith(owner + ':')));
    assert(state.photos.includes('other:old'));
    await page.getByRole('button', { name: 'Delete all Worth data', exact: true }).click();
    await page
      .getByRole('dialog')
      .locator('.confirm-actions')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    assert.equal(deletes, 0);
    await page.getByRole('button', { name: 'Delete all Worth data', exact: true }).click();
    await page.getByRole('dialog').evaluate(async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
    });
    await page.screenshot({ path: path.join(dir, 'delete-confirmation-mobile.png') });
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete all Worth data', exact: true })
      .click();
    await page.getByRole('status').filter({ hasText: 'All Worth data deleted' }).waitFor();
    assert.equal(deletes, 1);
    for (const [name, w, h] of [
      ['desktop', 1440, 900],
      ['mobile', 390, 780],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      for (const screen of ['privacy', 'terms', 'help']) {
        await page.goto(base + '/' + screen);
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.screenshot({ path: path.join(dir, screen + '-' + name + '.png'), fullPage: true });
        assert(await page.locator('a[href^="mailto:support@aidenjang.com"]').count());
      }
    }
    signedIn = false;
    for (const screen of ['privacy', 'terms', 'help']) {
      await page.goto(base + '/' + screen);
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert(!(await page.getByText('Start your archive', { exact: true }).count()));
    }
    await page.goto(base + '/missing-page');
    await page.getByRole('heading', { name: 'Page not found.' }).waitFor();
    await page.screenshot({ path: path.join(dir, 'missing-mobile.png') });
    await page.goto(base + '/');
    await page.getByRole('link', { name: 'Privacy', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Terms', exact: true }).waitFor();
    await page.screenshot({ path: path.join(dir, 'landing-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(dir, 'landing-desktop.png'), fullPage: true });
    authDown = true;
    await page.goto(base + '/settings');
    await page.getByRole('heading', { name: 'Account unavailable.' }).waitFor();
    authDown = false;
    signedIn = true;
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByRole('heading', { name: 'Settings.' }).waitFor();
    for (const w of [320, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const route of ['/settings', '/privacy', '/help']) {
        await page.goto(base + route);
        await page.getByRole('heading', { level: 1 }).waitFor();
        assert(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          'overflow ' + w + ' ' + route,
        );
      }
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(dir, 'result.json'),
      JSON.stringify(
        {
          passed: true,
          errors,
          checks: [
            'export failure/retry',
            'restore preview/validation/retry identity',
            'owner-scoped expired text/photo cleanup',
            'confirmed device/all-data deletion',
            'public policies/contact links',
            '404',
            'auth outage/retry',
            '320/390/430/768/1440 reflow',
          ],
        },
        null,
        2,
      ),
    );
    console.log('Completion browser QA passed.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
