import { ArrowRight, Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../api';
import { formatDate, formatElapsedDays, today } from '../format';
import { useViewPreference } from '../hooks/useViewPreference';
import type { Log, WorkoutSession } from '../shared/models';
import { formatActivityMetric } from '../shared/workouts';
import { ActivityEditor } from './ActivityEditor';
import { ActivityIllustration } from './ActivityIllustration';
import { CabinetEmptyState } from './CabinetEmptyState';
import { ExerciseDirectory, ExerciseHistory } from './ExerciseHistory';
import { WorkoutRoutines, type RoutineDraft } from './WorkoutRoutines';
import { WorkoutSessions } from './WorkoutSessions';

export function ActivityView({
  listId,
  logs,
  loading,
  error,
  onRetry,
  newOpen,
  focusLogId,
  onCloseNew,
  onNew,
}: {
  listId: string;
  logs: Log[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  newOpen: boolean;
  focusLogId: string | null;
  onCloseNew: () => void;
  onNew: (workoutId?: string, exercise?: string) => void;
}) {
  const [routeParams, setRouteParams] = useSearchParams();
  const workoutsQuery = useQuery({ queryKey: ['workouts', listId], queryFn: () => api.workouts(listId) });
  const workouts = workoutsQuery.data?.workouts ?? [];
  const [historyTitle, setHistoryTitle] = useState<string | null>(null);
  const [routineSeed, setRoutineSeed] = useState<RoutineDraft | null>(null);
  const [initialExercise, setInitialExercise] = useState('');
  const [creatingWorkout, setCreatingWorkout] = useState(false);
  const [initialWorkout, setInitialWorkout] = useState<WorkoutSession | null>(null);
  const restoredWorkout =
    initialWorkout ?? workouts.find((workout) => workout.id === routeParams.get('workout')) ?? null;
  const restoredExercise = initialExercise || routeParams.get('exercise') || '';
  const [selected, setSelected] = useState<Log | null>(null);
  const [repeatLog, setRepeatLog] = useState<Log | null>(null);
  const [query, setQuery] = useViewPreference(`activity:${listId}:query`, '');
  const [sort, setSort] = useViewPreference<'newest' | 'oldest' | 'name'>(
    `activity:${listId}:sort`,
    'newest',
  );
  const [period, setPeriod] = useViewPreference<'all' | '7d' | '30d' | 'year'>(
    `activity:${listId}:period`,
    'all',
  );
  const periodStart = activityPeriodStart(period);
  const visible = logs
    .filter(
      (log) =>
        `${log.title} ${log.note} ${workouts.find((workout) => workout.id === log.workoutId)?.title ?? ''}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()) &&
        (!periodStart || log.happenedOn >= periodStart),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : sort === 'oldest'
          ? a.happenedOn.localeCompare(b.happenedOn)
          : b.happenedOn.localeCompare(a.happenedOn),
    );
  const lastLog = logs.reduce<Log | null>(
    (latest, log) => (!latest || log.happenedOn > latest.happenedOn ? log : latest),
    null,
  );
  const ungrouped = visible.filter((log) => !log.workoutId || workoutsQuery.isError);
  const hasFilters = Boolean(query.trim()) || sort !== 'newest' || period !== 'all';

  useEffect(() => {
    setCreatingWorkout(routeParams.get('newWorkout') === '1');
    setRoutineSeed(null);
    setHistoryTitle(null);
    setSelected(null);
    setRepeatLog(null);
    setInitialWorkout(null);
    setInitialExercise('');
    // Only a list change resets the editor; changing workout/search params must preserve it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  function clearFilters() {
    setQuery('');
    setSort('newest');
    setPeriod('all');
  }

  function close() {
    setSelected(null);
    setRepeatLog(null);
    setInitialWorkout(null);
    setInitialExercise('');
    if (newOpen) onCloseNew();
  }

  useEffect(() => {
    if (!focusLogId) return;
    const log = logs.find((entry) => entry.id === focusLogId);
    if (log) setSelected(log);
  }, [focusLogId, logs]);

  useEffect(() => {
    const openNewLog = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.querySelector('dialog[open]') ||
        event.key.toLocaleLowerCase() !== 'a'
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.closest('button, a, [role="button"]')
      )
        return;
      event.preventDefault();
      onNew();
    };
    window.addEventListener('keydown', openNewLog);
    return () => window.removeEventListener('keydown', openNewLog);
  }, [onNew]);

  if (loading) return <p className="loading-line">Loading activity…</p>;
  if (error)
    return (
      <p className="error-banner" role="alert">
        Couldn't load the activity log. <button onClick={onRetry}>Try again</button>
      </p>
    );

  return (
    <section className="activity-view">
      {lastLog && (
        <section className="activity-summary" aria-label="Latest activity">
          <div>
            <span>Last done</span>
            <strong>{lastLog.title}</strong>
          </div>
          <div>
            <span>{formatElapsedDays(lastLog.happenedOn)}</span>
            <small>{formatDate(lastLog.happenedOn)}</small>
          </div>
          <button
            className="activity-summary-again"
            type="button"
            onClick={() => {
              setInitialWorkout(null);
              setInitialExercise('');
              setRepeatLog(lastLog);
              onNew();
            }}
          >
            Log again <ArrowRight size={15} />
          </button>
        </section>
      )}
      <WorkoutRoutines
        listId={listId}
        seed={routineSeed}
        onCloseSeed={() => setRoutineSeed(null)}
        onStarted={clearFilters}
      />
      {!loading && !error && <ExerciseDirectory logs={logs} listId={listId} onOpen={setHistoryTitle} />}
      <div className="workout-launch">
        <button
          type="button"
          className="button button-outline"
          disabled={workoutsQuery.isPending || workoutsQuery.isError}
          onClick={() => setCreatingWorkout(true)}
        >
          <Plus size={17} /> New workout
        </button>
      </div>
      <div className="activity-tools">
        <input
          aria-label="Search activity"
          placeholder="Find a log"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Sort activity"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name</option>
        </select>
        <select
          aria-label="Time period"
          value={period}
          onChange={(event) => setPeriod(event.target.value as typeof period)}
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="year">This year</option>
        </select>
        {hasFilters && (
          <button className="clear-filters" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <span role="status">
          {visible.length} of {logs.length} {logs.length === 1 ? 'log' : 'logs'}
        </span>
      </div>
      <p className="activity-shortcut-hint">Press A to log from anywhere on this page.</p>
      {workoutsQuery.isError ? (
        <p className="error-banner" role="alert">
          Couldn't load workouts. <button onClick={() => void workoutsQuery.refetch()}>Try again</button>
        </p>
      ) : workoutsQuery.isPending ? (
        <p className="loading-line">Loading workouts…</p>
      ) : (
        <WorkoutSessions
          listId={listId}
          creating={creatingWorkout}
          onCloseCreate={() => {
            setCreatingWorkout(false);
            if (routeParams.has('newWorkout')) {
              const next = new URLSearchParams(routeParams);
              next.delete('newWorkout');
              setRouteParams(next, { replace: true });
            }
          }}
          workouts={workouts}
          logs={logs}
          visibleLogs={visible}
          query={query}
          periodStart={periodStart}
          sort={sort}
          onOpen={setSelected}
          onSaveRoutine={(workout, entries) => {
            const names = [
              ...(workout.plannedExercises ?? []),
              ...entries.map((entry) => entry.title),
            ].filter((name) => name.trim());
            const seen = new Set<string>();
            setRoutineSeed({
              title: workout.title,
              exercises: names.filter((name) => {
                const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }),
            });
          }}
          onAdd={(workout, title = '') => {
            setRepeatLog(null);
            setInitialWorkout(workout);
            setInitialExercise(title);
            onNew(workout.id, title);
          }}
        />
      )}
      {ungrouped.length > 0 && workouts.length > 0 && <p className="activity-month">OTHER LOGS</p>}
      {!visible.length && !workouts.length ? (
        <CabinetEmptyState
          art={!logs.length ? <ActivityIllustration /> : undefined}
          title={logs.length ? 'Nothing matches.' : 'Nothing here yet.'}
          description={
            logs.length
              ? 'Try another search.'
              : 'Create a routine above to plan your exercises, or start with one log.'
          }
        >
          {!logs.length && (
            <button className="button button-dark" onClick={() => onNew()}>
              <Plus size={17} /> Add first log
            </button>
          )}
          {logs.length > 0 && hasFilters && (
            <button className="button button-outline" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </CabinetEmptyState>
      ) : (
        <div className="activity-rows">
          {ungrouped.map((log, index) => {
            const previous = ungrouped[index - 1];
            const month = activityMonthLabel(log.happenedOn);
            const showMonth =
              sort !== 'name' && (!previous || activityMonthLabel(previous.happenedOn) !== month);
            return (
              <Fragment key={log.id}>
                {showMonth && <p className="activity-month">{month}</p>}
                <article className="activity-row">
                  <span className="activity-date">
                    {formatElapsedDays(log.happenedOn)}
                    <small>{formatDate(log.happenedOn)}</small>
                  </span>
                  <button className="activity-main" onClick={() => setSelected(log)}>
                    <strong>{log.title}</strong>
                    <small>{formatActivityMetric(log) || log.note || 'View detail'}</small>
                  </button>
                  {log.hasPhoto && (
                    <img src={`/api/logs/${log.id}/photo?v=${log.updatedAt}`} alt="" loading="lazy" />
                  )}
                  <button
                    className="activity-again"
                    onClick={() => {
                      setInitialWorkout(null);
                      setInitialExercise('');
                      setRepeatLog(log);
                      onNew();
                    }}
                  >
                    Again <ArrowRight size={15} />
                  </button>
                </article>
              </Fragment>
            );
          })}
        </div>
      )}
      {historyTitle && (
        <ExerciseHistory
          key={historyTitle}
          listId={listId}
          title={historyTitle}
          logs={logs}
          workouts={workouts}
          onClose={() => setHistoryTitle(null)}
        />
      )}
      {(newOpen || selected) && (!routeParams.get('workout') || !workoutsQuery.isPending) && (
        <ActivityEditor
          key={selected?.id ?? `new-${repeatLog?.id ?? restoredWorkout?.id ?? 'blank'}-${restoredExercise}`}
          listId={listId}
          log={newOpen ? null : selected}
          repeatLog={repeatLog}
          existingTitles={logs.map((entry) => entry.title)}
          logs={logs}
          workouts={
            initialWorkout && !workouts.some((workout) => workout.id === initialWorkout.id)
              ? [initialWorkout, ...workouts]
              : workouts
          }
          initialWorkout={restoredWorkout}
          initialExercise={restoredExercise}
          workoutsLoading={workoutsQuery.isPending || workoutsQuery.isError}
          onClose={close}
          onNext={(workout, title) => {
            setInitialWorkout(workout);
            setInitialExercise(title);
            onNew(workout.id, title);
          }}
        />
      )}
    </section>
  );
}

function activityPeriodStart(period: 'all' | '7d' | '30d' | 'year'): string | null {
  if (period === 'all') return null;
  if (period === 'year') return `${today().slice(0, 4)}-01-01`;
  const date = new Date(`${today()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (period === '7d' ? 6 : 29));
  return date.toISOString().slice(0, 10);
}

function activityMonthLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
