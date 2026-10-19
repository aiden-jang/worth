import { ArrowRight, Plus, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, RequestError } from '../api';
import { planEditorDraft, exerciseKey, targetSummary } from '../shared/activity-plans';
import { RoutineTargetsEditor } from './RoutineTargetsEditor';
import { SavedPlanReview } from './SavedPlanReview';
import { formatDate, today } from '../format';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Log, WorkoutSession } from '../shared/models';
import { formatActivityMetric } from '../shared/workouts';
import { ConfirmDialog } from './ConfirmDialog';
import { ExerciseLineup } from './ExerciseLineup';
import { RestTimer } from './RestTimer';
import { ActivityIllustration } from './ActivityIllustration';
import '../activity-illustrations.css';

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
  const client = useQueryClient();
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateWorkout>[1] }) =>
      api.updateWorkout(id, {
        ...patch,
        expectedRevision: workouts.find((workout) => workout.id === id)?.revision ?? 0,
      }),
    onSuccess: ({ workout }) => {
      client.setQueryData<{ workouts: WorkoutSession[] }>(['workouts', listId], (current) => ({
        workouts: (current?.workouts ?? []).map((value) => (value.id === workout.id ? workout : value)),
      }));
      void client.invalidateQueries({ queryKey: ['workouts', listId] });
    },
  });
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
      {update.isError && (
        <p className="form-error" role="alert">
          {update.error.message}
        </p>
      )}
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
          (name) =>
            !entries.some((entry) => normalize(entry.title) === normalize(name)) &&
            !(workout.skippedExercises ?? []).includes(name),
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
                <p className="overline">
                  {workout.status === 'active' ? 'ACTIVE WORKOUT' : 'WORKOUT RECAP'} ·{' '}
                  {formatDate(workout.happenedOn)}
                </p>
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
              {entries.length} {entries.length === 1 ? 'exercise' : 'exercises'} logged ·{' '}
              {entries.length && !sets
                ? 'No individual sets recorded'
                : `${sets} ${sets === 1 ? 'set' : 'sets'} · ${reps} ${reps === 1 ? 'rep' : 'reps'}`}
              {shown.length !== entries.length ? ` · ${shown.length} shown` : ''}
            </p>
            <div className="routine-actions">
              {workout.status === 'active' && (
                <button
                  type="button"
                  className="button button-accent"
                  onClick={() => onAdd(workout, pending[0])}
                >
                  Resume workout <ArrowRight size={17} />
                </button>
              )}
              <button
                type="button"
                className="button button-outline"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: workout.id,
                    patch: { status: workout.status === 'active' ? 'finished' : 'active' },
                  })
                }
              >
                {update.isPending && update.variables?.id === workout.id
                  ? 'Saving…'
                  : workout.status === 'active'
                    ? 'Finish workout'
                    : 'Reopen workout'}
              </button>
            </div>
            {workout.status === 'active' && <RestTimer key={workout.id} workoutId={workout.id} />}
            {workout.status !== 'active' && pending.length > 0 && (
              <p className="exercise-helper">
                {pending.length} planned {pending.length === 1 ? 'exercise was' : 'exercises were'} left
                unlogged.
              </p>
            )}
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
                    <div className="planned-row" key={name}>
                      <button
                        type="button"
                        key={name}
                        onClick={() => onAdd(workout, name)}
                        aria-label={`Log ${name} in ${workout.title}`}
                      >
                        <span>
                          <strong>{name}</strong>
                          <small>Not logged</small>
                          {workout.targets
                            ?.filter((target) => exerciseKey(target.exercise) === exerciseKey(name))
                            .map((target) => (
                              <small key={target.exercise}>
                                Planned: {targetSummary(target) || 'Note only'}
                                {target.note ? ` · ${target.note}` : ''}
                              </small>
                            ))}
                        </span>
                        <span className="planned-action">
                          Log exercise <ArrowRight size={18} />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        aria-label={`Skip ${name} for this visit`}
                        disabled={update.isPending}
                        onClick={() =>
                          update.mutate({
                            id: workout.id,
                            patch: { skippedExercises: [...(workout.skippedExercises ?? []), name] },
                          })
                        }
                      >
                        Skip
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Boolean(workout.skippedExercises?.length) && (
              <div className="skipped-exercises">
                <p className="overline">SKIPPED THIS VISIT</p>
                {workout.skippedExercises?.map((name) => (
                  <p key={name}>
                    <span>{name}</span>
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          id: workout.id,
                          patch: {
                            skippedExercises: workout.skippedExercises?.filter((value) => value !== name),
                          },
                        })
                      }
                    >
                      Restore
                    </button>
                  </p>
                ))}
              </div>
            )}
            {!entries.length && !pending.length && (
              <div className="workout-empty-state">
                <ActivityIllustration kind="workout" />
                <p className="workout-empty">Add the first exercise to this visit.</p>
              </div>
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
  usePageTitle(workout?.title || 'New workout');
  const dialog = useRef<HTMLDialogElement>(null),
    client = useQueryClient();
  const initial = {
    targets: workout?.targets ?? [],
    revision: workout?.revision ?? 0,
    frozen: false,
    title: workout?.title ?? '',
    happenedOn: workout?.happenedOn ?? today(),
    exercises: (workout?.plannedExercises ?? []).join('\n'),
  };
  const draft = useDraft(
    `workout:${listId}:${workout?.id ?? 'new'}`,
    initial,
    (value): value is typeof initial => planEditorDraft.safeParse(value).success,
  );
  const { form: storedForm, setForm } = draft;
  const form = { ...initial, ...storedForm };
  const legacyDraft = !!workout && !('revision' in storedForm);
  const [discard, setDiscard] = useState(false),
    [confirmRemove, setConfirmRemove] = useState(false);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
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
    mutationFn: () => {
      if (!workout) draft.checkpoint({ ...form, frozen: true });
      return workout
        ? api.updateWorkout(workout.id, {
            targets: form.targets,
            expectedRevision: form.revision,
            title: form.title,
            happenedOn: form.happenedOn,
            plannedExercises: form.exercises
              .split('\n')
              .map((name) => name.trim())
              .filter(Boolean),
          })
        : api.createWorkout(
            listId,
            { title: form.title, happenedOn: form.happenedOn },
            draft.operationId.current,
          );
    },
    onError: (error) => {
      if (error instanceof RequestError && (error.status === 400 || error.code === 'PLAN_CHANGED'))
        setForm((current) => ({ ...current, frozen: false }));
    },
    onSuccess: ({ workout: saved }) => {
      draft.clear();
      refresh();
      dialog.current?.close();
      if (!workout) onCreated(saved);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteWorkout(workout!.id, form.revision),
    onSuccess: () => {
      refresh();
      dialog.current?.close();
    },
  });
  function close() {
    if (save.isPending || remove.isPending) return;
    if (changed) setDiscard(true);
    else dialog.current?.close();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (legacyDraft || save.isPending) return;
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
          {legacyDraft && (
            <p className="draft-state">
              This older draft has no saved revision. Check the saved plan before using its current version;
              your draft stays available for copying.
            </p>
          )}
          {draft.status && (
            <p className="draft-state" role="status">
              {draft.status}
            </p>
          )}
          {form.frozen && (
            <p className="draft-state">
              This pending save is fixed. Retry it exactly to avoid creating another workout.
            </p>
          )}
          <fieldset className="plan-editor-fields" disabled={save.isPending || form.frozen}>
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
              <>
                <label>
                  This visit’s lineup
                  <textarea
                    rows={4}
                    maxLength={5000}
                    value={form.exercises}
                    onChange={(event) => setForm({ ...form, exercises: event.target.value })}
                  />
                </label>
                <ExerciseLineup
                  value={form.exercises}
                  onChange={(exercises) => setForm({ ...form, exercises })}
                />
                <RoutineTargetsEditor
                  exercises={form.exercises
                    .split('\n')
                    .map((name) => name.trim())
                    .filter(Boolean)}
                  value={form.targets}
                  onChange={(targets) => setForm({ ...form, targets })}
                />
                <p className="exercise-helper">
                  One name per line. Swap a name or reorder it here. Your saved routine and logged exercises
                  stay intact.
                </p>
              </>
            )}
            {workout && (
              <p className="exercise-helper">Changing the date also moves every exercise in this workout.</p>
            )}
          </fieldset>
          {save.isError && (
            <p className="form-error" role="alert">
              {save.error.message}
            </p>
          )}
          <button
            className="button button-accent"
            disabled={save.isPending || legacyDraft || (Boolean(workout) && !changed)}
          >
            {save.isPending ? 'Saving…' : workout ? 'Save workout' : 'Create workout'}
          </button>
        </form>
        {workout && (
          <SavedPlanReview
            current={form}
            disabled={save.isPending || form.frozen}
            read={async () => {
              const result = await api.workouts(listId),
                saved = result.workouts.find((value) => value.id === workout.id);
              if (!saved)
                throw new Error('This workout is no longer available. Your draft stays here for copying.');
              return {
                title: saved.title,
                happenedOn: saved.happenedOn,
                exercises: (saved.plannedExercises ?? []).join('\n'),
                targets: saved.targets ?? [],
                revision: saved.revision ?? 0,
                frozen: false,
              };
            }}
            onUse={(next) => {
              setForm(next);
              save.reset();
            }}
          />
        )}
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
            onConfirm={() => {
              draft.clear();
              dialog.current?.close();
            }}
            onClose={() => setDiscard(false)}
          />
        )}
      </div>
    </dialog>
  );
}
