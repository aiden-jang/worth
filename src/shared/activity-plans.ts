import { z } from 'zod';

export const exerciseKey = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
const name = z.string().trim().min(1).max(120);
const number = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const measurement = z
  .object({
    name: z.string().trim().min(1).max(40),
    value: number,
    unit: z.string().trim().max(24).default(''),
  })
  .strict();
export const activityMeasurements = z
  .array(measurement)
  .max(12)
  .refine(
    (values) => new Set(values.map((value) => exerciseKey(value.name))).size === values.length,
    'Use each measurement name once',
  );
export type ActivityMeasurement = z.infer<typeof measurement>;
export const measurementDrafts = z
  .array(
    measurement.extend({
      name: z.string().max(40),
      value: z.number().finite().nullable(),
      unit: z.string().max(24),
    }),
  )
  .max(12);
export type MeasurementDraft = z.infer<typeof measurementDrafts>[number];
const count = (max: number) => z.number().int().positive().max(max).nullable().default(null);
const quantity = (max: number) => z.number().finite().nonnegative().max(max).nullable().default(null);
const routineTarget = z
  .object({
    exercise: name,
    sets: count(100),
    reps: count(10000),
    weight: quantity(100000),
    weightUnit: z.enum(['kg', 'lb']).default('kg'),
    restSeconds: z.number().int().nonnegative().max(86400).nullable().default(null),
    durationSeconds: quantity(86400),
    distance: quantity(1000000),
    distanceUnit: z.enum(['m', 'km', 'mi']).default('km'),
    note: z.string().trim().max(300).default(''),
  })
  .strict();
export const routineTargets = z
  .array(routineTarget)
  .max(40)
  .refine(
    (values) => new Set(values.map((value) => exerciseKey(value.exercise))).size === values.length,
    'Use one target plan per exercise',
  );
export type RoutineTarget = z.infer<typeof routineTarget>;
export function validRoutineTargets(exercises: readonly string[], targets: readonly RoutineTarget[]) {
  const keys = new Set(exercises.map(exerciseKey));
  return targets.every((target) => keys.has(exerciseKey(target.exercise)));
}
export function blankRoutineTarget(exercise: string): RoutineTarget {
  return routineTarget.parse({ exercise });
}
export function targetSummary(target: RoutineTarget): string {
  const parts: string[] = [];
  if (target.sets !== null) parts.push(`${target.sets} sets`);
  if (target.reps !== null) parts.push(`${target.reps} reps`);
  if (target.weight !== null) parts.push(`${target.weight} ${target.weightUnit}`);
  if (target.durationSeconds !== null) parts.push(`${target.durationSeconds}s duration`);
  if (target.distance !== null) parts.push(`${target.distance} ${target.distanceUnit}`);
  if (target.restSeconds !== null) parts.push(`${target.restSeconds}s rest`);
  return parts.join(' · ');
}
export const exerciseAliases = z
  .array(
    z
      .object({
        id: z.string().uuid(),
        name,
        aliases: z.array(name).min(1).max(8),
      })
      .strict(),
  )
  .max(30)
  .superRefine((groups, context) => {
    const names = new Set<string>(),
      ids = new Set<string>();
    for (const group of groups) {
      if (ids.has(group.id)) context.addIssue({ code: 'custom', message: 'Use each alias group once' });
      ids.add(group.id);
      for (const title of [group.name, ...group.aliases]) {
        const key = exerciseKey(title);
        if (names.has(key))
          context.addIssue({
            code: 'custom',
            message: 'Each name can belong to one group. Case and repeated spaces already match.',
          });
        names.add(key);
      }
    }
  });
export type ExerciseAlias = z.infer<typeof exerciseAliases>[number];
export type ExerciseAliases = { revision: number; groups: ExerciseAlias[] };
export const planEditorDraft = z
  .object({
    title: z.string().max(80),
    exercises: z.string().max(5000),
    happenedOn: z.string().max(10),
    targets: z
      .array(
        routineTarget.extend({
          sets: z.number().finite().nullable(),
          reps: z.number().finite().nullable(),
          weight: z.number().finite().nullable(),
          restSeconds: z.number().finite().nullable(),
          durationSeconds: z.number().finite().nullable(),
          distance: z.number().finite().nullable(),
        }),
      )
      .max(40),
    revision: z.number().int().nonnegative(),
    frozen: z.boolean(),
  })
  .partial({ targets: true, revision: true, frozen: true });
export const aliasInput = z
  .object({ expectedRevision: z.number().int().nonnegative(), groups: exerciseAliases })
  .strict();
export function exerciseGroup(title: string, groups: readonly ExerciseAlias[] = []) {
  const key = exerciseKey(title);
  return groups.find((group) => [group.name, ...group.aliases].some((alias) => exerciseKey(alias) === key));
}
export function exerciseGroupKey(title: string, groups: readonly ExerciseAlias[] = []) {
  const group = exerciseGroup(title, groups);
  return group ? `alias:${group.id}` : `name:${exerciseKey(title)}`;
}
