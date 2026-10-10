import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, X } from '@phosphor-icons/react';
import { api } from '../api';
import type { WorkoutRoutine, WorkoutSession } from '../shared/models';
import { today } from '../format';
import { ConfirmDialog } from './ConfirmDialog';

export type RoutineDraft = { title: string; exercises: string[] };
export function WorkoutRoutines({
  listId,
  seed,
  onCloseSeed,
  onStarted,
}: {
  listId: string;
  seed: RoutineDraft | null;
  onCloseSeed: () => void;
  onStarted: () => void;
}) {
  const query = useQuery({ queryKey: ['routines', listId], queryFn: () => api.routines(listId) });
  const [editing, setEditing] = useState<WorkoutRoutine | null>(null);
  const [starting, setStarting] = useState<WorkoutRoutine | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    setEditing(null);
    setStarting(null);
    setCreating(false);
  }, [listId]);
  function close() {
    setEditing(null);
    setStarting(null);
    setCreating(false);
    onCloseSeed();
  }
  return (
    <section className="workout-routines" aria-label="Routines">
      <div className="workout-section-head">
        <p className="overline">ROUTINES</p>
        <button type="button" className="button button-outline" onClick={() => setCreating(true)}>
          <Plus size={17} /> New routine
        </button>
      </div>
      {query.isPending && <p className="loading-line">Loading routines…</p>}
      {query.isError && (
        <p className="error-banner" role="alert">
          Couldn't load routines. <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      )}
      {query.data?.routines.length === 0 && (
        <p className="exercise-helper">Save an exercise list. Start a fresh visit whenever you need it.</p>
      )}
      <div className="routine-grid">
        {query.data?.routines.map((routine) => (
          <article className="routine-card" key={routine.id}>
            <h2>{routine.title}</h2>
            <p>{routine.exercises.join(' · ')}</p>
            <div className="routine-actions">
              <button
                type="button"
                className="button button-accent"
                aria-label={`Start workout from ${routine.title}`}
                onClick={() => setStarting(routine)}
              >
                Start workout <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="button button-outline"
                aria-label={`Edit routine ${routine.title}`}
                onClick={() => setEditing(routine)}
              >
                Edit routine
              </button>
            </div>
          </article>
        ))}
      </div>
      {(editing || starting || creating || seed) && (
        <RoutineEditor
          key={editing?.id ?? starting?.id ?? 'new'}
          listId={listId}
          routine={editing ?? starting}
          starting={Boolean(starting)}
          seed={seed}
          onClose={close}
          onStarted={onStarted}
        />
      )}
    </section>
  );
}
function RoutineEditor({
  listId,
  routine,
  starting,
  seed,
  onClose,
  onStarted,
}: {
  listId: string;
  routine: WorkoutRoutine | null;
  starting: boolean;
  seed: RoutineDraft | null;
  onClose: () => void;
  onStarted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    client = useQueryClient();
  const initial = {
    title: routine?.title ?? seed?.title ?? '',
    exercises: (routine?.exercises ?? seed?.exercises ?? []).join('\n'),
    happenedOn: today(),
  };
  const [form, setForm] = useState(initial),
    [discard, setDiscard] = useState(false),
    [confirmRemove, setConfirmRemove] = useState(false);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  function refresh() {
    for (const key of [['routines', listId], ['workouts', listId], ['list', listId], ['lists'], ['overview']])
      void client.invalidateQueries({ queryKey: key });
  }
  const save = useMutation({
    mutationFn: async () => {
      if (starting) {
        const result = await api.createWorkout(listId, {
          title: form.title,
          happenedOn: form.happenedOn,
          routineId: routine!.id,
        });
        return result.workout;
      }
      const body = {
        title: form.title,
        exercises: form.exercises
          .split('\n')
          .map((name) => name.trim())
          .filter(Boolean),
      };
      if (routine) await api.updateRoutine(routine.id, body);
      else await api.createRoutine(listId, body);
    },
    onSuccess: (workout) => {
      if (workout) {
        client.setQueryData<{ workouts: WorkoutSession[] }>(['workouts', listId], (data) => ({
          workouts: [workout, ...(data?.workouts ?? [])],
        }));
        onStarted();
      }
      refresh();
      dialog.current?.close();
      if (workout)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const heading = document.getElementById(`workout-heading-${workout.id}`);
            heading?.focus({ preventScroll: true });
            heading?.closest('article')?.scrollIntoView({
              block: 'start',
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            });
          }),
        );
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteRoutine(routine!.id),
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
    save.mutate();
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog workout-editor-dialog"
      aria-labelledby="routine-editor-title"
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
            <p className="overline">
              {starting ? 'FROM ROUTINE' : routine ? 'ROUTINE DETAIL' : 'NEW ROUTINE'}
            </p>
            <h2 id="routine-editor-title">
              {starting ? 'Start a fresh visit' : routine ? 'Edit routine' : 'Your usual lineup'}
            </h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close routine" onClick={close}>
            <X size={22} />
          </button>
        </div>
        <form className="editor-form record-form" onSubmit={submit}>
          <label>
            Name
            <input
              required
              autoFocus
              maxLength={80}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Push day, Leg day…"
            />
          </label>
          {starting ? (
            <>
              <label>
                When
                <input
                  required
                  type="date"
                  value={form.happenedOn}
                  onChange={(event) => setForm({ ...form, happenedOn: event.target.value })}
                />
              </label>
              <p className="exercise-helper">{routine?.exercises.join(' · ')}</p>
              <p className="exercise-helper">Sets start blank. Last time stays available for reference.</p>
            </>
          ) : (
            <>
              <label>
                Exercises
                <textarea
                  required
                  rows={6}
                  maxLength={5000}
                  value={form.exercises}
                  onChange={(event) => setForm({ ...form, exercises: event.target.value })}
                  placeholder={'Bench press\nShoulder press\nTriceps extension'}
                  aria-describedby="routine-exercise-help"
                />
              </label>
              <p id="routine-exercise-help" className="exercise-helper">
                One exercise per line, in the order you want to log them. Up to 40 unique names.
              </p>
              {routine && (
                <p className="exercise-helper">
                  Changes apply to future visits. Existing workouts keep their exercise list.
                </p>
              )}
            </>
          )}
          {save.isError && (
            <p className="form-error" role="alert">
              {save.error.message}
            </p>
          )}
          <button
            className="button button-accent"
            disabled={save.isPending || (Boolean(routine) && !starting && !changed)}
          >
            {starting ? 'Start workout' : 'Save routine'}
          </button>
        </form>
        {routine && !starting && (
          <button type="button" className="text-danger" onClick={() => setConfirmRemove(true)}>
            Delete routine
          </button>
        )}
        {confirmRemove && (
          <ConfirmDialog
            eyebrow="DELETE ROUTINE"
            title="Delete this routine?"
            description="Existing workouts and exercise entries will stay. This saved exercise list will be removed."
            confirmLabel="Delete routine"
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
            description="Changes to this draft will be lost."
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
