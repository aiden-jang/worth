import { describe, expect, it } from 'vitest';
import { moveRank, visibleItems } from '../src/shared/ranking';
import type { Item } from '../src/shared/models';

const item = (id: string, title: string, type = 'Whiskey'): Item => ({
  id, listId: 'list', title, type, note: '', startedOn: null, endedOn: null, hasPhoto: false,
  createdAt: 0, updatedAt: 0, logCount: 0, lastLoggedOn: null,
});

describe('ranking', () => {
  it('moves an item into, within, and out of a ranking', () => {
    expect(moveRank(['a', 'b', 'c'], 'c', 1)).toEqual(['c', 'a', 'b']);
    expect(moveRank(['a', 'b'], 'c', 2)).toEqual(['a', 'c', 'b']);
    expect(moveRank(['a', 'b'], 'a', null)).toEqual(['b']);
  });

  it('filtering does not renumber saved ranks', () => {
    const items = [item('a', 'A'), item('b', 'B', 'Wine'), item('c', 'C')];
    const visible = visibleItems(items, ['b', 'a', 'c'], {
      search: '', type: 'Whiskey', rankFilter: 'top5', sort: 'rank',
    });
    expect(visible.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('keeps unranked items in the full list', () => {
    const visible = visibleItems([item('a', 'A'), item('b', 'B')], ['b'], {
      search: '', type: 'all', rankFilter: 'all', sort: 'rank',
    });
    expect(visible.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

