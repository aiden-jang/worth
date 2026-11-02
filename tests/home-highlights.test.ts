import { expect, test } from 'vitest';
import { initialHomeHighlight } from '../src/shared/home-highlights';
import { preferenceRecordsHref } from '../src/shared/preference-summary';
import type { MemoryRecord, PreferenceGroup } from '../src/shared/memories';
import type { HomeProgress } from '../src/shared/workout-summary';

const memory: MemoryRecord = {
  id: 'find',
  itemId: null,
  listId: null,
  listName: 'Unfiled',
  title: 'A little bookshop',
  note: 'The window seat.',
  date: '2026-10-01',
  kind: 'unfiled',
  location: '',
  order: '',
  reaction: null,
  hasPhoto: true,
};
const group: PreferenceGroup = {
  listId: 'skincare',
  listName: 'Skincare',
  kind: 'brand',
  name: 'Harbor',
  basis: 'records',
  favorite: 4,
  meh: 1,
  notAgain: 0,
  unrated: 3,
};
const progress: HomeProgress = {
  listId: 'gym',
  listName: 'Gym',
  workoutId: 'visit',
  workoutTitle: 'Push day',
  logId: 'entry',
  title: 'Bench press',
  happenedOn: '2026-10-20',
  weight: 40,
  unit: 'kg',
  reps: 10,
  previous: 8,
};

test('daily choices cover real memories, recorded preferences and sourced progress without changing their data', () => {
  const choices = ['2026-10-29', '2026-10-30', '2026-10-31'].map((date) =>
    initialHomeHighlight(date, memory, [group], progress),
  );
  expect(new Set(choices.map((choice) => choice.kind))).toEqual(
    new Set(['memory', 'preference', 'progress']),
  );
  expect(initialHomeHighlight('2026-10-31', memory, [group], progress)).toEqual(choices[2]);
  expect(choices.find((choice) => choice.kind === 'memory')).toEqual({ kind: 'memory', record: memory });
  expect(preferenceRecordsHref(group)).toBe('/patterns/remember?mode=saved&list=skincare&brand=Harbor');
  expect(preferenceRecordsHref({ ...group, basis: 'visits' })).toContain('mode=visits');
  expect(memory.reaction).toBeNull();
});

test('sparse and tied opinions and future workouts do not become Home observations', () => {
  for (const groups of [
    [],
    [{ ...group, favorite: 1, meh: 0 }],
    [{ ...group, favorite: 2, meh: 2 }],
    [{ ...group, favorite: 0, meh: 0 }],
  ]) {
    expect(initialHomeHighlight('2026-10-01', null, groups, progress)).toEqual({
      kind: 'memory',
      record: null,
    });
    expect(initialHomeHighlight('2026-10-01', memory, groups, progress)).toEqual({
      kind: 'memory',
      record: memory,
    });
  }
  const negative = { ...group, favorite: 0, meh: 0, notAgain: 3 };
  expect(initialHomeHighlight('2026-10-31', null, [negative], null)).toEqual({
    kind: 'preference',
    group: negative,
  });
});
