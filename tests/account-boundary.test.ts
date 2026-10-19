import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test('a document binds request ownership once and keeps retry headers when accounts change', async () => {
  vi.resetModules();
  const { api, bindPageAccount } = await import('../src/api');
  expect(bindPageAccount('first-account')).toBe(true);
  expect(bindPageAccount('second-account')).toBe(false);
  const fetcher = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify({ lists: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  await api.lists();
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('X-Worth-Account')).toBe('first-account');
  await api.me();
  expect(new Headers(fetcher.mock.calls[1][1].headers).has('X-Worth-Account')).toBe(false);
});

test('an account mismatch asks the session boundary to revalidate without retrying a write', async () => {
  vi.resetModules();
  const { api, bindPageAccount } = await import('../src/api');
  bindPageAccount('first-account');
  const changed = vi.fn();
  window.addEventListener('worth:account-changed', changed);
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ error: 'ACCOUNT_CHANGED', message: 'Reload Worth.' }), { status: 409 }),
    );
  vi.stubGlobal('fetch', fetcher);
  await expect(api.lists()).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  expect(changed).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledOnce();
  window.removeEventListener('worth:account-changed', changed);
});
