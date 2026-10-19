import { expect, test } from 'vitest';
import { galleryChoices, galleryEntries, photoArrow } from '../src/shared/photo-gallery';
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
test('gallery metadata keeps bounded captions and separate normalized arrows with an explicit cover', () => {
  const entry = {
    id,
    caption: 'A note on the photo',
    arrows: [{ id: other, fromX: 0.1, fromY: 0.2, toX: 0.7, toY: 0.8, label: 'This detail' }],
  };
  expect(galleryChoices.parse({ entries: [entry], coverId: id }).entries[0]).toEqual(entry);
  expect(galleryChoices.safeParse({ entries: [entry], coverId: other }).success).toBe(false);
  expect(galleryEntries.safeParse([entry, entry]).success).toBe(false);
  expect(galleryEntries.safeParse([{ ...entry, caption: 'x'.repeat(501) }]).success).toBe(false);
  expect(photoArrow.safeParse({ ...entry.arrows[0], toX: 1.1 }).success).toBe(false);
  expect(photoArrow.safeParse({ ...entry.arrows[0], toX: 0.1, toY: 0.2 }).success).toBe(false);
});
