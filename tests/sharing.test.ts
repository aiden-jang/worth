import { describe, expect, it } from 'vitest';
import { createShareToken, rankedItems, shareSnapshot, validShareToken } from '../worker/sharing';
import type { Item, ListDetail } from '../src/shared/models';

const list: ListDetail = {
  id: 'list',
  name: 'Whiskey',
  kind: 'collection',
  description: '',
  itemCount: 3,
  logCount: 0,
  hasCoverPhoto: false,
  rankedIds: ['b', 'a', 'missing'],
  rankRevision: 1,
  updatedAt: 0,
};

const item = (id: string, title: string): Item => ({
  id,
  listId: 'list',
  title,
  type: 'Whiskey',
  note: 'Never share this note',
  decision: 'would_not_again',
  startedOn: null,
  endedOn: null,
  hasPhoto: true,
  createdAt: 0,
  updatedAt: 0,
  logCount: 2,
  lastLoggedOn: '2026-09-30',
});

describe('sharing', () => {
  it('uses the saved order and ignores deleted entries', () => {
    expect(rankedItems(list, [item('a', 'A'), item('b', 'B')]).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('includes only public fields in a snapshot', () => {
    const snapshot = shareSnapshot(list, [item('a', 'A'), item('b', 'B')], 5, 123);
    expect(snapshot).toEqual({
      title: 'Whiskey',
      createdAt: 123,
      entries: [
        { rank: 1, title: 'B', type: 'Whiskey' },
        { rank: 2, title: 'A', type: 'Whiskey' },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain('Never share');
  });

  it('uses long random URL-safe tokens', () => {
    const first = createShareToken();
    expect(validShareToken(first)).toBe(true);
    expect(createShareToken()).not.toBe(first);
  });
});
