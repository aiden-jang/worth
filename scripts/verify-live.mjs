import assert from 'node:assert/strict';
const base = process.env.WORTH_LIVE_URL || 'https://worth.aidenjang.com';
const get = (path) => fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
const health = await get('/api/health');
assert.equal(health.status, 200);
assert.equal((await health.json()).status, 'ok');
const me = await get('/api/me');
assert.equal(me.status, 200);
assert.equal((await me.json()).user, null);
const privateData = await get('/api/export/records');
assert.equal(privateData.status, 401);
assert.match(privateData.headers.get('cache-control') || '', /no-store/);
const home = await get('/');
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /favicon.svg/);
assert.match(html, /site.webmanifest/);
assert.match(home.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
for (const path of ['/privacy', '/terms', '/help', '/favicon.svg', '/site.webmanifest', '/social-card.png']) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
}
const share = await get('/s/check-unavailable');
assert.match(share.headers.get('x-robots-tag') || '', /noindex/);
console.log(
  'Live checks passed: health, signed-out identity, private export boundary, browser assets, policy routes, HTML security headers and share indexing.',
);
