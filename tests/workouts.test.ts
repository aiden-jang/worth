import { expect, test } from 'vitest';
import type { Log } from '../src/shared/models';
import { previousExercise } from '../src/shared/workouts';
const log = (id: string, happenedOn: string, createdAt: number, extra: Partial<Log> = {}): Log => ({
  id,
  listId: 'gym',
  itemId: null,
  title: 'Bench press',
  happenedOn,
  createdAt,
  updatedAt: createdAt,
  note: '',
  amount: null,
  unit: '',
  sets: null,
  reps: null,
  hasPhoto: false,
  exerciseSets: [{ reps: 8, weight: 45 }],
  weightUnit: 'lb',
  ...extra,
});

test('previous exercise respects the visit, date and editing chronology', () => {
  const entries = [
    log('earlier', '2026-10-07', 10),
    log('same-day-earlier', '2026-10-10', 20),
    log('current-visit', '2026-10-10', 35, { workoutId: 'current' }),
    log('same-day-later', '2026-10-10', 60),
    log('future', '2026-10-11', 80),
    log('unrelated', '2026-10-10', 25, { title: 'Squat' }),
  ];
  const result = previousExercise(entries, {
    title: '  BENCH   press ',
    happenedOn: '2026-10-10',
    workoutId: 'current',
    beforeCreatedAt: 30,
  });
  expect(result?.id).toBe('same-day-earlier');
  expect(result?.weightUnit).toBe('lb');
  expect(
    previousExercise(entries, { title: 'Bench press', happenedOn: '2026-10-07', excludeId: 'earlier' }),
  ).toBeNull();
  expect(previousExercise(entries, { title: '', happenedOn: '2026-10-10' })).toBeNull();
});

test('previous exercise keeps bodyweight and zero weight and supports legacy set records', () => {
  const bodyweight = log('bodyweight', '2026-10-09', 10, {
    exerciseSets: [
      { reps: 8, weight: null },
      { reps: 5, weight: 0 },
    ],
  });
  expect(
    previousExercise([bodyweight], { title: 'bench press', happenedOn: '2026-10-10' })?.exerciseSets,
  ).toEqual([
    { reps: 8, weight: null },
    { reps: 5, weight: 0 },
  ]);
  const legacy = log('legacy', '2026-10-08', 8, { exerciseSets: [], sets: 3, reps: 8 });
  const ordinary = log('ordinary', '2026-10-09', 9, { exerciseSets: [], sets: null, reps: null });
  expect(previousExercise([legacy, ordinary], { title: 'Bench press', happenedOn: '2026-10-10' })?.id).toBe(
    'legacy',
  );
});

test('same-day visit order follows the visit even if its sets were entered later', () => {
  const workouts = [
    {
      id: 'morning',
      listId: 'gym',
      title: 'Morning',
      happenedOn: '2026-10-10',
      createdAt: 20,
      updatedAt: 20,
    },
    {
      id: 'evening',
      listId: 'gym',
      title: 'Evening',
      happenedOn: '2026-10-10',
      createdAt: 40,
      updatedAt: 40,
    },
  ];
  const entries = [
    log('morning-entry', '2026-10-10', 80, { workoutId: 'morning' }),
    log('evening-entry', '2026-10-10', 60, { workoutId: 'evening' }),
  ];
  expect(
    previousExercise(entries, {
      title: 'Bench press',
      happenedOn: '2026-10-10',
      workoutId: 'current',
      beforeCreatedAt: 30,
      workouts,
    })?.id,
  ).toBe('morning-entry');
});
