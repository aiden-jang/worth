import { X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { exerciseAliases, type ExerciseAlias, type ExerciseAliases } from '../shared/activity-plans';
import { ConfirmDialog } from './ConfirmDialog';
const draftSchema = z.object({
  revision: z.number().int().nonnegative(),
  groups: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().max(120),
        aliases: z.array(z.string().max(120)).max(968),
      }),
    )
    .max(30),
});
export function ExerciseAliasesEditor({
  listId,
  current,
  onClose,
}: {
  listId: string;
  current: ExerciseAliases;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    client = useQueryClient();
  const draft = useDraft(
    `exercise-aliases:${listId}`,
    current,
    (value): value is ExerciseAliases => draftSchema.safeParse(value).success,
  );
  const { form, setForm } = draft;
  const [discard, setDiscard] = useState(false),
    [saved, setSaved] = useState<ExerciseAliases | null>(null),
    [previous, setPrevious] = useState<ExerciseAliases | null>(null),
    [reading, setReading] = useState(false),
    [readError, setReadError] = useState('');
  const changed = JSON.stringify(form) !== JSON.stringify(current);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function close() {
    if (save.isPending || reading) return;
    if (changed) setDiscard(true);
    else dialog.current?.close();
  }
  const save = useMutation({
    mutationFn: async () => {
      const parsed = exerciseAliases.safeParse(form.groups);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the exercise names.');
      return api.updateExerciseAliases(listId, { revision: form.revision, groups: parsed.data });
    },
    onSuccess: ({ list }) => {
      draft.clear();
      client.setQueryData(['list', listId], { list });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      dialog.current?.close();
    },
  });
  function patch(index: number, change: Partial<ExerciseAlias>) {
    setForm({
      ...form,
      groups: form.groups.map((group, i) => (i === index ? { ...group, ...change } : group)),
    });
  }
  async function readSaved() {
    setReading(true);
    setReadError('');
    try {
      const { list } = await api.list(listId);
      setSaved({ revision: list.exerciseAliasRevision ?? 0, groups: list.exerciseAliases ?? [] });
    } catch (error) {
      setReadError(error instanceof Error ? error.message : 'Could not read saved groups.');
    } finally {
      setReading(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog exercise-history-dialog exercise-aliases-dialog"
      aria-labelledby="aliases-heading"
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">THIS ACTIVITY ONLY</p>
            <h2 id="aliases-heading">Same exercise. Different names.</h2>
          </div>
          <button className="icon-button" aria-label="Close exercise aliases" onClick={close}>
            <X size={22} />
          </button>
        </div>
        <p className="exercise-helper">
          Choose which names belong together in history and last-time recall. Original entry names, sets,
          units, routines and workout completion stay unchanged. Removing a group separates its history again.
        </p>
        {draft.status && (
          <p className="draft-state" role="status">
            {draft.status}
          </p>
        )}
        <form
          className="editor-form record-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <fieldset className="plan-editor-fields" disabled={save.isPending || reading}>
            {form.groups.map((group, index) => (
              <section className="routine-target-card" key={group.id}>
                <h3>Group {index + 1}</h3>
                <label>
                  Preferred name for group {index + 1}
                  <input
                    required
                    maxLength={120}
                    value={group.name}
                    onChange={(e) => patch(index, { name: e.target.value })}
                  />
                </label>
                <label>
                  Other names for group {index + 1}
                  <textarea
                    required
                    maxLength={967}
                    value={group.aliases.join('\n')}
                    placeholder="One alternate name per line"
                    onChange={(e) => patch(index, { aliases: e.target.value.split('\n') })}
                  />
                </label>
                <p className="exercise-helper">
                  Up to eight alternate names. Case and repeated spaces already match automatically.
                </p>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setForm({ ...form, groups: form.groups.filter((_, i) => i !== index) })}
                >
                  Remove group {index + 1}
                </button>
              </section>
            ))}
            <button
              type="button"
              className="button button-outline"
              disabled={form.groups.length >= 30}
              onClick={() =>
                setForm({
                  ...form,
                  groups: [...form.groups, { id: crypto.randomUUID(), name: '', aliases: [''] }],
                })
              }
            >
              Add name group
            </button>
          </fieldset>
          {save.isError && (
            <p role="alert" className="form-error">
              {save.error.message}
            </p>
          )}
          <button className="button button-accent" disabled={save.isPending || reading}>
            {save.isPending ? 'Saving…' : 'Save exercise aliases'}
          </button>
        </form>
        <button
          type="button"
          className="button button-outline"
          disabled={save.isPending || reading}
          onClick={() => void readSaved()}
        >
          {reading ? 'Reading…' : 'Check saved groups'}
        </button>
        {readError && (
          <p role="alert" className="form-error">
            {readError}
          </p>
        )}
        {previous && (
          <details className="record-extras">
            <summary>Previous draft kept for copying</summary>
            <pre className="plan-draft-copy">
              {previous.groups.map((group) => `${group.name}\n${group.aliases.join('\n')}`).join('\n\n') ||
                'No groups.'}
            </pre>
          </details>
        )}
        {saved && (
          <ConfirmDialog
            eyebrow="SAVED GROUPS"
            title="Use these saved groups?"
            description={`Your current draft will remain available for copying in this editor. Saved revision ${saved.revision}: ${saved.groups.map((group) => `${group.name} (${group.aliases.join(', ')})`).join('; ') || 'No groups.'}`}
            confirmLabel="Use saved groups"
            cancelLabel="Keep my draft"
            onClose={() => setSaved(null)}
            onConfirm={() => {
              setPrevious(form);
              setForm(saved);
              setSaved(null);
              save.reset();
            }}
          />
        )}
        {discard && (
          <ConfirmDialog
            eyebrow="DISCARD DRAFT"
            title="Leave without saving aliases?"
            description="This removes only the device draft. Saved entries and groups stay intact."
            confirmLabel="Discard draft"
            cancelLabel="Keep editing"
            onClose={() => setDiscard(false)}
            onConfirm={() => {
              draft.clear();
              dialog.current?.close();
            }}
          />
        )}
      </div>
    </dialog>
  );
}
