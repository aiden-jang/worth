import { describe, expect, it } from 'vitest';
import {
  collectionBrowseCount,
  notOpenedLatelyDays,
  wasOpenedLongAgo,
} from '../src/shared/collection-workspace';
import type { Item } from '../src/shared/models';

const now = Date.UTC(2026, 9, 3, 12, 0, 0);

function item(overrides: Partial<Item>): Item {
  return {
    id: 'item',
    listId: 'list',
    title: 'A name is enough',
    type: '',
    note: '',
    decision: null,
    startedOn: null,
    endedOn: null,
    hasPhoto: false,
    createdAt: 0,
    updatedAt: 0,
    logCount: 0,
    lastLoggedOn: null,
    ...overrides,
  };
}

describe('collection workspace browse states', () => {
  it('keeps unlogged items visible in Not opened lately', () => {
    expect(wasOpenedLongAgo(item({}), now)).toBe(true);
  });

  it('uses a fixed 120-day threshold for stale items', () => {
    const old = item({ lastLoggedOn: '2026-05-05' });
    const recent = item({ lastLoggedOn: '2026-09-01' });

    expect(notOpenedLatelyDays).toBe(120);
    expect(wasOpenedLongAgo(old, now)).toBe(true);
    expect(wasOpenedLongAgo(recent, now)).toBe(false);
  });

  it('counts kept and revisited items without conflating the two calls', () => {
    const items = [
      item({ id: 'favorite', decision: 'favorite', logCount: 1 }),
      item({ id: 'revisited', logCount: 2 }),
      item({ id: 'both', decision: 'favorite', logCount: 3 }),
    ];

    expect(collectionBrowseCount('all', items)).toBe(3);
    expect(collectionBrowseCount('kept', items)).toBe(2);
    expect(collectionBrowseCount('revisited', items)).toBe(2);
  });
});
