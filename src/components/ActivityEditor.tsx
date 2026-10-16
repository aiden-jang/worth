import { Plus, Trash, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type LogInput } from '../api';
import { formatDate, today } from '../format';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { isLogDraft } from '../shared/drafts';
import type { Log, WorkoutSession } from '../shared/models';
import { preparePhoto } from '../shared/photos';
import { formatActivityMetric, previousExercise } from '../shared/workouts';
import { ConfirmDialog } from './ConfirmDialog';
import { DraftPhoto } from './DraftPhoto';
import { ExerciseHistory } from './ExerciseHistory';
import { PhotoControl } from './PhotoControl';
import { RestTimer } from './RestTimer';

export function ActivityEditor({
  listId,
  log,
  repeatLog,
  existingTitles,
  logs,
  workouts,
  initialWorkout,
  initialExercise,
  workoutsLoading,
  onClose,
  onNext,
}: {
  listId: string;
  log: Log | null;
  repeatLog: Log | null;
  existingTitles: string[];
  logs: Log[];
  workouts: WorkoutSession[];
  initialWorkout: WorkoutSession | null;
  initialExercise: string;
  workoutsLoading: boolean;
  onClose: () => void;
  onNext: (workout: WorkoutSession, title: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const originalForm = log
    ? fromLog(log)
    : repeatLog
      ? { ...fromLog(repeatLog), workoutId: null, happenedOn: today(), note: '' }
      : initialWorkout
        ? {
            ...emptyLog(),
            title: initialExercise,
            workoutId: initialWorkout.id,
            happenedOn: initialWorkout.happenedOn,
            exerciseSets: [{ reps: null, weight: null }],
          }
        : emptyLog();
  const draft = useDraft<LogInput>(
    `log:${listId}:${log?.id ?? `new:${initialWorkout?.id ?? repeatLog?.id ?? 'blank'}:${initialExercise}`}`,
    originalForm,
    isLogDraft,
  );
  const { form, setForm } = draft;
  const photoDraft = useDraftPhoto(
    `log:${listId}:${log?.id ?? `new:${initialWorkout?.id ?? repeatLog?.id ?? 'blank'}:${initialExercise}`}`,
  );
  const photo = photoDraft.file;
  const setPhoto = photoDraft.change;
  const online = useConnection();
  const [saveNext, setSaveNext] = useState(false);
  const [exerciseMode, setExerciseMode] = useState(Boolean(form.exerciseSets?.length));
  const [historyTitle, setHistoryTitle] = useState<string | null>(null);
  const [confirmingPrevious, setConfirmingPrevious] = useState(false);
  const activeWorkout =
    workouts.find((workout) => workout.id === form.workoutId) ??
    (form.workoutId === initialWorkout?.id ? initialWorkout : null);
  const previous = previousExercise(logs, {
    title: form.title,
    happenedOn: form.happenedOn,
    excludeId: log?.id,
    workoutId: form.workoutId,
    beforeCreatedAt: activeWorkout?.createdAt ?? log?.createdAt,
    workouts,
  });
  function applyPrevious() {
    if (!previous?.exerciseSets?.length) return;
    setForm({
      ...form,
      exerciseSets: previous.exerciseSets.map((set) => ({ ...set })),
      weightUnit: previous.weightUnit ?? 'kg',
    });
    setConfirmingPrevious(false);
  }
  const [confirmingActivity, setConfirmingActivity] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const hasLogChanges = JSON.stringify(form) !== JSON.stringify(originalForm);
  const hasUnsavedChanges = hasLogChanges || Boolean(photo);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const save = useMutation({
    mutationFn: async () => {
      const input = cleanLogInput(form);
      const blob = photo ? await preparePhoto(photo) : null;
      const id = log?.id ?? draft.savedId.current;
      let result = id
        ? await api.updateLog(id, input)
        : await api.createLog(listId, input, draft.operationId.current);
      draft.rememberSaved(result.log.id);
      // A lost create response may have saved an older version of this draft.
      if (!id) result = await api.updateLog(result.log.id, input);
      if (blob) {
        await api.uploadPhoto('logs', result.log.id, blob);
        result.log.hasPhoto = true;
      }
      return result;
    },
    onSuccess: ({ log: saved }) => {
      draft.clear();
      photoDraft.clear();
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      const next =
        saveNext && activeWorkout
          ? (activeWorkout.plannedExercises ?? []).find(
              (name) =>
                !(activeWorkout.skippedExercises ?? []).includes(name) &&
                name.trim().toLowerCase() !== saved.title.trim().toLowerCase() &&
                !logs.some(
                  (entry) =>
                    entry.workoutId === activeWorkout.id &&
                    entry.title.trim().toLowerCase() === name.trim().toLowerCase(),
                ),
            )
          : undefined;
      client.setQueryData<{ logs: Log[] }>(['logs', listId], (current) => ({
        logs: [saved, ...(current?.logs ?? []).filter((entry) => entry.id !== saved.id)],
      }));
      if (next) {
        onNext(activeWorkout!, next);
      } else dialog.current?.close();
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
    if (save.isPending) return;
    save.mutate();
  }

  function requestClose() {
    if (save.isPending || remove.isPending) return;
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
            <h2 id="activity-editor-title">
              {log ? log.title : initialWorkout ? 'Log an exercise' : 'What happened?'}
            </h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={requestClose}>
            <X size={22} />
          </button>
        </div>
        <form
          className="editor-form record-form"
          onSubmit={submit}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !save.isPending) {
              event.preventDefault();
              event.currentTarget.requestSubmit();
            }
          }}
        >
          {draft.status && (
            <p className="draft-state" role="status">
              {draft.status}
            </p>
          )}
          <div className="activity-mode" aria-label="Log type">
            <button
              type="button"
              aria-pressed={!exerciseMode}
              onClick={() => {
                if (form.exerciseSets?.some((set) => set.reps !== null || set.weight !== null)) {
                  setConfirmingActivity(true);
                  return;
                }
                setForm({ ...form, exerciseSets: [], workoutId: null });
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
              aria-label={exerciseMode ? 'Exercise' : 'What'}
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
          {exerciseMode && form.title.trim() && (
            <button
              type="button"
              className="button button-outline exercise-history-open"
              onClick={() => setHistoryTitle(form.title.trim())}
            >
              View exercise history
            </button>
          )}
          <label>
            When
            <input
              type="date"
              disabled={Boolean(form.workoutId)}
              required
              value={form.happenedOn}
              onChange={(event) => setForm({ ...form, happenedOn: event.target.value })}
            />
          </label>
          {exerciseMode && (
            <label>
              Workout <span className="optional">optional</span>
              <select
                value={form.workoutId ?? ''}
                disabled={workoutsLoading}
                onChange={(event) => {
                  const chosen = workouts.find((workout) => workout.id === event.target.value);
                  setForm({
                    ...form,
                    workoutId: chosen?.id ?? null,
                    happenedOn: chosen?.happenedOn ?? form.happenedOn,
                  });
                }}
              >
                <option value="">No workout</option>
                {workouts.map((workout) => (
                  <option key={workout.id} value={workout.id}>
                    {workout.title} · {formatDate(workout.happenedOn)}
                  </option>
                ))}
              </select>
              {form.workoutId && (
                <span className="exercise-helper">
                  Date follows this workout. Edit its date from the workout card.
                </span>
              )}
            </label>
          )}
          {exerciseMode && (
            <section className="previous-exercise" aria-label="Previous exercise">
              <p className="overline">LAST TIME{previous ? ` · ${formatDate(previous.happenedOn)}` : ''}</p>
              {previous ? (
                <>
                  <p>{formatActivityMetric(previous)}</p>
                  {Boolean(previous.exerciseSets?.length) && (
                    <>
                      <details>
                        <summary>View previous sets</summary>
                        <ol>
                          {previous.exerciseSets?.map((set, index) => (
                            <li key={index}>
                              {set.reps} reps ·{' '}
                              {set.weight === null
                                ? 'bodyweight'
                                : `${set.weight} ${previous.weightUnit ?? 'kg'}`}
                            </li>
                          ))}
                        </ol>
                      </details>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => {
                          if (
                            form.exerciseSets?.some((set) => set.reps !== null || set.weight !== null) &&
                            JSON.stringify(form.exerciseSets) !== JSON.stringify(previous.exerciseSets)
                          )
                            setConfirmingPrevious(true);
                          else applyPrevious();
                        }}
                      >
                        Use previous sets
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p>
                  {form.title.trim()
                    ? 'No earlier sets for this exercise.'
                    : 'Enter an exercise to see its previous sets.'}
                </p>
              )}
            </section>
          )}
          {exerciseMode && activeWorkout?.status === 'active' && (
            <RestTimer key={activeWorkout.id} workoutId={activeWorkout.id} />
          )}
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
                  {previous?.exerciseSets?.[index] && (
                    <p className="set-previous">
                      Last: {previous.exerciseSets[index].reps} reps ·{' '}
                      {previous.exerciseSets[index].weight === null
                        ? 'bodyweight'
                        : `${previous.exerciseSets[index].weight} ${previous.weightUnit ?? 'kg'}`}
                    </p>
                  )}
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
                <Plus size={16} /> {form.exerciseSets?.at(-1)?.reps ? 'Duplicate last set' : 'Add set'}
              </button>
              <p className="exercise-total">
                {form.exerciseSets?.length ?? 0} {form.exerciseSets?.length === 1 ? 'set' : 'sets'} ·{' '}
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
          {!log && (
            <>
              <DraftPhoto file={photo} onChange={setPhoto} disabled={save.isPending} />
              {photoDraft.status && (
                <p className="draft-state" role="status">
                  {photoDraft.status}
                </p>
              )}
            </>
          )}
          {save.isError && (
            <p className="form-error" role="alert">
              {draft.savedId.current
                ? 'Record saved. Retry to finish saving changes or the photo; it will not create a duplicate. '
                : ''}
              {save.error.message}
            </p>
          )}
          {!log && activeWorkout && (
            <label className="next-exercise-choice">
              <input
                type="checkbox"
                checked={saveNext}
                onChange={(event) => setSaveNext(event.target.checked)}
              />{' '}
              Continue to next exercise after saving
            </label>
          )}
          <button
            className="button button-accent"
            disabled={
              !online ||
              !photoDraft.ready ||
              !form.title.trim() ||
              save.isPending ||
              Boolean(log && !hasLogChanges) ||
              Boolean(exerciseMode && !form.exerciseSets?.length)
            }
          >
            {save.isPending ? 'Saving…' : log ? 'Save changes' : 'Save log'}
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
            description="This moves this activity log and its private photo to Trash for 30 days."
            confirmLabel="Delete log"
            pending={remove.isPending}
            error={remove.isError ? remove.error.message : undefined}
            onConfirm={() => remove.mutate()}
            onClose={() => setConfirmingDelete(false)}
          />
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
        {confirmingPrevious && (
          <ConfirmDialog
            eyebrow="USE PREVIOUS SETS"
            title="Replace the current sets?"
            description="This copies the previous reps, weights and weight unit into this draft. Your workout, date and note stay intact."
            confirmLabel="Use previous sets"
            cancelLabel="Keep editing"
            onConfirm={applyPrevious}
            onClose={() => setConfirmingPrevious(false)}
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
              setForm({ ...form, exerciseSets: [], workoutId: null });
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
              draft.clear();
              photoDraft.clear();
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
    workoutId: null,
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
    workoutId: log.workoutId ?? null,
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
