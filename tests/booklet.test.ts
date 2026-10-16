import { expect, test } from 'vitest';
import { bookletEntries, bookletHtml, wrapCardText } from '../src/shared/booklet';
import type { Item } from '../src/shared/models';
import { emptyItemContext } from '../src/shared/item-context';

const item: Item = {
  id: 'private-id',
  listId: 'private-list',
  title: 'Coffee <special>',
  type: 'Drink',
  note: 'PRIVATE NOTE',
  decision: 'favorite',
  startedOn: '2026-10-01',
  endedOn: null,
  hasPhoto: true,
  createdAt: 1,
  updatedAt: 2,
  logCount: 7,
  lastLoggedOn: '2026-10-15',
  context: {
    ...emptyItemContext,
    recommendedBy: 'PRIVATE PERSON',
    sourceUrl: 'https://private.test/token',
    loan: { ...emptyItemContext.loan, person: 'ANOTHER PERSON' },
  },
};

test('default booklets project only selected names, types and deliberately written captions', () => {
  const entries = bookletEntries(
    [item],
    ['gone', item.id, item.id],
    [item.id],
    { ranks: false, calls: false, notes: false, photos: false },
    { [item.id]: 'My caption' },
  );
  expect(entries).toHaveLength(1);
  const html = bookletHtml({ title: 'A collection', dedication: '', entries });
  expect(html).toContain('Coffee &lt;special&gt;');
  expect(html).toContain('My caption');
  for (const hidden of [
    'PRIVATE',
    'ANOTHER PERSON',
    'private-id',
    'private-list',
    '2026-10-01',
    '2026-10-15',
    '/api/',
    'favorite',
    'COLLECTION RANK',
  ])
    expect(html).not.toContain(hidden);
});

test('optional fields are explicit, HTML text is escaped, and photos must be embedded raster data', () => {
  const entries = bookletEntries(
    [item],
    [item.id],
    [item.id],
    { ranks: true, calls: true, notes: true, photos: true },
    { [item.id]: '</style><script>bad()</script>' },
  );
  expect(() => bookletHtml({ title: 'Title', dedication: '', entries })).toThrow('embedded safely');
  entries[0].photo = 'data:image/png;base64,AA==';
  const html = bookletHtml({ title: '<img onerror=bad()>', dedication: 'A & B', entries });
  expect(html).toContain('PRIVATE NOTE');
  expect(html).toContain('COLLECTION RANK 1');
  expect(html).toContain('Favorite');
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<img onerror');
  expect(html).toContain('Content-Security-Policy');
  expect(html).not.toContain('PRIVATE PERSON');
  expect(html).not.toContain('https://private.test');
  expect(() =>
    bookletHtml({
      title: 'Title',
      dedication: '',
      entries: [{ ...entries[0], photo: 'data:image/svg+xml;base64,AA==' }],
    }),
  ).toThrow();
});

test('Unicode card wrapping preserves every grapheme and intentional empty lines without truncation', () => {
  const text = 'A café with 👨‍👩‍👧‍👦 and 你好 ' + 'a'.repeat(120);
  const rows = wrapCardText(
    text,
    (value) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length * 10,
    80,
  );
  expect(rows.join('')).toBe(text);
  expect(rows.some((row) => row.includes('👨‍👩‍👧‍👦'))).toBe(true);
  expect(wrapCardText('A\n\nB', (value) => value.length, 100)).toEqual(['A', '', 'B']);
  expect(() => bookletHtml({ title: 'Empty', dedication: '', entries: [] })).toThrow();
  expect(() =>
    bookletHtml({
      title: 'Invalid',
      dedication: '',
      entries: [{ id: '', title: 'Item', type: '', caption: '', rank: NaN }],
    }),
  ).toThrow();
});
