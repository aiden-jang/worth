import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, X } from '@phosphor-icons/react';
import type { Log, WorkoutSession } from '../shared/models';
import { api } from '../api';
import { formatDate, today } from '../format';
import { formatActivityMetric } from '../shared/workouts';
import { ConfirmDialog } from './ConfirmDialog';

export function WorkoutSessions({
  listId,
  workouts,
  logs,
  visibleLogs,
  query,
  periodStart,
  sort,
  onAdd,
  onOpen,
  onSaveRoutine,
  creating,
  onCloseCreate,
}: {
  creating: boolean;
  onCloseCreate: () => void;
  listId: string;
  workouts: WorkoutSession[];
  logs: Log[];
  visibleLogs: Log[];
  query: string;
  periodStart: string | null;
  sort: 'newest' | 'oldest' | 'name';
  onAdd: (workout: WorkoutSession, title?: string) => void;
  onSaveRoutine: (workout: WorkoutSession, entries: Log[]) => void;
  onOpen: (log: Log) => void;
}) {
  const [editing, setEditing] = useState<WorkoutSession | null>(null);
  const filtered = workouts
    .filter(
      (workout) =>
        (!periodStart || workout.happenedOn >= periodStart) &&
        (!query.trim() ||
          workout.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) ||
          visibleLogs.some((log) => log.workoutId === workout.id) ||
          workout.plannedExercises?.some((name) => name.toLowerCase().includes(query.trim().toLowerCase()))),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : (sort === 'oldest' ? 1 : -1) *
          (a.happenedOn.localeCompare(b.happenedOn) || a.createdAt - b.createdAt),
    );
  if (!workouts.length && !creating && !editing) return null;
  return (
    <section className="workout-sessions" aria-label="Workouts">
      <div className="workout-section-head">
        <p className="overline">WORKOUTS</p>
        <span className="workout-count">{filtered.length} shown</span>
      </div>
      {!filtered.length && workouts.length > 0 && (
        <p className="workout-empty">No workouts match these filters.</p>
      )}
      {filtered.map((workout) => {
        const entries = logs
          .filter((log) => log.workoutId === workout.id)
          .sort((a, b) => a.createdAt - b.createdAt);
        const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
        const pending = (workout.plannedExercises ?? []).filter(
          (name) => !entries.some((entry) => normalize(entry.title) === normalize(name)),
        );
        const visiblePending = pending.filter(
          (name) =>
            !query.trim() ||
            workout.title.toLowerCase().includes(query.trim().toLowerCase()) ||
            name.toLowerCase().includes(query.trim().toLowerCase()),
        );
        const shown = entries.filter((log) => visibleLogs.some((entry) => entry.id === log.id));
        const sets = entries.reduce((sum, entry) => sum + (entry.exerciseSets?.length ?? 0), 0);
        const reps = entries.reduce(
          (sum, entry) => sum + (entry.exerciseSets ?? []).reduce((n, set) => n + (set.reps ?? 0), 0),
          0,
        );
        return (
          <article className="workout-card" key={workout.id}>
            <div className="workout-card-heading">
              <div>
                <p className="overline">WORKOUT · {formatDate(workout.happenedOn)}</p>
                <h2 id={`workout-heading-${workout.id}`} tabIndex={-1}>
                  {workout.title}
                </h2>
              </div>
              <button
                type="button"
                className="button button-outline"
                aria-label={`Edit workout ${workout.title}`}
                onClick={() => setEditing(workout)}
              >
                Edit workout
              </button>
            </div>
            <p className="workout-count">
              {entries.length} {entries.length === 1 ? 'exercise' : 'exercises'} logged · {sets}{' '}
              {sets === 1 ? 'set' : 'sets'} · {reps} {reps === 1 ? 'rep' : 'reps'}
              {shown.length !== entries.length ? ` · ${shown.length} shown` : ''}
            </p>
            <div className="workout-exercises">
              {shown.map((log) => (
                <button type="button" key={log.id} onClick={() => onOpen(log)}>
                  <span>
                    <strong>{log.title}</strong>
                    <small>{formatActivityMetric(log)}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            {visiblePending.length > 0 && (
              <div className="planned-exercises">
                <p className="overline">EXERCISES TO LOG</p>
                <div className="workout-exercises">
                  {visiblePending.map((name) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() => onAdd(workout, name)}
                      aria-label={`Log ${name} in ${workout.title}`}
                    >
                      <span>
                        <strong>{name}</strong>
                        <small>Not logged</small>
                      </span>
                      <span className="planned-action">
                        Log exercise <ArrowRight size={18} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!entries.length && !pending.length && (
              <p className="workout-empty">Add the first exercise to this visit.</p>
            )}
            <div className="routine-actions">
              <button
                type="button"
                className="button button-outline"
                aria-label={`Add exercise to ${workout.title}`}
                onClick={() => onAdd(workout)}
              >
                <Plus size={17} /> Add exercise
              </button>
              {entries.length > 0 || workout.plannedExercises?.length ? (
                <button
                  type="button"
                  className="button button-outline"
                  aria-label={`Save ${workout.title} as routine`}
                  onClick={() => onSaveRoutine(workout, entries)}
                >
                  Save as routine
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
      {(editing || creating) && (
        <WorkoutEditor
          key={editing?.id ?? 'new'}
          listId={listId}
          workout={editing}
          onCreated={onAdd}
          onClose={() => {
            setEditing(null);
            onCloseCreate();
          }}
        />
      )}
    </section>
  );
}

function WorkoutEditor({
  listId,
  workout,
  onCreated,
  onClose,
}: {
  listId: string;
  workout: WorkoutSession | null;
  onCreated: (workout: WorkoutSession) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    client = useQueryClient();
  const initial = { title: workout?.title ?? '', happenedOn: workout?.happenedOn ?? today() };
  const [form, setForm] = useState(initial),
    [discard, setDiscard] = useState(false),
    [confirmRemove, setConfirmRemove] = useState(false);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  function refresh() {
    for (const key of [
      ['workouts', listId],
      ['logs', listId],
      ['list', listId],
      ['lists'],
      ['overview'],
      ['patterns'],
    ])
      void client.invalidateQueries({ queryKey: key });
  }
  const save = useMutation({
    mutationFn: () => (workout ? api.updateWorkout(workout.id, form) : api.createWorkout(listId, form)),
    onSuccess: ({ workout: saved }) => {
      refresh();
      dialog.current?.close();
      if (!workout) onCreated(saved);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteWorkout(workout!.id),
    onSuccess: () => {
      refresh();
      dialog.current?.close();
    },
  });
  function close() {
    if (changed) setDiscard(true);
    else dialog.current?.close();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  return (
    <dialog
      className="editor-dialog workout-editor-dialog"
      ref={dialog}
      aria-labelledby="workout-editor-title"
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">{workout ? 'WORKOUT DETAIL' : 'NEW WORKOUT'}</p>
            <h2 id="workout-editor-title">{workout ? 'Edit workout' : 'One visit. Your exercises.'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close workout" onClick={close}>
            <X size={22} />
          </button>
        </div>
        <form className="editor-form record-form" onSubmit={submit}>
          <label>
            Name <span className="optional">optional</span>
            <input
              autoFocus
              maxLength={80}
              placeholder="Push day, Saturday gym…"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
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
          {workout && (
            <p className="exercise-helper">Changing the date also moves every exercise in this workout.</p>
          )}
          {save.isError && (
            <p className="form-error" role="alert">
              {save.error.message}
            </p>
          )}
          <button
            className="button button-accent"
            disabled={save.isPending || (Boolean(workout) && !changed)}
          >
            {workout ? 'Save workout' : 'Create workout'}
          </button>
        </form>
        {workout && (
          <button className="text-danger" type="button" onClick={() => setConfirmRemove(true)}>
            Remove workout grouping
          </button>
        )}
        {confirmRemove && (
          <ConfirmDialog
            eyebrow="REMOVE GROUPING"
            title="Remove this workout grouping?"
            description="Your exercise entries, sets, notes and photos will stay in this activity list without a workout."
            confirmLabel="Remove grouping"
            pending={remove.isPending}
            error={remove.isError ? remove.error.message : undefined}
            onConfirm={() => remove.mutate()}
            onClose={() => setConfirmRemove(false)}
          />
        )}
        {discard && (
          <ConfirmDialog
            eyebrow="DISCARD CHANGES"
            title="Leave without saving?"
            description="Changes to this workout draft will be lost."
            cancelLabel="Keep editing"
            confirmLabel="Discard changes"
            onConfirm={() => dialog.current?.close()}
            onClose={() => setDiscard(false)}
          />
        )}
      </div>
    </dialog>
  );
}
