import type { Log, WorkoutSession } from './models';

export function formatActivityMetric(log: Log): string {
  if (log.exerciseSets?.length) {
    const weights = log.exerciseSets.flatMap((set) => (set.weight === null ? [] : [set.weight]));
    const totalReps = log.exerciseSets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
    const low = Math.min(...weights),
      high = Math.max(...weights);
    const weight = weights.length
      ? `${low === high ? low : `${low}–${high}`} ${log.weightUnit ?? 'kg'}${weights.length < log.exerciseSets.length ? ' + bodyweight' : ''}`
      : 'bodyweight';
    return `${log.exerciseSets.length} ${log.exerciseSets.length === 1 ? 'set' : 'sets'} · ${totalReps} ${totalReps === 1 ? 'rep' : 'reps'} · ${weight}`;
  }
  const parts = [];
  if (log.amount !== null) parts.push(`${log.amount}${log.unit ? ` ${log.unit}` : ''}`);
  if (log.sets !== null && log.reps !== null)
    parts.push(
      `${log.sets} ${log.sets === 1 ? 'set' : 'sets'} × ${log.reps} ${log.reps === 1 ? 'rep' : 'reps'}`,
    );
  return parts.join(' · ');
}

export function previousExercise(
  logs: Log[],
  options: {
    title: string;
    happenedOn: string;
    excludeId?: string;
    workoutId?: string | null;
    beforeCreatedAt?: number;
    workouts?: WorkoutSession[];
  },
): Log | null {
  const name = options.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (!name) return null;
  const visitTimes = new Map(options.workouts?.map((workout) => [workout.id, workout.createdAt]) ?? []);
  const visitTime = (log: Log) =>
    (log.workoutId ? visitTimes.get(log.workoutId) : undefined) ?? log.createdAt;
  return (
    logs
      .filter(
        (log) =>
          log.id !== options.excludeId &&
          (!options.workoutId || log.workoutId !== options.workoutId) &&
          log.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === name &&
          (log.exerciseSets?.length || log.sets || log.reps) &&
          log.happenedOn <= options.happenedOn &&
          (log.happenedOn < options.happenedOn || visitTime(log) < (options.beforeCreatedAt ?? Infinity)),
      )
      .sort(
        (a, b) =>
          b.happenedOn.localeCompare(a.happenedOn) ||
          visitTime(b) - visitTime(a) ||
          b.createdAt - a.createdAt ||
          b.id.localeCompare(a.id),
      )[0] ?? null
  );
}
