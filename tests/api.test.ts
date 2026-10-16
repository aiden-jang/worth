// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { api, RequestError } from '../src/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each(['<html>Service unavailable</html>', 'null', '[]', '{broken'])(
  'rejects malformed successful responses: %s',
  async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(api.me()).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
  },
);

test('network failures offer a readable recovery message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(api.lists()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
});

test('keeps server refusal codes and accepts confirmed empty deletion responses', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: 'RATE_LIMITED', message: 'Wait a minute.' }, { status: 429 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 })),
  );
  await expect(api.lists()).rejects.toEqual(new RequestError(429, 'RATE_LIMITED', 'Wait a minute.'));
  await expect(api.deleteList('list')).resolves.toBeUndefined();
});

test('preserves search cancellation and bounds requests with a signal', async () => {
  const controller = new AbortController();
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    expect(init.signal).toBeDefined();
    controller.abort();
    throw new DOMException('cancelled', 'AbortError');
  });
  vi.stubGlobal('fetch', fetch);
  await expect(api.search('coffee', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).toHaveBeenCalledOnce();
});

test('expired requests explain that a write may still have reached the server', async () => {
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
    AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')),
  );
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')));
  await expect(api.lists()).rejects.toMatchObject({
    code: 'TIMEOUT',
    message: expect.stringContaining('whether your change was saved'),
  });
});

test('an interrupted response body uses timeout recovery rather than reporting malformed data', async () => {
  const controller = new AbortController();
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => {
        controller.abort();
        throw new DOMException('Timed out', 'TimeoutError');
      },
    }),
  );
  await expect(api.lists()).rejects.toMatchObject({ code: 'TIMEOUT' });
});
