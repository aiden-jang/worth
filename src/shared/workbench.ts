import type { Item } from './models';

export type Comparison = {
  pending: string[];
  ordered: string[];
  low: number;
  high: number;
  skipped: string[];
};

export function cleanOrder(ids: string[], items: Item[]): string[] {
  const available = new Set(items.map((item) => item.id));
  return [...new Set(ids)].filter((id) => available.has(id));
}

export function startComparison(ids: string[]): Comparison {
  const [first, ...pending] = [...new Set(ids)];
  return { pending, ordered: first ? [first] : [], low: 0, high: first ? 1 : 0, skipped: [] };
}

export function comparisonPair(state: Comparison): [string, string] | null {
  if (!state.pending.length) return null;
  return [state.pending[0], state.ordered[Math.floor((state.low + state.high) / 2)]];
}

// Binary insertion asks only the comparisons needed to place the next record.
export function answerComparison(state: Comparison, choice: 'first' | 'second' | 'skip'): Comparison {
  if (!state.pending.length) return state;
  const [current, ...rest] = state.pending;
  if (choice === 'skip')
    return {
      ...state,
      pending: rest,
      low: 0,
      high: state.ordered.length,
      skipped: [...state.skipped, current],
    };
  const midpoint = Math.floor((state.low + state.high) / 2);
  const low = choice === 'second' ? midpoint + 1 : state.low;
  const high = choice === 'first' ? midpoint : state.high;
  if (low < high) return { ...state, low, high };
  const ordered = [...state.ordered];
  ordered.splice(low, 0, current);
  return { ...state, ordered, pending: rest, low: 0, high: ordered.length };
}

export function shuffled<T>(values: T[], random: () => number = Math.random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function drawCandidates(items: Item[], mode: 'want' | 'queue' | 'favorite', type: string): Item[] {
  return items.filter(
    (item) =>
      (!type || item.type === type) &&
      (mode === 'want'
        ? item.wantToTry
        : mode === 'queue'
          ? item.revisitQueued
          : item.decision === 'favorite'),
  );
}
