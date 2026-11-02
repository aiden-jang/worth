import { exerciseAliases } from '../src/shared/activity-plans';
import type { ExerciseEvidence } from '../src/shared/exercise-history';
import type { WorkoutSession } from '../src/shared/models';
import { summarizeWorkout, type HomeProgress } from '../src/shared/workout-summary';

type RecentWorkout = WorkoutSession & { listName: string; aliases: string };
type EvidenceRow = Omit<ExerciseEvidence, 'exercise' | 'exerciseSets'> & {
  exerciseMode: number;
  exerciseSetsJson: string;
  visitCreatedAt: number;
};

export async function readHomeProgress(
  db: D1Database,
  owner: string,
  through: string,
): Promise<HomeProgress | null> {
  const from = new Date(Date.parse(through + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10);
  const workout = await db
    .prepare(
      `SELECT w.id,w.list_id AS listId,w.title,w.happened_on AS happenedOn,
       w.created_at AS createdAt,w.updated_at AS updatedAt,l.name AS listName,l.exercise_aliases AS aliases
     FROM workout_sessions w JOIN active_lists l ON l.id=w.list_id AND l.owner_id=w.owner_id
     WHERE w.owner_id=? AND l.kind='activity' AND l.archived=0
       AND w.status='finished' AND w.happened_on>=? AND w.happened_on<=?
     ORDER BY w.happened_on DESC,w.created_at DESC,w.id DESC LIMIT 1`,
    )
    .bind(owner, from, through)
    .first<RecentWorkout>();
  if (!workout) return null;
  // Keep the complete comparison history, with only fields the shared calculation uses.
  const { results } = await db
    .prepare(
      `SELECT g.id,g.list_id AS listId,g.item_id AS itemId,g.title,g.happened_on AS happenedOn,
       g.created_at AS createdAt,g.workout_id AS workoutId,g.exercise_mode AS exerciseMode,
       g.exercise_sets AS exerciseSetsJson,g.weight_unit AS weightUnit,g.sets,g.reps,
       COALESCE(w.created_at,g.created_at) AS visitCreatedAt
     FROM active_logs g JOIN active_lists l ON l.id=g.list_id AND l.owner_id=g.owner_id
     LEFT JOIN workout_sessions w ON w.id=g.workout_id AND w.owner_id=g.owner_id AND w.list_id=g.list_id
     WHERE g.owner_id=? AND g.list_id=? AND l.archived=0 AND g.item_id IS NULL AND g.happened_on<=?
       AND (g.exercise_mode=1 OR json_array_length(g.exercise_sets)>0 OR g.sets IS NOT NULL OR g.reps IS NOT NULL)`,
    )
    .bind(owner, workout.listId, through)
    .all<EvidenceRow>();
  const visits = results
    .filter((row) => row.workoutId)
    .map((row) => ({ id: row.workoutId!, createdAt: row.visitCreatedAt }));
  const logs: ExerciseEvidence[] = results.map(({ exerciseSetsJson, exerciseMode, ...row }) => ({
    ...row,
    exercise: Boolean(exerciseMode),
    exerciseSets: JSON.parse(exerciseSetsJson || '[]'),
  }));
  const improvement = summarizeWorkout(
    workout,
    logs,
    visits,
    exerciseAliases.parse(JSON.parse(workout.aliases || '[]')),
  ).improvements[0];
  return improvement
    ? {
        ...improvement,
        listId: workout.listId,
        listName: workout.listName,
        workoutId: workout.id,
        workoutTitle: workout.title,
      }
    : null;
}
