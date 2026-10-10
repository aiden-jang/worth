import type { Log, WorkoutSession } from './models';

export const exerciseNameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const isExerciseEntry = (log: Log): boolean =>
  !log.itemId && Boolean(log.exerciseSets?.length || log.sets || log.reps);

export function exerciseHistory(
  logs: Log[],
  listId: string,
  title: string,
  workouts: WorkoutSession[] = [],
): Log[] {
  const name = exerciseNameKey(title);
  if (!name) return [];
  const visits = new Map(workouts.map((workout) => [workout.id, workout.createdAt]));
  const visitTime = (log: Log) => (log.workoutId ? visits.get(log.workoutId) : undefined) ?? log.createdAt;
  return logs
    .filter((log) => log.listId === listId && isExerciseEntry(log) && exerciseNameKey(log.title) === name)
    .sort(
      (a, b) =>
        a.happenedOn.localeCompare(b.happenedOn) ||
        visitTime(a) - visitTime(b) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}

export type ExerciseMetric = 'reps' | 'kg' | 'lb';
export function exerciseValue(log: Log, metric: ExerciseMetric): number | null {
  if (!log.exerciseSets?.length) return null;
  if (metric === 'reps') return log.exerciseSets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  if ((log.weightUnit ?? 'kg') !== metric) return null;
  const weights = log.exerciseSets.flatMap((set) => (set.weight === null ? [] : [set.weight]));
  return weights.length ? Math.max(...weights) : null;
}

export function exerciseDirectory(
  logs: Log[],
  listId: string,
): { title: string; count: number; lastDate: string }[] {
  const groups = new Map<string, { title: string; count: number; lastDate: string; createdAt: number }>();
  for (const log of logs) {
    if (log.listId !== listId || !isExerciseEntry(log) || !exerciseNameKey(log.title)) continue;
    const key = exerciseNameKey(log.title),
      prior = groups.get(key);
    if (!prior)
      groups.set(key, { title: log.title, count: 1, lastDate: log.happenedOn, createdAt: log.createdAt });
    else {
      prior.count++;
      if (
        log.happenedOn > prior.lastDate ||
        (log.happenedOn === prior.lastDate && log.createdAt > prior.createdAt)
      ) {
        prior.title = log.title;
        prior.lastDate = log.happenedOn;
        prior.createdAt = log.createdAt;
      }
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.title.localeCompare(b.title))
    .map(({ title, count, lastDate }) => ({ title, count, lastDate }));
}
