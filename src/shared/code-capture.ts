import { z } from 'zod';

export function captureCode(value: string): { code: string; isbn: boolean } {
  const code = value
    .trim()
    .replace(/^ISBN(?:-1[03])?:?\s*/i, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (/^\d{9}[\dX]$/.test(code)) {
    const total = [...code].reduce(
      (sum, digit, index) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - index),
      0,
    );
    if (total % 11 === 0) return { code, isbn: true };
  } else if (/^(?:\d{8}|\d{12}|\d{13})$/.test(code)) {
    const total = [...code]
      .reverse()
      .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0);
    if (total % 10 === 0) return { code, isbn: code.length === 13 && /^(978|979)/.test(code) };
  }
  throw new Error('Check the digits and check digit. Use an ISBN-10, ISBN-13, EAN-8, EAN-13 or UPC-A code.');
}

const bookSuggestion = z.object({
  code: z.string().max(13),
  title: z.string().min(1).max(1000),
  authors: z.array(z.string().max(200)).max(8),
  publishers: z.array(z.string().max(200)).max(5),
  published: z.string().max(120),
});
export type BookSuggestion = z.infer<typeof bookSuggestion>;

export const codeCaptureDraft = z
  .object({
    code: z.string().max(80),
    title: z.string().max(120),
    note: z.string().max(4000),
    keepCode: z.boolean(),
    keepSource: z.boolean(),
    suggestion: bookSuggestion.nullable(),
  })
  .strict();
export type CodeCaptureDraft = z.infer<typeof codeCaptureDraft>;
export const emptyCodeCapture: CodeCaptureDraft = {
  code: '',
  title: '',
  note: '',
  keepCode: true,
  keepSource: false,
  suggestion: null,
};

export function readBookSuggestion(payload: unknown, value: string): BookSuggestion | null {
  const { code, isbn } = captureCode(value);
  if (!isbn) throw new Error('Use an ISBN for book lookup.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error('Unreadable book response.');
  const book: unknown = (payload as Record<string, unknown>)[`ISBN:${code}`];
  if (book === undefined) return null;
  if (!book || typeof book !== 'object' || Array.isArray(book)) throw new Error('Unreadable book response.');
  const source = book as Record<string, unknown>;
  const names = (value: unknown, limit: number): string[] =>
    !Array.isArray(value)
      ? []
      : value
          .flatMap((entry) => {
            if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') return [];
            return [entry.name.trim().slice(0, 200)];
          })
          .filter(Boolean)
          .slice(0, limit);
  return bookSuggestion.parse({
    code,
    title: typeof source.title === 'string' ? source.title.trim() : '',
    authors: names(source.authors, 8),
    publishers: names(source.publishers, 5),
    published: typeof source.publish_date === 'string' ? source.publish_date.trim().slice(0, 120) : '',
  });
}

export function bookDetails(book: BookSuggestion) {
  return [
    book.authors.length ? `Author: ${book.authors.join(', ')}` : '',
    book.publishers.length ? `Publisher: ${book.publishers.join(', ')}` : '',
    book.published ? `Published: ${book.published}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
