import { expect, test } from 'vitest';
import type { Log } from '../src/shared/models';
import {
  exerciseDirectory,
  exerciseHistory,
  exerciseValue,
  exerciseRepRecords,
  exerciseImprovement,
} from '../src/shared/exercise-history';
const entry = (id: string, extra: Partial<Log> = {}): Log => ({
  id,
  listId: 'gym',
  title: 'Bench press',
  itemId: null,
  happenedOn: '2026-10-10',
  createdAt: 1,
  updatedAt: 1,
  note: '',
  amount: null,
  unit: '',
  sets: null,
  reps: null,
  hasPhoto: false,
  exerciseSets: [
    { reps: 10, weight: 40 },
    { reps: 8, weight: 45 },
  ],
  weightUnit: 'kg',
  ...extra,
});

test('volume requires complete weighted sets and never treats bodyweight or missing reps as zero', () => {
  expect(exerciseValue(entry('a'), 'volume:kg')).toBe(760);
  expect(exerciseValue(entry('a'), 'volume:lb')).toBeNull();
  expect(
    exerciseValue(
      entry('a', {
        exerciseSets: [
          { weight: null, reps: 8 },
          { weight: 40, reps: 8 },
        ],
      }),
      'volume:kg',
    ),
  ).toBeNull();
  expect(exerciseValue(entry('a', { exerciseSets: [{ weight: 0, reps: 8 }] }), 'volume:kg')).toBe(0);
});

test('rep records preserve units and recognize more reps at the same weight without estimated lifts', () => {
  const logs = [
    entry('earlier', { exerciseSets: [{ weight: 40, reps: 8 }] }),
    entry('other-unit', { weightUnit: 'lb', exerciseSets: [{ weight: 40, reps: 30 }] }),
    entry('later', { exerciseSets: [{ weight: 40, reps: 10 }] }),
  ];
  expect(exerciseImprovement(logs)).toEqual({ weight: 40, reps: 10, previous: 8, unit: 'kg' });
  expect(exerciseImprovement([logs[2]])).toBeNull();
  expect(exerciseRepRecords(logs, 'kg').map((r) => [r.reps, r.weight, r.logId])).toEqual([
    [8, 40, 'earlier'],
    [10, 40, 'later'],
  ]);
  expect(exerciseRepRecords(logs, 'lb')).toHaveLength(1);
  expect(exerciseImprovement([logs[2], logs[0]])).toBeNull();
});

test('history groups normalized names only within the current list and orders separate visits', () => {
  const visits = [
    { id: 'early', listId: 'gym', title: 'Early', happenedOn: '2026-10-10', createdAt: 10, updatedAt: 10 },
    { id: 'late', listId: 'gym', title: 'Late', happenedOn: '2026-10-10', createdAt: 20, updatedAt: 20 },
  ];
  const logs = [
    entry('late', { workoutId: 'late', createdAt: 30 }),
    entry('early', { title: ' BENCH   Press ', workoutId: 'early', createdAt: 40 }),
    entry('prior', { happenedOn: '2026-10-09' }),
    entry('other-list', { listId: 'other' }),
    entry('item-revisit', { itemId: 'item' }),
    entry('ordinary', { exerciseSets: [], sets: null, reps: null }),
    entry('squat', { title: 'Squat' }),
  ];
  expect(exerciseHistory(logs, 'gym', ' bench press ', visits).map((log) => log.id)).toEqual([
    'prior',
    'early',
    'late',
  ]);
  expect(exerciseHistory(logs, 'gym', '')).toEqual([]);
  expect(logs[0].id).toBe('late');
});

test('weight charts keep units separate, leave bodyweight gaps, and preserve zero', () => {
  expect(exerciseValue(entry('kg'), 'kg')).toBe(45);
  expect(exerciseValue(entry('kg'), 'lb')).toBeNull();
  expect(exerciseValue(entry('lb', { weightUnit: 'lb' }), 'lb')).toBe(45);
  expect(exerciseValue(entry('body', { exerciseSets: [{ reps: 12, weight: null }] }), 'kg')).toBeNull();
  expect(
    exerciseValue(
      entry('zero', {
        exerciseSets: [
          { reps: 12, weight: null },
          { reps: 8, weight: 0 },
        ],
      }),
      'kg',
    ),
  ).toBe(0);
  expect(
    exerciseValue(
      entry('mixed', {
        exerciseSets: [
          { reps: 12, weight: null },
          { reps: 8, weight: 10 },
        ],
      }),
      'kg',
    ),
  ).toBe(10);
});

test('reps sum only individually recorded sets, leaving legacy measurements unplotted', () => {
  expect(exerciseValue(entry('sets'), 'reps')).toBe(18);
  const legacy = entry('legacy', { exerciseSets: [], sets: 3, reps: 8, amount: 50, unit: 'kg' });
  expect(exerciseValue(legacy, 'reps')).toBeNull();
  expect(exerciseValue(legacy, 'kg')).toBeNull();
  expect(exerciseHistory([legacy], 'gym', 'Bench press')).toEqual([legacy]);
});

test('directory counts saved entries and uses the latest name spelling without unrelated records', () => {
  const logs = [
    entry('old', { happenedOn: '2026-09-01' }),
    entry('latest', { title: 'Bench Press' }),
    entry('squat', { title: 'Squat', happenedOn: '2026-10-09' }),
    entry('other', { listId: 'other' }),
    entry('walk', { title: 'Walk', exerciseSets: [] }),
  ];
  expect(exerciseDirectory(logs, 'gym')).toEqual([
    { title: 'Bench Press', count: 2, lastDate: '2026-10-10' },
    { title: 'Squat', count: 1, lastDate: '2026-10-09' },
  ]);
  expect(exerciseDirectory([], 'gym')).toEqual([]);
});
