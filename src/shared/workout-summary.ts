import { exerciseHistory, exerciseImprovement, type ExerciseEvidence } from './exercise-history';
import { exerciseGroupKey, type ExerciseAlias } from './activity-plans';
import type { Log, WorkoutSession } from './models';

export type RecordedImprovement = NonNullable<ReturnType<typeof exerciseImprovement>> & {
  logId: string;
  title: string;
  happenedOn: string;
};

export interface HomeProgress extends RecordedImprovement {
  listId: string;
  listName: string;
  workoutId: string;
  workoutTitle: string;
}

export function recordedWorkoutTotals(entries: Pick<Log, 'exerciseSets'>[]) {
  const sets = entries.flatMap((log) => log.exerciseSets ?? []);
  const entriesWithoutSets = entries.filter((log) => !log.exerciseSets?.length).length;
  return {
    exerciseCount: entries.length,
    setCount: sets.length,
    reps:
      sets.length && !entriesWithoutSets && sets.every((set) => set.reps !== null)
        ? sets.reduce((sum, set) => sum + set.reps!, 0)
        : null,
    entriesWithoutSets,
  };
}

export function summarizeWorkout(
  workout: WorkoutSession,
  logs: ExerciseEvidence[],
  workouts: Pick<WorkoutSession, 'id' | 'createdAt'>[],
  aliases: ExerciseAlias[] = [],
) {
  const entries = logs
    .filter((log) => log.listId === workout.listId && log.workoutId === workout.id && !log.itemId)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const improvements = new Map<string, RecordedImprovement>();
  const histories = new Map<string, ExerciseEvidence[]>();
  for (const entry of entries) {
    if (!entry.exerciseSets?.length) continue;
    const key = exerciseGroupKey(entry.title, aliases);
    let history = histories.get(key);
    if (!history) {
      history = exerciseHistory(logs, workout.listId, entry.title, workouts, aliases);
      histories.set(key, history);
    }
    const index = history.findIndex((log) => log.id === entry.id);
    if (index < 0) continue;
    const improvement = exerciseImprovement(history.slice(0, index + 1));
    if (!improvement) continue;
    const comparison = `${key}:${improvement.unit}:${improvement.weight}`;
    const previous = improvements.get(comparison);
    if (!previous || improvement.reps > previous.reps)
      improvements.set(comparison, {
        ...improvement,
        logId: entry.id,
        title: entry.title,
        happenedOn: entry.happenedOn,
      });
  }
  return {
    ...recordedWorkoutTotals(entries),
    improvements: [...improvements.values()],
  };
}
