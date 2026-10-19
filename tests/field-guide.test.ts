import { expect, test } from 'vitest';
import { emptyFieldGuide, fieldGuideData, isFieldGuideDraft } from '../src/shared/field-guide';
import { bookletHtml } from '../src/shared/booklet';
import type { Item } from '../src/shared/models';
import { emptyItemContext } from '../src/shared/item-context';
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222';
const one = '33333333-3333-4333-8333-333333333333',
  two = '44444444-4444-4444-8444-444444444444';
const item: Item = {
  id: a,
  listId: one,
  title: 'Current name',
  type: 'Coffee',
  note: 'PRIVATE NOTE',
  decision: 'favorite',
  startedOn: '2026-01-01',
  endedOn: null,
  hasPhoto: true,
  createdAt: 1,
  updatedAt: 2,
  logCount: 3,
  lastLoggedOn: '2026-10-01',
  context: {
    ...emptyItemContext,
    location: 'PRIVATE LOCATION',
    recommendedBy: 'PRIVATE PERSON',
    sourceUrl: 'https://private.test/token',
  },
};
const selected = { id: a, listId: one, title: 'Old draft name', caption: 'A chosen caption' };
test('field guides include selected current names/types and captions without leaking other fields', () => {
  const data = fieldGuideData(
    { ...emptyFieldGuide, entries: [selected] },
    [item],
    new Map([[one, 'PRIVATE COLLECTION']]),
  );
  expect(data.format).toBe('guide');
  expect(data.entries[0]).toEqual({
    id: a,
    title: 'Current name',
    type: 'Coffee',
    caption: 'A chosen caption',
  });
  const html = bookletHtml(data);
  expect(html).toContain('A FIELD GUIDE FROM WORTH');
  expect(html).not.toContain('A COLLECTION FROM WORTH');
  for (const hidden of [
    'PRIVATE',
    'Favorite',
    'COLLECTION RANK',
    '/api/',
    'https://private.test',
    '2026-01-01',
  ])
    expect(html).not.toContain(hidden);
});
test('ordered field guides opt into literal locations, notes, collection names and photos independently', () => {
  const second = {
    ...item,
    id: b,
    listId: two,
    title: 'A second find',
    hasPhoto: false,
    context: { ...emptyItemContext, location: '<script>literal place</script>' },
  };
  const draft = {
    ...emptyFieldGuide,
    entries: [{ ...selected, id: b, listId: two, title: second.title, caption: 'Second first' }, selected],
    notes: true,
    locations: true,
    collections: true,
  };
  const data = fieldGuideData(
    draft,
    [item, second],
    new Map([
      [one, 'One'],
      [two, 'Two'],
    ]),
  );
  expect(data.entries.map((e) => e.id)).toEqual([b, a]);
  expect(data.entries[0].caption).toContain('Where: <script>literal place</script>');
  expect(data.entries[0].caption).toContain('Collection: Two');
  const html = bookletHtml(data);
  expect(html).toContain('PRIVATE NOTE');
  expect(html).toContain('&lt;script&gt;literal place&lt;/script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('PRIVATE PERSON');
  expect(html).not.toContain('/api/');
  const photos = fieldGuideData({ ...draft, photos: true }, [item, second], new Map());
  expect(photos.entries[1].photo).toBe(`/api/items/${a}/photo?v=2`);
});
test('guide drafts bound selections and preserve captions without creating records', () => {
  expect(isFieldGuideDraft({ ...emptyFieldGuide, entries: [selected] })).toBe(true);
  expect(isFieldGuideDraft({ ...emptyFieldGuide, entries: [selected, selected] })).toBe(false);
  expect(
    isFieldGuideDraft({ ...emptyFieldGuide, entries: [{ ...selected, caption: 'a'.repeat(301) }] }),
  ).toBe(false);
  expect(
    isFieldGuideDraft({
      ...emptyFieldGuide,
      entries: Array.from({ length: 13 }, (_, i) => ({
        ...selected,
        id: `55555555-5555-4555-8555-${String(i).padStart(12, '0')}`,
      })),
    }),
  ).toBe(false);
});
