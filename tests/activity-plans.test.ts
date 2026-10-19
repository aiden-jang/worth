import { expect, test } from 'vitest';
import {
  activityMeasurements,
  exerciseAliases,
  exerciseKey,
  routineTargets,
  blankRoutineTarget,
  validRoutineTargets,
  planEditorDraft,
} from '../src/shared/activity-plans';
import {
  exerciseDirectory,
  exerciseHistory,
  exerciseValue,
  measurementChoices,
} from '../src/shared/exercise-history';
import { formatActivityMetric, previousExercise } from '../src/shared/workouts';
import { archiveFile } from '../src/shared/portability';
import type { Log } from '../src/shared/models';
const listId = '11111111-1111-4111-8111-111111111111';
const entry = (id: string, extra: Partial<Log> = {}): Log => ({
  id,
  listId,
  itemId: null,
  title: 'Jog',
  exercise: true,
  happenedOn: '2026-10-01',
  note: '',
  amount: null,
  unit: '',
  sets: null,
  reps: null,
  exerciseSets: [],
  measurements: [],
  hasPhoto: false,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const aliases = [{ id: '22222222-2222-4222-8222-222222222222', name: 'Run', aliases: ['Jog', 'Easy run'] }];
test('activity plans keep target units explicit, bounded and separate from draft validation', () => {
  const target = blankRoutineTarget('Run');
  expect(target.sets).toBeNull();
  expect(target.weight).toBeNull();
  expect(
    routineTargets.parse([{ ...target, durationSeconds: 0, weight: 0, weightUnit: 'lb' }])[0].durationSeconds,
  ).toBe(0);
  expect(validRoutineTargets(['  RUN '], [target])).toBe(true);
  expect(validRoutineTargets(['Walk'], [target])).toBe(false);
  expect(routineTargets.safeParse([target, { ...target, exercise: ' RUN ' }]).success).toBe(false);
  expect(routineTargets.safeParse([{ ...target, reps: 0 }]).success).toBe(false);
  expect(
    planEditorDraft.safeParse({
      title: 'Draft',
      exercises: 'Run',
      happenedOn: '2026-10-01',
      targets: [{ ...target, reps: 0 }],
      revision: 0,
      frozen: false,
    }).success,
  ).toBe(true);
  expect(
    planEditorDraft.safeParse({ title: 'Older draft', exercises: 'Run', happenedOn: '2026-10-01' }).success,
  ).toBe(true);
});
test('activity aliases reject overlapping names and never rewrite original history or workout completion', () => {
  expect(exerciseKey('  EASY   Run ')).toBe('easy run');
  expect(
    exerciseAliases.safeParse([
      ...aliases,
      { id: crypto.randomUUID(), name: 'Other', aliases: [' EASY  RUN '] },
    ]).success,
  ).toBe(false);
  expect(exerciseAliases.safeParse([{ ...aliases[0], aliases: ['RUN'] }]).success).toBe(false);
  const logs = [
    entry('one'),
    entry('two', { title: 'Easy run', createdAt: 2 }),
    entry('other', { listId: 'another' }),
    entry('ordinary', { exercise: false, title: 'Run' }),
  ];
  const original = structuredClone(logs);
  expect(exerciseHistory(logs, listId, 'Run', [], aliases).map((log) => log.id)).toEqual(['one', 'two']);
  expect(exerciseDirectory(logs, listId, aliases)).toMatchObject([
    { title: 'Run', count: 2, lastDate: '2026-10-01' },
  ]);
  expect(exerciseHistory(logs, listId, 'Run')).toEqual([]);
  expect(previousExercise(logs, { title: 'Run', happenedOn: '2026-10-02', aliases })?.id).toBe('two');
  expect(logs).toEqual(original);
});
test('activity measurements keep negative and zero values, missing values and distinct literal units', () => {
  expect(activityMeasurements.parse([{ name: 'Duration', value: 0, unit: 'seconds' }])[0].value).toBe(0);
  expect(activityMeasurements.safeParse([{ name: 'Duration', value: NaN, unit: '' }]).success).toBe(false);
  expect(
    activityMeasurements.safeParse([
      { name: 'Duration', value: 1, unit: '' },
      { name: ' DURATION ', value: 2, unit: '' },
    ]).success,
  ).toBe(false);
  const a = entry('a', {
      measurements: [
        { name: 'Distance', value: 0, unit: 'km' },
        { name: 'Elevation', value: -4, unit: 'm' },
      ],
    }),
    b = entry('b', { measurements: [{ name: 'Distance', value: 2, unit: 'mi' }] });
  const choices = measurementChoices([a, b]);
  expect(choices).toHaveLength(3);
  expect(exerciseValue(a, choices[0].key)).toBe(0);
  expect(exerciseValue(b, choices[0].key)).toBeNull();
  expect(exerciseValue(a, choices[1].key)).toBe(-4);
  expect(exerciseValue(a, 'reps')).toBeNull();
  expect(exerciseValue(a, 'kg')).toBeNull();
  expect(formatActivityMetric(a)).toBe('Distance: 0 km · Elevation: -4 m');
  expect(
    exerciseValue(entry('partial', { exerciseSets: [{ reps: null, weight: null }] }), 'reps'),
  ).toBeNull();
});
test('activity backup version eight validates plan names and keeps earlier versions usable', () => {
  const base = {
    schemaVersion: 8,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [
      {
        id: listId,
        name: 'Training',
        description: '',
        kind: 'activity',
        rankedIds: [],
        updatedAt: 1,
        exerciseAliases: aliases,
      },
    ],
    items: [],
    logs: [],
    workoutRoutines: [
      {
        id: crypto.randomUUID(),
        listId,
        title: 'Short run',
        exercises: ['Run'],
        targets: [{ ...blankRoutineTarget('Run'), durationSeconds: 600 }],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  };
  expect(archiveFile.parse(base).workoutRoutines[0].targets[0].durationSeconds).toBe(600);
  expect(archiveFile.safeParse({ ...base, schemaVersion: 7 }).success).toBe(false);
  expect(
    archiveFile.safeParse({ ...base, workoutRoutines: [{ ...base.workoutRoutines[0], exercises: ['Walk'] }] })
      .success,
  ).toBe(false);
  const older = archiveFile.parse({
    schemaVersion: 1,
    exportedAt: base.exportedAt,
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
  });
  expect(older.workoutRoutines).toEqual([]);
});
