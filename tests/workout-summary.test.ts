import { expect, test } from 'vitest';
import { recordedWorkoutTotals, summarizeWorkout } from '../src/shared/workout-summary';
import type { Log, WorkoutSession } from '../src/shared/models';

const workout: WorkoutSession = {
  id: 'visit',
  listId: 'gym',
  title: 'Push',
  happenedOn: '2026-10-30',
  status: 'finished',
  createdAt: 20,
  updatedAt: 20,
};
const entry = (id: string, patch: Partial<Log> = {}): Log => ({
  id,
  listId: 'gym',
  itemId: null,
  title: 'Bench press',
  happenedOn: workout.happenedOn,
  workoutId: workout.id,
  createdAt: 30,
  updatedAt: 30,
  note: '',
  amount: null,
  unit: '',
  sets: null,
  reps: null,
  hasPhoto: false,
  exercise: true,
  exerciseSets: [{ weight: 40, reps: 10 }],
  weightUnit: 'kg',
  ...patch,
});

test('finish totals count only saved entries and keep missing individual sets and reps incomplete', () => {
  expect(recordedWorkoutTotals([])).toMatchObject({ exerciseCount: 0, setCount: 0, reps: null });
  expect(
    recordedWorkoutTotals([entry('a'), entry('b', { exerciseSets: [{ weight: null, reps: 8 }] })]),
  ).toMatchObject({ exerciseCount: 2, setCount: 2, reps: 18 });
  expect(
    recordedWorkoutTotals([entry('a'), entry('legacy', { exerciseSets: [], sets: 3, reps: 8 })]),
  ).toMatchObject({ exerciseCount: 2, setCount: 1, reps: null, entriesWithoutSets: 1 });
  expect(recordedWorkoutTotals([entry('a', { exerciseSets: [{ weight: 0, reps: null }] })]).reps).toBeNull();
  expect(
    summarizeWorkout(
      workout,
      [entry('elsewhere', { listId: 'other' }), entry('other-visit', { workoutId: 'other' })],
      [workout],
    ).exerciseCount,
  ).toBe(0);
});

test('recaps share exact historical comparisons, respect aliases and units, and ignore later entries', () => {
  const logs = [
    entry('prior', {
      title: 'BB press',
      workoutId: null,
      happenedOn: '2026-10-29',
      exerciseSets: [{ weight: 40, reps: 8 }],
    }),
    entry('lb', {
      workoutId: null,
      happenedOn: '2026-10-29',
      weightUnit: 'lb',
      exerciseSets: [{ weight: 40, reps: 30 }],
    }),
    entry('foreign', {
      listId: 'other',
      workoutId: null,
      happenedOn: '2026-10-29',
      exerciseSets: [{ weight: 40, reps: 50 }],
    }),
    entry('current'),
    entry('future', {
      workoutId: 'later',
      happenedOn: '2026-10-31',
      exerciseSets: [{ weight: 40, reps: 100 }],
    }),
    entry('bodyweight', { title: 'Pull-up', exerciseSets: [{ weight: null, reps: 15 }] }),
  ];
  const aliases = [{ id: 'alias', name: 'Bench press', aliases: ['BB press'] }];
  expect(summarizeWorkout(workout, logs, [workout], aliases)).toMatchObject({
    exerciseCount: 2,
    setCount: 2,
    reps: 25,
    improvements: [{ logId: 'current', title: 'Bench press', weight: 40, unit: 'kg', reps: 10, previous: 8 }],
  });
  expect(summarizeWorkout(workout, [entry('current')], [workout]).improvements).toEqual([]);
});
