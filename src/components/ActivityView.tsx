import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash, X } from '@phosphor-icons/react';
import type { Log } from '../shared/models';
import { api, type LogInput } from '../api';
import { formatDate, formatElapsedDays, today } from '../format';
import { ConfirmDialog } from './ConfirmDialog';
import { PhotoControl } from './PhotoControl';

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
  onNew: () => void;
}) {
  const [selected, setSelected] = useState<Log | null>(null);
  const [repeatLog, setRepeatLog] = useState<Log | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [period, setPeriod] = useState<'all' | '7d' | '30d' | 'year'>('all');
  const periodStart = activityPeriodStart(period);
  const visible = logs
    .filter(
      (log) =>
        `${log.title} ${log.note}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
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
  const hasFilters = Boolean(query.trim()) || sort !== 'newest' || period !== 'all';

  useEffect(() => {
    setSelected(null);
    setRepeatLog(null);
    setQuery('');
    setSort('newest');
    setPeriod('all');
  }, [listId]);

  function clearFilters() {
    setQuery('');
    setSort('newest');
    setPeriod('all');
  }

  function close() {
    setSelected(null);
    setRepeatLog(null);
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
              setRepeatLog(lastLog);
              onNew();
            }}
          >
            Log again <ArrowRight size={15} />
          </button>
        </section>
      )}
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
      {!visible.length ? (
        <div className="empty-list">
          <h2>{logs.length ? 'Nothing matches.' : 'Nothing here yet.'}</h2>
          <p>{logs.length ? 'Try another search.' : 'Log a run, a night out, or whatever belongs here.'}</p>
          {!logs.length && (
            <button className="button button-dark" onClick={onNew}>
              <Plus size={17} /> Add first log
            </button>
          )}
          {logs.length > 0 && hasFilters && (
            <button className="button button-outline" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="activity-rows">
          {visible.map((log, index) => {
            const previous = visible[index - 1];
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
                    <small>{formatMetric(log) || log.note || 'View detail'}</small>
                  </button>
                  {log.hasPhoto && (
                    <img src={`/api/logs/${log.id}/photo?v=${log.updatedAt}`} alt="" loading="lazy" />
                  )}
                  <button
                    className="activity-again"
                    onClick={() => {
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
      {(newOpen || selected) && (
        <ActivityEditor
          key={selected?.id ?? `new-${repeatLog?.id ?? 'blank'}`}
          listId={listId}
          log={newOpen ? null : selected}
          repeatLog={repeatLog}
          existingTitles={logs.map((entry) => entry.title)}
          onClose={close}
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

function ActivityEditor({
  listId,
  log,
  repeatLog,
  existingTitles,
  onClose,
}: {
  listId: string;
  log: Log | null;
  repeatLog: Log | null;
  existingTitles: string[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [form, setForm] = useState<LogInput>(
    log ? fromLog(log) : repeatLog ? { ...fromLog(repeatLog), happenedOn: today(), note: '' } : emptyLog(),
  );
  const [exerciseMode, setExerciseMode] = useState(Boolean((log ?? repeatLog)?.exerciseSets?.length));
  const [confirmingActivity, setConfirmingActivity] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const originalForm = log
    ? fromLog(log)
    : repeatLog
      ? { ...fromLog(repeatLog), happenedOn: today(), note: '' }
      : emptyLog();
  const hasLogChanges = JSON.stringify(form) !== JSON.stringify(originalForm);
  const hasUnsavedChanges = hasLogChanges;
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
    };
  }, []);
  const save = useMutation({
    mutationFn: () => {
      const input = cleanLogInput(form);
      return log ? api.updateLog(log.id, input) : api.createLog(listId, input);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      dialog.current?.close();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteLog(log!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      dialog.current?.close();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  function requestClose() {
    if (hasUnsavedChanges) {
      setConfirmingDiscard(true);
      return;
    }
    dialog.current?.close();
  }

  return (
    <dialog
      className="editor-dialog activity-editor-dialog"
      aria-labelledby="activity-editor-title"
      ref={dialog}
      onClose={(event) => {
        event.stopPropagation();
        // Ignore close events queued by Strict Mode cleanup if the dialog reopened.
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) requestClose();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">{log ? 'ACTIVITY DETAIL' : 'QUICK LOG'}</p>
            <h2 id="activity-editor-title">{log ? log.title : 'What happened?'}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={requestClose}>
            <X size={22} />
          </button>
        </div>
        <form className="editor-form record-form" onSubmit={submit}>
          <div className="activity-mode" aria-label="Log type">
            <button
              type="button"
              aria-pressed={!exerciseMode}
              onClick={() => {
                if (form.exerciseSets?.some((set) => set.reps !== null || set.weight !== null)) {
                  setConfirmingActivity(true);
                  return;
                }
                setForm({ ...form, exerciseSets: [] });
                setExerciseMode(false);
              }}
            >
              Activity
            </button>
            <button
              type="button"
              aria-pressed={exerciseMode}
              onClick={() => {
                setExerciseMode(true);
                if (!form.exerciseSets?.length)
                  setForm({ ...form, exerciseSets: [{ reps: null, weight: null }] });
              }}
            >
              Exercise
            </button>
          </div>
          <label>
            {exerciseMode ? 'Exercise' : 'What'}
            <input
              required
              autoFocus={!log}
              maxLength={120}
              value={form.title}
              list={`activity-titles-${listId}`}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Evening run, haircut, bench press…"
            />
            {existingTitles.length > 0 && (
              <datalist id={`activity-titles-${listId}`}>
                {Array.from(new Set(existingTitles))
                  .sort()
                  .map((title) => (
                    <option key={title} value={title} />
                  ))}
              </datalist>
            )}
          </label>
          <label>
            When
            <input
              type="date"
              required
              value={form.happenedOn}
              onChange={(event) => setForm({ ...form, happenedOn: event.target.value })}
            />
          </label>
          {exerciseMode && (
            <fieldset className="exercise-sets">
              <legend>Exercise sets</legend>
              <p className="exercise-helper">Leave weight blank for bodyweight sets.</p>
              <label>
                Weight unit
                <select
                  value={form.weightUnit ?? 'kg'}
                  onChange={(event) => setForm({ ...form, weightUnit: event.target.value as 'kg' | 'lb' })}
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </label>
              {(form.exerciseSets ?? []).map((set, index) => (
                <div className="exercise-set-row" key={index}>
                  <span className="set-number" aria-label={`Set ${index + 1}`}>
                    {index + 1}
                  </span>
                  <label>
                    Reps
                    <input
                      aria-label={`Set ${index + 1} reps`}
                      type="number"
                      required
                      min="1"
                      max="10000"
                      step="1"
                      value={set.reps ?? ''}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          exerciseSets: form.exerciseSets?.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  reps: event.target.value === '' ? null : Number(event.target.value),
                                }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Weight
                    <input
                      aria-label={`Set ${index + 1} weight in ${form.weightUnit ?? 'kg'}`}
                      type="number"
                      min="0"
                      max="100000"
                      step="any"
                      placeholder="—"
                      value={set.weight ?? ''}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          exerciseSets: form.exerciseSets?.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  weight: event.target.value === '' ? null : Number(event.target.value),
                                }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove set ${index + 1}`}
                    onClick={() =>
                      setForm({ ...form, exerciseSets: form.exerciseSets?.filter((_, i) => i !== index) })
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button button-outline"
                disabled={(form.exerciseSets?.length ?? 0) >= 100}
                onClick={() => {
                  const previous = form.exerciseSets?.at(-1);
                  setForm({
                    ...form,
                    exerciseSets: [
                      ...(form.exerciseSets ?? []),
                      previous ? { ...previous } : { reps: null, weight: null },
                    ],
                  });
                }}
              >
                <Plus size={16} /> Add set
              </button>
              <p className="exercise-total">
                {form.exerciseSets?.length ?? 0} sets ·{' '}
                {(form.exerciseSets ?? []).reduce((sum, set) => sum + (set.reps ?? 0), 0)} reps
              </p>
            </fieldset>
          )}
          <details
            className="record-extras"
            open={Boolean(
              (log?.amount !== null && log?.amount !== undefined) || log?.unit || log?.sets || log?.reps,
            )}
          >
            <summary>
              {exerciseMode ? 'Other measurements' : 'Measurements'} <span>optional</span>
            </summary>
            <div className="metric-row">
              <label>
                Amount <span className="optional">optional</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.amount ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      amount: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                  placeholder="5.2"
                />
              </label>
              <label>
                Unit
                <input
                  maxLength={24}
                  value={form.unit}
                  onChange={(event) => setForm({ ...form, unit: event.target.value })}
                  placeholder="mi, lb, km…"
                />
              </label>
            </div>
            <div className="metric-row">
              <label>
                Sets <span className="optional">optional</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.sets ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, sets: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Reps <span className="optional">optional</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.reps ?? ''}
                  onChange={(event) =>
                    setForm({ ...form, reps: event.target.value === '' ? null : Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </details>
          <label>
            Private note <span className="optional">optional</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="Anything you want to remember"
            />
          </label>
          {save.isError && <p className="form-error">{save.error.message}</p>}
          <button
            className="button button-accent"
            disabled={
              !form.title.trim() ||
              save.isPending ||
              Boolean(log && !hasLogChanges) ||
              Boolean(exerciseMode && !form.exerciseSets?.length)
            }
          >
            {log ? 'Save changes' : 'Save log'}
          </button>
        </form>
        {log && (
          <details className="record-extras record-photo" open={log.hasPhoto}>
            <summary>
              Photo <span>optional · private</span>
            </summary>
            <PhotoControl
              kind="logs"
              id={log.id}
              hasPhoto={log.hasPhoto}
              version={log.updatedAt}
              listId={listId}
            />
          </details>
        )}
        {log && (
          <button
            className="text-danger"
            disabled={remove.isPending}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash size={16} /> Delete log
          </button>
        )}
        {remove.isError && <p className="form-error">{remove.error.message}</p>}
        {log && confirmingDelete && (
          <ConfirmDialog
            eyebrow="DELETE LOG"
            title={`Delete ${log.title}?`}
            description="This permanently removes this activity log and its private photo, if it has one."
            confirmLabel="Delete log"
            pending={remove.isPending}
            error={remove.isError ? remove.error.message : undefined}
            onConfirm={() => remove.mutate()}
            onClose={() => setConfirmingDelete(false)}
          />
        )}
        {confirmingActivity && (
          <ConfirmDialog
            eyebrow="CHANGE LOG TYPE"
            title="Remove exercise sets?"
            description="Switching to Activity removes the exercise sets from this draft. Other measurements and notes stay intact."
            cancelLabel="Keep editing"
            confirmLabel="Use Activity"
            onConfirm={() => {
              setForm({ ...form, exerciseSets: [] });
              setExerciseMode(false);
              setConfirmingActivity(false);
            }}
            onClose={() => setConfirmingActivity(false)}
          />
        )}
        {confirmingDiscard && (
          <ConfirmDialog
            eyebrow="DISCARD CHANGES"
            title="Leave without saving?"
            description="Your changes to this private activity log will be lost."
            cancelLabel="Keep editing"
            confirmLabel="Discard changes"
            onConfirm={() => {
              setConfirmingDiscard(false);
              dialog.current?.close();
            }}
            onClose={() => setConfirmingDiscard(false)}
          />
        )}
      </div>
    </dialog>
  );
}

function emptyLog(title = ''): LogInput {
  return {
    exerciseSets: [],
    weightUnit: 'kg',
    itemId: null,
    title,
    happenedOn: today(),
    note: '',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
  };
}

function fromLog(log: Log): LogInput {
  return {
    exerciseSets: (log.exerciseSets ?? []).map((set) => ({ ...set })),
    weightUnit: log.weightUnit ?? 'kg',
    itemId: null,
    title: log.title,
    happenedOn: log.happenedOn,
    note: log.note,
    amount: log.amount,
    unit: log.unit,
    sets: log.sets,
    reps: log.reps,
  };
}

function cleanLogInput(input: LogInput): LogInput {
  return { ...input, title: input.title.trim(), unit: input.unit.trim(), note: input.note.trim() };
}

function formatMetric(log: Log): string {
  if (log.exerciseSets?.length) {
    const weights = log.exerciseSets.flatMap((set) => (set.weight === null ? [] : [set.weight]));
    const totalReps = log.exerciseSets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
    const low = Math.min(...weights),
      high = Math.max(...weights);
    const weight = weights.length
      ? `${low === high ? low : `${low}–${high}`} ${log.weightUnit ?? 'kg'}${weights.length < log.exerciseSets.length ? ' + bodyweight' : ''}`
      : 'bodyweight';
    return `${log.exerciseSets.length} sets · ${totalReps} reps · ${weight}`;
  }
  const parts = [];
  if (log.amount !== null) parts.push(`${log.amount}${log.unit ? ` ${log.unit}` : ''}`);
  if (log.sets !== null && log.reps !== null) parts.push(`${log.sets} sets × ${log.reps} reps`);
  return parts.join(' · ');
}
