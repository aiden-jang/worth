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

export type ExerciseMetric = 'reps' | 'kg' | 'lb' | 'volume:kg' | 'volume:lb' | `measurement:${string}`;
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
  if (metric === 'volume:kg' || metric === 'volume:lb') {
    if (
      (log.weightUnit ?? 'kg') !== metric.slice(7) ||
      log.exerciseSets.some((set) => set.weight === null || set.reps === null)
    )
      return null;
    return log.exerciseSets.reduce((total, set) => total + set.weight! * set.reps!, 0);
  }
  if (metric === 'reps')
    return log.exerciseSets.every((set) => set.reps !== null)
      ? log.exerciseSets.reduce((sum, set) => sum + set.reps!, 0)
      : null;
  if ((log.weightUnit ?? 'kg') !== metric) return null;
  const weights = log.exerciseSets.flatMap((set) => (set.weight === null ? [] : [set.weight]));
  return weights.length ? Math.max(...weights) : null;
}

export function exerciseRepRecords(logs: Log[], unit: 'kg' | 'lb') {
  const best = new Map<number, { reps: number; weight: number; date: string; logId: string }>();
  for (const log of logs) {
    if ((log.weightUnit ?? 'kg') !== unit) continue;
    for (const set of log.exerciseSets ?? []) {
      if (set.weight === null || set.reps === null) continue;
      const old = best.get(set.reps);
      if (!old || set.weight > old.weight)
        best.set(set.reps, { reps: set.reps, weight: set.weight, date: log.happenedOn, logId: log.id });
    }
  }
  return [...best.values()].sort((a, b) => a.reps - b.reps);
}

export function exerciseImprovement(logs: Log[]) {
  const latest = logs.at(-1);
  if (!latest) return null;
  const unit = latest.weightUnit ?? 'kg';
  for (const set of latest.exerciseSets ?? []) {
    if (set.weight === null || set.reps === null) continue;
    const previous = logs
      .slice(0, -1)
      .filter((log) => (log.weightUnit ?? 'kg') === unit)
      .flatMap((log) => log.exerciseSets ?? [])
      .filter((old) => old.weight === set.weight && old.reps !== null)
      .map((old) => old.reps!);
    if (previous.length && set.reps > Math.max(...previous))
      return { weight: set.weight, reps: set.reps, previous: Math.max(...previous), unit };
  }
  return null;
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
