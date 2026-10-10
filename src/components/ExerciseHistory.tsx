import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, X } from '@phosphor-icons/react';
import type { Log, WorkoutSession } from '../shared/models';
import {
  exerciseDirectory,
  exerciseHistory,
  exerciseValue,
  type ExerciseMetric,
} from '../shared/exercise-history';
import { formatActivityMetric } from '../shared/workouts';
import { formatDate } from '../format';

export function ExerciseDirectory({
  logs,
  listId,
  onOpen,
}: {
  logs: Log[];
  listId: string;
  onOpen: (title: string) => void;
}) {
  const exercises = exerciseDirectory(logs, listId);
  if (!exercises.length) return null;
  return (
    <details className="exercise-directory">
      <summary>
        Exercise history{' '}
        <span>
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </summary>
      <div className="workout-exercises">
        {exercises.map((exercise) => (
          <button
            type="button"
            key={exercise.title}
            onClick={() => onOpen(exercise.title)}
            aria-label={`View history for ${exercise.title}`}
          >
            <span>
              <strong>{exercise.title}</strong>
              <small>
                {exercise.count} {exercise.count === 1 ? 'entry' : 'entries'} · Last{' '}
                {formatDate(exercise.lastDate)}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
        ))}
      </div>
    </details>
  );
}

export function ExerciseHistory({
  logs,
  workouts,
  listId,
  title,
  onClose,
}: {
  logs: Log[];
  workouts: WorkoutSession[];
  listId: string;
  title: string;
  onClose: () => void;
}) {
  const entries = exerciseHistory(logs, listId, title, workouts);
  const units = (['kg', 'lb'] as const).filter((unit) =>
    entries.some((log) => exerciseValue(log, unit) !== null),
  );
  const latestWeighted = [...entries]
    .reverse()
    .find((log) => exerciseValue(log, log.weightUnit ?? 'kg') !== null);
  const [metricChoice, setMetric] = useState<ExerciseMetric>(
    latestWeighted?.weightUnit ?? (latestWeighted ? 'kg' : 'reps'),
  );
  const metric = metricChoice === 'reps' || units.includes(metricChoice) ? metricChoice : 'reps';
  const dialog = useRef<HTMLDialogElement>(null),
    headingId = useId(),
    chartId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const values = entries.map((log) => exerciseValue(log, metric));
  const numeric = values.filter((value): value is number => value !== null);
  const max = Math.max(1, ...numeric);
  const x = (index: number) => (entries.length === 1 ? 50 : 4 + (index / (entries.length - 1)) * 92);
  const y = (value: number) => 90 - (value / max) * 80;
  const paths: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length) paths.push(current.join(' '));
      current = [];
    } else current.push(`${x(index)},${y(value)}`);
  });
  if (current.length) paths.push(current.join(' '));
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  function select(log: Log) {
    setSelectedId(log.id);
    requestAnimationFrame(() => {
      const entry = document.getElementById(`${chartId}-${log.id}`);
      entry?.focus({ preventScroll: true });
      entry?.scrollIntoView({
        block: 'nearest',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  }
  const metricLabel = metric === 'reps' ? 'Total reps' : `Top weight · ${metric}`;
  return (
    <dialog
      ref={dialog}
      className="editor-dialog exercise-history-dialog"
      aria-labelledby={headingId}
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        dialog.current?.close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">EXERCISE HISTORY</p>
            <h2 id={headingId}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close exercise history"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        {!entries.length ? (
          <p className="exercise-helper">
            No saved exercise entries for this name yet. Save your first sets to start its history.
          </p>
        ) : (
          <>
            <p className="exercise-history-range">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·{' '}
              {formatDate(entries[0].happenedOn)}
              {entries.length > 1 ? ` – ${formatDate(entries[entries.length - 1].happenedOn)}` : ''}
            </p>
            <div className="exercise-metrics" aria-label="Chart measurement">
              {[...units, 'reps' as const].map((choice) => (
                <button
                  type="button"
                  key={choice}
                  aria-pressed={metric === choice}
                  onClick={() => {
                    setMetric(choice);
                    setSelectedId(null);
                  }}
                >
                  {choice === 'reps' ? 'Total reps' : `Top weight · ${choice}`}
                </button>
              ))}
            </div>
            {numeric.length ? (
              <section className="exercise-chart" aria-label={`${metricLabel} chart`}>
                <p className="overline">
                  {metric === 'reps'
                    ? 'TOTAL REPS PER ENTRY'
                    : `HEAVIEST LOGGED SET · ${metric.toUpperCase()}`}
                </p>
                <div className="exercise-chart-grid">
                  <div className="exercise-chart-axis" aria-hidden="true">
                    <span>{Number(max.toFixed(2))}</span>
                    <span>{Number((max / 2).toFixed(2))}</span>
                    <span>0</span>
                  </div>
                  <div className="exercise-chart-plot">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <path d="M0 10H100 M0 50H100 M0 90H100" className="exercise-chart-rules" />
                      {paths
                        .filter((path) => path.includes(' '))
                        .map((path, i) => (
                          <polyline key={i} points={path} className="exercise-chart-line" />
                        ))}
                    </svg>
                    {values.map((value, index) =>
                      value !== null ? (
                        <button
                          type="button"
                          key={entries[index].id}
                          className="exercise-chart-point"
                          style={{ left: `${x(index)}%`, top: `${y(value)}%` }}
                          aria-pressed={selectedId === entries[index].id}
                          aria-label={`${formatDate(entries[index].happenedOn)}: ${value} ${metric === 'reps' ? 'reps' : metric}, entry ${index + 1}. View sets.`}
                          title={`${formatDate(entries[index].happenedOn)} · ${value} ${metric === 'reps' ? 'reps' : metric}`}
                          onClick={() => select(entries[index])}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
                <div className="exercise-chart-dates" aria-hidden="true">
                  <span>{formatDate(entries[0].happenedOn)}</span>
                  {entries.length > 1 && <span>{formatDate(entries[entries.length - 1].happenedOn)}</span>}
                </div>
                <p className="exercise-helper">
                  Each point is one logged entry, oldest to newest. Select a point to see its sets.
                  {numeric.length === 1 ? ' One point so far; no trend yet.' : ''}
                </p>
                {numeric.length < entries.length && (
                  <p className="exercise-helper">
                    Gaps have no {metric === 'reps' ? 'individual sets' : `logged weight in ${metric}`}. Units
                    stay as recorded.
                  </p>
                )}
              </section>
            ) : (
              <p className="exercise-helper">
                No individual sets to chart yet. Earlier measurements are preserved below.
              </p>
            )}
            <div className="exercise-history-entries">
              {[...entries].reverse().map((log) => (
                <article
                  key={log.id}
                  id={`${chartId}-${log.id}`}
                  tabIndex={-1}
                  aria-label={`Entry from ${formatDate(log.happenedOn)}`}
                  className={selectedId === log.id ? 'selected' : ''}
                >
                  <p className="overline">
                    {formatDate(log.happenedOn)}
                    {workouts.find((workout) => workout.id === log.workoutId)
                      ? ` · ${workouts.find((workout) => workout.id === log.workoutId)!.title}`
                      : ''}
                  </p>
                  <p>{formatActivityMetric(log)}</p>
                  {log.exerciseSets?.length ? (
                    <ol aria-label={`Sets for ${formatDate(log.happenedOn)}`}>
                      {log.exerciseSets.map((set, index) => (
                        <li key={index}>
                          <span>Set {index + 1}</span>
                          <span>
                            {set.reps ?? '—'} reps ·{' '}
                            {set.weight === null ? 'bodyweight' : `${set.weight} ${log.weightUnit ?? 'kg'}`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="exercise-helper">
                      Earlier measurements. Individual sets were not recorded.
                    </p>
                  )}
                  {log.note && (
                    <details>
                      <summary>Note</summary>
                      <p className="exercise-history-note">{log.note}</p>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
