import type { Item, ItemDecision, ListDetail } from './models';
import { contextSearchText } from './item-context';

export function rankedItems(list: ListDetail, items: Item[]): Item[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return list.rankedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export function moveRank(rankedIds: string[], itemId: string, position: number | null): string[] {
  const without = rankedIds.filter((id) => id !== itemId);
  if (position === null) return without;
  const next = [...without];
  next.splice(Math.max(0, Math.min(position - 1, next.length)), 0, itemId);
  return next;
}

export type ItemSort = 'rank' | 'recent' | 'name' | 'times';
export type RankFilter = 'all' | 'top5' | 'top10' | 'unranked';
export type DecisionFilter = 'all' | 'none' | ItemDecision;

export function visibleItems(
  items: Item[],
  rankedIds: string[],
  options: {
    search: string;
    type: string;
    rankFilter: RankFilter;
    decisionFilter: DecisionFilter;
    sort: ItemSort;
  },
): Item[] {
  const positions = new Map(rankedIds.map((id, index) => [id, index]));
  const search = options.search.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => {
    const position = positions.get(item.id);
    if (options.type !== 'all' && item.type !== options.type) return false;
    if (
      search &&
      !`${item.title} ${item.type} ${item.note} ${contextSearchText(item.context)}`
        .toLocaleLowerCase()
        .includes(search)
    )
      return false;
    if (options.rankFilter === 'unranked' && position !== undefined) return false;
    if (options.rankFilter === 'top5' && (position === undefined || position >= 5)) return false;
    if (options.rankFilter === 'top10' && (position === undefined || position >= 10)) return false;
    if (options.decisionFilter === 'none' && item.decision !== null) return false;
    if (
      options.decisionFilter !== 'all' &&
      options.decisionFilter !== 'none' &&
      item.decision !== options.decisionFilter
    )
      return false;
    return true;
  });
  return filtered.sort((a, b) => {
    if (options.sort === 'rank')
      return (
        (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity) ||
        a.title.localeCompare(b.title)
      );
    if (options.sort === 'recent')
      return (b.lastLoggedOn ?? '').localeCompare(a.lastLoggedOn ?? '') || b.updatedAt - a.updatedAt;
    if (options.sort === 'times') return b.logCount - a.logCount || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
}
