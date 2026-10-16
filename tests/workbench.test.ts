import { expect, test } from 'vitest';
import {
  answerComparison,
  cleanOrder,
  comparisonPair,
  drawCandidates,
  shuffled,
  startComparison,
} from '../src/shared/workbench';
import type { Item } from '../src/shared/models';

test('binary comparisons produce the preferred order without changing the source', () => {
  const source = ['d', 'b', 'a', 'c'];
  let state = startComparison(source);
  let questions = 0;
  while (comparisonPair(state)) {
    const [first, second] = comparisonPair(state)!;
    state = answerComparison(state, first < second ? 'first' : 'second');
    expect(++questions).toBeLessThan(20);
  }
  expect(state.ordered).toEqual(['a', 'b', 'c', 'd']);
  expect(source).toEqual(['d', 'b', 'a', 'c']);
});

test('skipping and undoing a comparison preserve the exact earlier state', () => {
  const before = startComparison(['a', 'b', 'c']);
  const after = answerComparison(before, 'skip');
  expect(after.skipped).toEqual(['b']);
  expect(after.ordered).toEqual(['a']);
  expect(comparisonPair(after)).toEqual(['c', 'a']);
  expect(before).toEqual(startComparison(['a', 'b', 'c']));
  expect(comparisonPair(startComparison([]))).toBeNull();
  expect(comparisonPair(startComparison(['a']))).toBeNull();
});

test('all preference permutations finish with every non-skipped record exactly once', () => {
  for (let length = 2; length <= 100; length++) {
    const ids = Array.from({ length }, (_, index) => String(index));
    const source = shuffled(ids, () => 0.37);
    let state = startComparison(source);
    let questions = 0;
    while (comparisonPair(state)) {
      const [first, second] = comparisonPair(state)!;
      state = answerComparison(state, Number(first) < Number(second) ? 'first' : 'second');
      expect(++questions).toBeLessThan(length * 8);
    }
    expect(state.ordered).toEqual(ids);
  }
});

test('draw filters preserve independent calls and queue states and stale drafts omit absent IDs', () => {
  const items = [
    { id: 'a', type: 'Coffee', decision: 'meh', wantToTry: true },
    { id: 'b', type: 'Coffee', decision: 'favorite', revisitQueued: true },
    { id: 'c', type: 'Tea', decision: null, wantToTry: true, revisitQueued: true },
  ] as Item[];
  expect(drawCandidates(items, 'want', 'Coffee').map((item) => item.id)).toEqual(['a']);
  expect(drawCandidates(items, 'queue', '').map((item) => item.id)).toEqual(['b', 'c']);
  expect(drawCandidates(items, 'favorite', '').map((item) => item.id)).toEqual(['b']);
  expect(cleanOrder(['gone', 'b', 'b', 'a'], items)).toEqual(['b', 'a']);
  expect(
    shuffled(items, () => 0)
      .map((item) => item.id)
      .sort(),
  ).toEqual(['a', 'b', 'c']);
});
