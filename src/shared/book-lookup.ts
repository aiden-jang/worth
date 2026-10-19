import { captureCode, readBookSuggestion, type BookSuggestion } from './code-capture';

const cache = new Map<string, { expires: number; book: BookSuggestion | null }>();
let lastRequest = 0;

/** This is a public, explicit ISBN-only request; never use Worth's authenticated API client here. */
export async function lookupBook(value: string, signal: AbortSignal): Promise<BookSuggestion | null> {
  const { code, isbn } = captureCode(value);
  if (!isbn) throw new Error('Book lookup needs an ISBN. You can name other products manually.');
  signal.throwIfAborted();
  const stored = cache.get(code);
  if (stored && stored.expires > Date.now()) return stored.book;
  if (Date.now() - lastRequest < 1100) throw new Error('Wait a moment before another book lookup.');
  lastRequest = Date.now();
  const url = new URL('https://openlibrary.org/api/books');
  url.search = new URLSearchParams({ bibkeys: `ISBN:${code}`, jscmd: 'data', format: 'json' }).toString();
  try {
    const response = await fetch(url, {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429)
      throw new Error('Open Library is busy. Wait a minute, or enter the name manually.');
    if (!response.ok)
      throw new Error('Book lookup is unavailable. Try again later, or enter the name manually.');
    if (!response.body || Number(response.headers.get('content-length')) > 512 * 1024)
      throw new Error('Unreadable book response.');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 512 * 1024) {
          await reader.cancel();
          throw new Error('Unreadable book response.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    signal.throwIfAborted();
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const book = readBookSuggestion(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
      code,
    );
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(code, { expires: Date.now() + 24 * 60 * 60 * 1000, book });
    return book;
  } catch (error) {
    if (signal.aborted) throw error;
    if (
      error instanceof Error &&
      (error.message.startsWith('Open Library') || error.message.startsWith('Book lookup'))
    )
      throw error;
    throw new Error(
      'Couldn’t get readable book details. Check your connection, try again, or enter the name manually.',
    );
  }
}
