import type { Log, WorkoutSession } from './models';
import { exerciseKey, exerciseGroup, exerciseGroupKey, type ExerciseAlias } from './activity-plans';

const isExerciseEntry = (log: Log): boolean =>
  !log.itemId && Boolean(log.exercise || log.exerciseSets?.length || log.sets || log.reps);

export function exerciseHistory(
  logs: Log[],
  listId: string,
  title: string,
  workouts: WorkoutSession[] = [],
  aliases: ExerciseAlias[] = [],
): Log[] {
  const name = exerciseGroupKey(title, aliases);
  if (!exerciseKey(title)) return [];
  const visits = new Map(workouts.map((workout) => [workout.id, workout.createdAt]));
  const visitTime = (log: Log) => (log.workoutId ? visits.get(log.workoutId) : undefined) ?? log.createdAt;
  return logs
    .filter(
      (log) => log.listId === listId && isExerciseEntry(log) && exerciseGroupKey(log.title, aliases) === name,
    )
    .sort(
      (a, b) =>
        a.happenedOn.localeCompare(b.happenedOn) ||
        visitTime(a) - visitTime(b) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}

export type ExerciseMetric = 'reps' | 'kg' | 'lb' | `measurement:${string}`;
const measurementKey = (name: string, unit: string): ExerciseMetric =>
  `measurement:${JSON.stringify([exerciseKey(name), unit])}`;
export function measurementChoices(logs: Log[]): { key: ExerciseMetric; label: string; unit: string }[] {
  const choices = new Map<ExerciseMetric, { key: ExerciseMetric; label: string; unit: string }>();
  for (const log of logs)
    for (const measurement of log.measurements ?? []) {
      const key = measurementKey(measurement.name, measurement.unit);
      choices.set(key, {
        key,
        label: `${measurement.name}${measurement.unit ? ` · ${measurement.unit}` : ''}`,
        unit: measurement.unit,
      });
    }
  return [...choices.values()];
}
export function exerciseValue(log: Log, metric: ExerciseMetric): number | null {
  if (metric.startsWith('measurement:'))
    return (
      log.measurements?.find((value) => measurementKey(value.name, value.unit) === metric)?.value ?? null
    );
  if (!log.exerciseSets?.length) return null;
  if (metric === 'reps')
    return log.exerciseSets.every((set) => set.reps !== null)
      ? log.exerciseSets.reduce((sum, set) => sum + set.reps!, 0)
      : null;
  if ((log.weightUnit ?? 'kg') !== metric) return null;
  const weights = log.exerciseSets.flatMap((set) => (set.weight === null ? [] : [set.weight]));
  return weights.length ? Math.max(...weights) : null;
}

export function exerciseDirectory(
  logs: Log[],
  listId: string,
  aliases: ExerciseAlias[] = [],
): { title: string; count: number; lastDate: string }[] {
  const groups = new Map<string, { title: string; count: number; lastDate: string; createdAt: number }>();
  for (const log of logs) {
    if (log.listId !== listId || !isExerciseEntry(log) || !exerciseKey(log.title)) continue;
    const key = exerciseGroupKey(log.title, aliases),
      prior = groups.get(key);
    if (!prior)
      groups.set(key, {
        title: exerciseGroup(log.title, aliases)?.name ?? log.title,
        count: 1,
        lastDate: log.happenedOn,
        createdAt: log.createdAt,
      });
    else {
      prior.count++;
      if (
        log.happenedOn > prior.lastDate ||
        (log.happenedOn === prior.lastDate && log.createdAt > prior.createdAt)
      ) {
        prior.title = exerciseGroup(log.title, aliases)?.name ?? log.title;
        prior.lastDate = log.happenedOn;
        prior.createdAt = log.createdAt;
      }
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.title.localeCompare(b.title))
    .map(({ title, count, lastDate }) => ({ title, count, lastDate }));
}
