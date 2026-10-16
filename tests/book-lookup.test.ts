import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const code = '9780140328721';
const payload = { [`ISBN:${code}`]: { title: 'A catalog title', authors: [{ name: 'An author' }] } };
test('explicit lookup sends only an ISBN to a fixed host, omits credentials/referrers, and reuses bounded public metadata', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
  vi.stubGlobal('fetch', fetch);
  const { lookupBook } = await import('../src/shared/book-lookup');
  expect(await lookupBook(code, new AbortController().signal)).toMatchObject({
    code,
    title: 'A catalog title',
  });
  const [url, init] = fetch.mock.calls[0];
  expect(url.origin + url.pathname).toBe('https://openlibrary.org/api/books');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    bibkeys: `ISBN:${code}`,
    format: 'json',
    jscmd: 'data',
  });
  expect(init).toMatchObject({
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  expect(init.body).toBeUndefined();
  await lookupBook(code, new AbortController().signal);
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(lookupBook('036000291452', new AbortController().signal)).rejects.toThrow('ISBN');
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('lookup rejects oversized streamed responses without retaining or exposing their contents', async () => {
  const cancelled = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(512 * 1024 + 1));
          },
          cancel: cancelled,
        }),
      ),
    ),
  );
  const { lookupBook } = await import('../src/shared/book-lookup');
  await expect(lookupBook(code, new AbortController().signal)).rejects.toThrow('readable book details');
  expect(cancelled).toHaveBeenCalledTimes(1);
});
test('unavailable lookups and already aborted requests remain failures rather than invented metadata', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
  vi.stubGlobal('fetch', fetch);
  const { lookupBook } = await import('../src/shared/book-lookup');
  await expect(lookupBook(code, new AbortController().signal)).rejects.toThrow('Open Library is busy');
  const abort = new AbortController();
  abort.abort();
  await expect(lookupBook(code, abort.signal)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
