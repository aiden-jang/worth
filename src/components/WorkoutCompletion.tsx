import { X } from '@phosphor-icons/react';
import type { Ref } from 'react';
import type { Log, WorkoutSession } from '../shared/models';
import type { ExerciseAlias } from '../shared/activity-plans';
import { summarizeWorkout } from '../shared/workout-summary';
import { formatDate } from '../format';
import { ActivityIllustration } from './ActivityIllustration';

export function WorkoutCompletion({
  workout,
  logs,
  workouts,
  aliases,
  headingRef,
  onDismiss,
  onReview,
  onHistory,
}: {
  workout: WorkoutSession;
  logs: Log[];
  workouts: WorkoutSession[];
  aliases: ExerciseAlias[];
  headingRef: Ref<HTMLHeadingElement>;
  onDismiss: () => void;
  onReview: () => void;
  onHistory: (title: string) => void;
}) {
  const summary = summarizeWorkout(workout, logs, workouts, aliases);
  const id = `workout-finished-${workout.id}`;
  return (
    <section className="workout-completion" aria-labelledby={id}>
      <header>
        <div>
          <h2 ref={headingRef} id={id} tabIndex={-1}>
            Workout finished.
          </h2>
          <p>
            {workout.title} · {formatDate(workout.happenedOn)}
          </p>
        </div>
        <ActivityIllustration kind="workout" />
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss workout summary"
          onClick={onDismiss}
        >
          <X size={20} />
        </button>
      </header>
      <dl className="workout-completion-totals">
        <div>
          <dt>Exercises logged</dt>
          <dd>{summary.exerciseCount}</dd>
        </div>
        <div>
          <dt>Individual sets</dt>
          <dd>{summary.setCount}</dd>
        </div>
        <div>
          <dt>Recorded reps</dt>
          <dd>{summary.reps ?? '—'}</dd>
        </div>
      </dl>
      {summary.reps === null && summary.exerciseCount > 0 && (
        <p className="exercise-helper">Some individual sets or rep counts weren’t recorded.</p>
      )}
      {!summary.exerciseCount && <p>No exercise entries were recorded for this visit.</p>}
      {!!summary.improvements.length && (
        <div className="workout-completion-progress">
          <h3>From your saved sets</h3>
          {summary.improvements.slice(0, 3).map((value) => (
            <div key={`${value.logId}:${value.weight}:${value.unit}`}>
              <strong>{value.title}</strong>
              <p>
                {value.weight} {value.unit} × {value.reps} reps · Previous recorded best at this weight:{' '}
                {value.previous} reps.
              </p>
              <button
                type="button"
                className="button button-outline"
                aria-label={`View progress for ${value.title}`}
                onClick={() => onHistory(value.title)}
              >
                View progress
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="button button-outline" onClick={onReview}>
        Review workout
      </button>
    </section>
  );
}
