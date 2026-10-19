import { expect, test } from 'vitest';
import { duplicateGroups } from '../src/shared/duplicates';
import { duplicateIdentity } from '../src/shared/record-identity';
import {
  collectionWorkspace,
  filterWorkspace,
  workspaceItemReferences,
  emptyCollectionShelf,
} from '../src/shared/workspace';
import type { Item } from '../src/shared/models';
const first = '11111111-1111-4111-8111-111111111111',
  second = '22222222-2222-4222-8222-222222222222',
  third = '33333333-3333-4333-8333-333333333333',
  review = '44444444-4444-4444-8444-444444444444';
const records = [
  { id: first, title: 'Coffee', type: 'Drink', createdAt: 1 },
  { id: second, title: ' ＣＯＦＦＥＥ ', type: ' Drink ', createdAt: 2 },
  { id: third, title: 'Coffee', type: 'Bean', createdAt: 3 },
] as Item[];
test('duplicate suggestions match names and types without changing source records or merging versions', () => {
  const before = structuredClone(records);
  const groups = duplicateGroups(records);
  expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([[first, second]]);
  expect(groups[0].reviewId).toBeNull();
  expect(records).toEqual(before);
  expect(duplicateIdentity({ title: 'A\0B', type: 'C' })).not.toBe(
    duplicateIdentity({ title: 'A', type: 'B\0C' }),
  );
});
test('a keep-separate review applies to the exact group and a new member needs review again', () => {
  const reviews = [{ id: review, itemIds: [second, first] }];
  expect(duplicateGroups(records, reviews)[0].reviewId).toBe(review);
  expect(
    duplicateGroups([...records, { ...records[0], id: crypto.randomUUID() }], reviews)[0].reviewId,
  ).toBeNull();
  const workspace = collectionWorkspace.parse({
    rankings: [{ id: crypto.randomUUID(), name: 'Order', itemIds: [first] }],
    shelf: { ...emptyCollectionShelf, keepsakeId: first },
    duplicateReviews: reviews,
  });
  expect(workspaceItemReferences(workspace).sort()).toEqual([first, second].sort());
  expect(filterWorkspace(workspace, new Set([first, third])).duplicateReviews).toEqual([]);
  expect(workspace.duplicateReviews).toEqual(reviews);
});
test('duplicate reviews reject repeated groups, IDs and excess membership', () => {
  expect(
    collectionWorkspace.safeParse({ duplicateReviews: [{ id: review, itemIds: [first, first] }] }).success,
  ).toBe(false);
  expect(
    collectionWorkspace.safeParse({
      duplicateReviews: [
        { id: review, itemIds: [first, second] },
        { id: crypto.randomUUID(), itemIds: [second, first] },
      ],
    }).success,
  ).toBe(false);
  const ids = Array.from({ length: 501 }, () => crypto.randomUUID());
  expect(collectionWorkspace.safeParse({ duplicateReviews: [{ id: review, itemIds: ids }] }).success).toBe(
    false,
  );
  const groups = Array.from({ length: 5 }, () => ({
    id: crypto.randomUUID(),
    itemIds: Array.from({ length: 500 }, () => crypto.randomUUID()),
  }));
  expect(collectionWorkspace.safeParse({ duplicateReviews: groups }).success).toBe(false);
  expect(collectionWorkspace.parse({})).toEqual({ rankings: [], views: [] });
});
