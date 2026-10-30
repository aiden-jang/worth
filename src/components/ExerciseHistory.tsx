import { ArrowRight, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDate, today } from '../format';
import {
  exerciseDirectory,
  exerciseRepRecords,
  exerciseImprovement,
  exerciseHistory,
  exerciseValue,
  measurementChoices,
  type ExerciseMetric,
} from '../shared/exercise-history';
import type { Log, WorkoutSession } from '../shared/models';
import type { ExerciseAlias } from '../shared/activity-plans';
import { formatActivityMetric } from '../shared/workouts';

export function ExerciseDirectory({
  logs,
  listId,
  onOpen,
  aliases = [],
  onManageAliases,
}: {
  logs: Log[];
  listId: string;
  onOpen: (title: string) => void;
  aliases?: ExerciseAlias[];
  onManageAliases?: () => void;
}) {
  const exercises = exerciseDirectory(logs, listId, aliases);
  if (!exercises.length && !onManageAliases) return null;
  return (
    <details className="exercise-directory">
      <summary>
        Exercise history{' '}
        <span>
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </summary>
      {onManageAliases && (
        <button type="button" className="button button-outline" onClick={onManageAliases}>
          Group exercise names
        </button>
      )}
      {!exercises.length && (
        <p className="exercise-helper">No saved exercise entries yet. Name groups are optional.</p>
      )}
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
  aliases = [],
}: {
  logs: Log[];
  workouts: WorkoutSession[];
  listId: string;
  title: string;
  onClose: () => void;
  aliases?: ExerciseAlias[];
}) {
  const allEntries = exerciseHistory(logs, listId, title, workouts, aliases);
  const [period, setPeriod] = useState(0);
  const end = today();
  const start = period
    ? new Date(Date.parse(`${end}T00:00:00Z`) - (period - 1) * 86400000).toISOString().slice(0, 10)
    : null;
  const entries = allEntries.filter((log) => !start || (log.happenedOn >= start && log.happenedOn <= end));
  const improvement = exerciseImprovement(entries);
  const measurements = measurementChoices(entries);
  const units = (['kg', 'lb'] as const).filter((unit) =>
    entries.some((log) => exerciseValue(log, unit) !== null),
  );
  const latestWeighted = [...entries]
    .reverse()
    .find((log) => exerciseValue(log, log.weightUnit ?? 'kg') !== null);
  const [metricChoice, setMetric] = useState<ExerciseMetric>(
    latestWeighted?.weightUnit ?? (latestWeighted ? 'kg' : (measurements[0]?.key ?? 'reps')),
  );
  const choices = [
    ...units.map((unit) => ({ key: unit as ExerciseMetric, label: `Top weight · ${unit}`, unit })),
    { key: 'reps' as ExerciseMetric, label: 'Total reps', unit: 'reps' },
    ...units.map((unit) => ({
      key: `volume:${unit}` as ExerciseMetric,
      label: `Volume · ${unit}`,
      unit: `${unit} × reps`,
    })),
    ...measurements,
  ];
  const active = choices.find((choice) => choice.key === metricChoice) ?? choices[0];
  const metric = active.key;
  const dialog = useRef<HTMLDialogElement>(null),
    headingId = useId(),
    chartId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const values = entries.map((log) => exerciseValue(log, metric));
  const numeric = values.filter((value): value is number => value !== null);
  const max = Math.max(1, ...numeric);
  const min = Math.min(0, ...numeric);
  const x = (index: number) => (entries.length === 1 ? 50 : (index / (entries.length - 1)) * 100);
  const y = (value: number) => 90 - ((value - min) / (max - min)) * 80;
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
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
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
  const metricLabel = active.label;
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
        <label className="exercise-period">
          History period
          <select
            value={period}
            onChange={(event) => {
              setPeriod(Number(event.target.value));
              setSelectedId(null);
            }}
          >
            <option value={0}>All recorded entries</option>
            <option value={28}>Last 4 weeks</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        {!entries.length ? (
          <p className="exercise-helper">
            No saved exercise entries for this name in this period. Choose a wider period or save your first
            sets.
          </p>
        ) : (
          <>
            <p className="exercise-history-range">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·{' '}
              {formatDate(entries[0].happenedOn)}
              {entries.length > 1 ? ` – ${formatDate(entries[entries.length - 1].happenedOn)}` : ''}
            </p>
            {improvement && (
              <p className="exercise-improvement" role="status">
                {improvement.weight} {improvement.unit} × {improvement.reps} reps in your latest entry.
                Previous best at this weight in this period: {improvement.previous} reps.
              </p>
            )}
            <div className="exercise-metrics" aria-label="Chart measurement">
              {choices.map((choice) => (
                <button
                  type="button"
                  key={choice.key}
                  aria-pressed={metric === choice.key}
                  onClick={() => {
                    setMetric(choice.key);
                    setSelectedId(null);
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {numeric.length ? (
              <section className="exercise-chart" aria-label={`${metricLabel} chart`}>
                <p className="overline">
                  {metric === 'reps'
                    ? 'TOTAL REPS PER ENTRY'
                    : metric === 'kg' || metric === 'lb'
                      ? `HEAVIEST LOGGED SET · ${metric.toUpperCase()}`
                      : `RECORDED ${metricLabel.toUpperCase()}`}
                </p>
                <div className="exercise-chart-grid">
                  <div className="exercise-chart-axis" aria-hidden="true">
                    <span>{Number(max.toFixed(2))}</span>
                    <span>{Number(((max + min) / 2).toFixed(2))}</span>
                    <span>{Number(min.toFixed(2))}</span>
                  </div>
                  <div
                    className="exercise-chart-scroll"
                    tabIndex={0}
                    role="group"
                    aria-label="Exercise chart timeline"
                  >
                    <div className="exercise-chart-series" style={{ minWidth: entries.length * 48 }}>
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
                              aria-label={`${formatDate(entries[index].happenedOn)}: ${value} ${active.unit}, entry ${index + 1}. View entry.`}
                              title={`${formatDate(entries[index].happenedOn)} · ${value} ${active.unit}`}
                              onClick={() => select(entries[index])}
                            />
                          ) : null,
                        )}
                      </div>
                      <div className="exercise-chart-dates" aria-hidden="true">
                        <span>{formatDate(entries[0].happenedOn)}</span>
                        {entries.length > 1 && (
                          <span>{formatDate(entries[entries.length - 1].happenedOn)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="exercise-helper">
                  Each point is one logged entry, oldest to newest. Scroll across if needed, or select a point
                  to see its measurements.
                  {numeric.length === 1 ? ' One point so far; no trend yet.' : ''}
                </p>
                {numeric.length < entries.length && (
                  <p className="exercise-helper">
                    Gaps have no{' '}
                    {metric === 'reps'
                      ? 'individual sets'
                      : metric === 'kg' || metric === 'lb'
                        ? `logged weight in ${metric}`
                        : `recorded ${metricLabel}`}
                    . Units stay as recorded.
                  </p>
                )}
              </section>
            ) : (
              <p className="exercise-helper">
                No recorded values for {metricLabel}. Measurements stay readable below.
              </p>
            )}
            {!!units.length && (
              <details className="exercise-records">
                <summary>Best recorded sets by rep count</summary>
                <p>
                  Actual sets in this period. Units stay separate; only comparable exercise names should be
                  grouped.
                </p>
                {units.map((unit) => (
                  <section key={unit} aria-label={`Best sets in ${unit}`}>
                    <h3>{unit}</h3>
                    <ol>
                      {exerciseRepRecords(entries, unit).map((record) => (
                        <li key={record.reps}>
                          <button
                            type="button"
                            onClick={() => select(entries.find((log) => log.id === record.logId)!)}
                          >
                            {record.reps} reps · {record.weight} {unit} · {formatDate(record.date)}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </details>
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
                  {log.title !== title && <p className="exercise-helper">Recorded as: {log.title}</p>}
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
                    <p className="exercise-helper">Individual sets were not recorded.</p>
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
