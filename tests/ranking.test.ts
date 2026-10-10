import { describe, expect, it } from 'vitest';
import { moveRank, visibleItems } from '../src/shared/ranking';
import type { Item } from '../src/shared/models';

const item = (id: string, title: string, type = 'Whiskey', decision: Item['decision'] = null): Item => ({
  id,
  listId: 'list',
  title,
  type,
  note: '',
  decision,
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: 0,
  updatedAt: 0,
  logCount: 0,
  lastLoggedOn: null,
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
      search: '',
      type: 'Whiskey',
      rankFilter: 'top5',
      decisionFilter: 'all',
      sort: 'rank',
    });
    expect(visible.map((entry) => entry.id)).toEqual(['a', 'c']);
  });

  it('keeps unranked items in the full list', () => {
    const visible = visibleItems([item('a', 'A'), item('b', 'B')], ['b'], {
      search: '',
      type: 'all',
      rankFilter: 'all',
      decisionFilter: 'all',
      sort: 'rank',
    });
    expect(visible.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('Meh filtering excludes no-call items at every rank position', () => {
    const items = [
      item('empty', 'No call'),
      item('neutral', 'Meh', '', 'meh'),
      item('neutral-unranked', 'Also meh', '', 'meh'),
    ];
    const ranks = ['empty', 'neutral'];
    const result = visibleItems(items, ranks, {
      search: '',
      type: 'all',
      rankFilter: 'all',
      decisionFilter: 'meh',
      sort: 'rank',
    });
    expect(result.map((entry) => entry.id)).toEqual(['neutral', 'neutral-unranked']);
    expect(ranks).toEqual(['empty', 'neutral']);
  });

  it('filters personal calls without changing rank order', () => {
    const items = [
      item('a', 'A', 'Whiskey', 'would_not_again'),
      item('b', 'B', 'Wine', 'favorite'),
      item('c', 'C'),
    ];
    const favorites = visibleItems(items, ['b', 'a'], {
      search: '',
      type: 'all',
      rankFilter: 'all',
      decisionFilter: 'favorite',
      sort: 'rank',
    });
    const notAgain = visibleItems(items, ['b', 'a'], {
      search: '',
      type: 'all',
      rankFilter: 'all',
      decisionFilter: 'would_not_again',
      sort: 'rank',
    });
    const unrankedFavorites = visibleItems(items, ['b', 'a'], {
      search: '',
      type: 'all',
      rankFilter: 'unranked',
      decisionFilter: 'favorite',
      sort: 'rank',
    });

    expect(favorites.map((entry) => entry.id)).toEqual(['b']);
    expect(notAgain.map((entry) => entry.id)).toEqual(['a']);
    expect(unrankedFavorites).toEqual([]);
  });
});
