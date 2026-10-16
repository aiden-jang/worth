// @vitest-environment node
import { expect, test } from 'vitest';
import { widgetDigest, widgetSecret } from '../worker/widget-crypto';

test('S256 uses the RFC 7636 Appendix B vector and URL-safe unpadded secrets', async () => {
  expect(await widgetDigest('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
  const one = widgetSecret(),
    two = widgetSecret();
  expect(one).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(two).not.toBe(one);
});
