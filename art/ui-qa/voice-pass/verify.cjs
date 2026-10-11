const { chromium } = require(process.env.WORTH_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    let signedIn = false;
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/**', (r) => {
      const url = new URL(r.request().url());
      const responses = {
        '/api/me': {
          user: signedIn
            ? { id: 'voice-preview', displayName: 'Preview', email: 'preview@example.test' }
            : null,
        },
        '/api/lists': { lists: [] },
        '/api/overview': { lists: [], recent: [], ranked: [], lastTimes: [] },
        '/api/search': { results: [] },
        '/api/patterns': {
          totalRecords: 4,
          totalCollections: 0,
          totalActivities: 1,
          rankedItemCount: 0,
          revisitCount: 0,
          favoriteCount: 0,
          mehCount: 0,
          notAgainCount: 0,
          mostReturned: null,
          newestCollection: null,
          lastTouchedCollection: null,
          mostKeptCollection: null,
        },
      };
      assert.ok(url.pathname in responses, `Unexpected request ${url.pathname}`);
      return r.fulfill({ json: responses[url.pathname] });
    });
    for (const [name, route, auth, heading] of [
      ['landing', '/', false, 'Your taste.'],
      ['archive-empty', '/', true, 'A clean slate. Suspicious.'],
      ['search', '/search', true, 'Find that thing.'],
      ['search-missing', '/search?q=elusive', true, 'It’s being elusive.'],
      ['patterns', '/patterns', true, 'Patterns'],
      ['settings', '/settings', true, 'Settings.'],
      ['create', '/lists?create=1&kind=collection', true, 'What are you collecting?'],
      ['help', '/help', false, 'A little help.'],
    ]) {
      console.log('Checking', name);
      signedIn = auth;
      for (const width of [1440, 390, 320, 430, 768]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
        await page.goto((process.env.WORTH_PREVIEW_URL || 'http://localhost:34300') + route, {
          waitUntil: 'domcontentloaded',
        });
        await page
          .getByRole('heading', { name: heading, exact: name !== 'landing' && name !== 'help' })
          .first()
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${name} overflow at ${width}`,
        );
        if (width === 1440 || width === 390)
          await page.screenshot({ path: path.join(__dirname, `${name}-${width}.png`), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
    console.log('Copy screens checked at 1440, 390, 320, 430 and 768px; no overflow or page errors.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
