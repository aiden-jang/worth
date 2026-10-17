import { expect, test } from 'vitest';
import { historyOrder, historyNote, tasteEvent } from '../src/shared/taste-history';
import { archiveFile } from '../src/shared/portability';
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222';
const event = {
  id: 'a'.repeat(32),
  kind: 'rank',
  listId: a,
  itemId: null,
  before: [b, null],
  after: [],
  reason: '',
  logId: null,
  createdAt: 1,
  revision: 0,
};
test('older orders preserve absent positions and never substitute another record', () => {
  expect(historyOrder([a, b, null], new Set([b]))).toEqual([null, b, null]);
  expect(tasteEvent.safeParse(event).success).toBe(true);
  expect(tasteEvent.safeParse({ ...event, after: ['bad'] }).success).toBe(false);
  expect(historyNote.safeParse({ reason: 'a'.repeat(2001), logId: null, expectedRevision: 0 }).success).toBe(
    false,
  );
});
test('history backups keep valid references, old formats default empty, and duplicates fail', () => {
  const base = {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [{ id: a, name: 'One', description: '', kind: 'collection', rankedIds: [], updatedAt: 1 }],
    items: [{ id: b, listId: a, title: 'B', type: '', note: '', createdAt: 1, updatedAt: 1 }],
    logs: [],
    tasteHistory: [event],
  };
  expect(archiveFile.parse(base).tasteHistory).toHaveLength(1);
  expect(archiveFile.safeParse({ ...base, tasteHistory: [event, event] }).success).toBe(false);
  expect(archiveFile.safeParse({ ...base, tasteHistory: [{ ...event, before: [a] }] }).success).toBe(false);
  expect(archiveFile.safeParse({ ...base, tasteHistory: [{ ...event, listId: b }] }).success).toBe(false);
  expect(archiveFile.parse({ ...base, schemaVersion: 1, tasteHistory: undefined }).tasteHistory).toEqual([]);
});
