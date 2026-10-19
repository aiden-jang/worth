import { expect, test } from 'vitest';
import { bookDetails, captureCode, readBookSuggestion } from '../src/shared/code-capture';

test('ISBN and product codes require a matching check digit and never accept URLs or arbitrary text', () => {
  expect(captureCode('ISBN-13: 978-0-1403-2872-1')).toEqual({ code: '9780140328721', isbn: true });
  expect(captureCode('0-8044-2957-x')).toEqual({ code: '080442957X', isbn: true });
  expect(captureCode('036000291452')).toEqual({ code: '036000291452', isbn: false });
  expect(captureCode('96385074')).toEqual({ code: '96385074', isbn: false });
  for (const value of [
    '9780140328722',
    '0804429571',
    'https://example.test/9780140328721',
    '1234567',
    '<script>',
  ])
    expect(() => captureCode(value)).toThrow('Check the digits');
});
test('book suggestions read only the requested ISBN and bounded plain metadata, ignoring links and images', () => {
  const code = '9780140328721';
  expect(readBookSuggestion({ 'ISBN:other': { title: 'Wrong book' } }, code)).toBeNull();
  const book = readBookSuggestion(
    {
      [`ISBN:${code}`]: {
        title: ' A book <script>literal</script> ',
        authors: [{ name: 'Author', url: 'javascript:no' }, { bad: true }],
        publishers: [{ name: 'Publisher' }],
        publish_date: '1988',
        cover: { large: 'https://tracker.test/photo' },
        url: 'https://unrelated.test',
      },
    },
    code,
  )!;
  expect(book).toEqual({
    code,
    title: 'A book <script>literal</script>',
    authors: ['Author'],
    publishers: ['Publisher'],
    published: '1988',
  });
  expect(bookDetails(book)).toBe('Author: Author\nPublisher: Publisher\nPublished: 1988');
  expect(() => readBookSuggestion({ [`ISBN:${code}`]: { title: 'x'.repeat(1001) } }, code)).toThrow();
  expect(() => readBookSuggestion([], code)).toThrow('Unreadable');
  expect(() => readBookSuggestion({}, '036000291452')).toThrow('ISBN');
});
