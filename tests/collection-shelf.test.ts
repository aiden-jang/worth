import { expect, test } from 'vitest';
import { collectionWorkspace, emptyCollectionShelf, filterWorkspace } from '../src/shared/workspace';
import { archiveFile } from '../src/shared/portability';

const collectionId = '11111111-1111-4111-8111-111111111111';
const first = '22222222-2222-4222-8222-222222222222';
const second = '33333333-3333-4333-8333-333333333333';

test('older workspaces stay unchanged and a missing record never inherits an inscription or keepsake', () => {
  expect(collectionWorkspace.parse({})).toEqual({ rankings: [], views: [] });
  const workspace = collectionWorkspace.parse({
    shelf: {
      ...emptyCollectionShelf,
      keepsakeId: first,
      inscription: { itemId: first, text: 'First kept.' },
    },
  });
  const hidden = filterWorkspace(workspace, new Set([second]));
  expect(hidden.shelf?.keepsakeId).toBeNull();
  expect(hidden.shelf?.inscription).toBeNull();
  expect(workspace.shelf?.inscription?.itemId).toBe(first);
  expect(filterWorkspace(workspace, new Set([first])).shelf?.keepsakeId).toBe(first);
});

test('shelves enforce bounded text and reject foreign and merged references in restore files', () => {
  expect(
    collectionWorkspace.safeParse({ shelf: { ...emptyCollectionShelf, dedication: 'x'.repeat(281) } })
      .success,
  ).toBe(false);
  expect(
    collectionWorkspace.safeParse({ shelf: { ...emptyCollectionShelf, keepsakeId: 'not-an-id' } }).success,
  ).toBe(false);
  const file = {
    schemaVersion: 1,
    exportedAt: new Date(0).toISOString(),
    photosExcluded: true,
    lists: [
      {
        id: collectionId,
        name: 'Shelf',
        kind: 'collection',
        description: '',
        artwork: null,
        rankedIds: [],
        updatedAt: 1,
        workspace: { rankings: [], views: [], shelf: { ...emptyCollectionShelf, keepsakeId: first } },
      },
    ],
    items: [
      {
        id: first,
        listId: collectionId,
        title: 'Coffee',
        type: '',
        note: '',
        decision: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    logs: [],
  };
  expect(archiveFile.safeParse(file).success).toBe(true);
  expect(archiveFile.safeParse({ ...file, items: [] }).success).toBe(false);
  expect(
    archiveFile.safeParse({ ...file, lists: [{ ...file.lists[0], kind: 'activity' }], items: [] }).success,
  ).toBe(false);
  expect(
    archiveFile.safeParse({
      ...file,
      items: [file.items[0], { ...file.items[0], id: second, mergedIntoId: first }],
      lists: [
        {
          ...file.lists[0],
          workspace: {
            ...file.lists[0].workspace,
            shelf: { ...emptyCollectionShelf, inscription: { itemId: second, text: 'Original' } },
          },
        },
      ],
    }).success,
  ).toBe(false);
});
