import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../api';
import { today, formatDate } from '../format';
import { useDraft } from '../hooks/useDraft';
import { experienceInput } from '../shared/memories';
import { emptyVisitContext } from '../shared/visit-context';
import type { Item } from '../shared/models';
import { ConfirmDialog } from './ConfirmDialog';
import { CallChoices } from './PersonalCall';

const draftSchema = experienceInput.extend({
  title: z.string().max(120),
  pending: experienceInput.nullable(),
});
type Draft = z.infer<typeof draftSchema>;

export function ExperienceEditor({
  listId,
  items,
  onClose,
}: {
  listId: string;
  items: Item[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    savedName = useRef<HTMLSelectElement>(null),
    client = useQueryClient();
  const initial: Draft = {
    itemId: null,
    title: '',
    type: '',
    happenedOn: today(),
    note: '',
    context: emptyVisitContext,
    pending: null,
  };
  const draft = useDraft<Draft>(
    `experience:${listId}`,
    initial,
    (v): v is Draft => draftSchema.safeParse(v).success,
  );
  const { form, setForm } = draft;
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initial);
  const [discard, setDiscard] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(
      form.happenedOn !== today() ||
      (!form.itemId && form.type) ||
      form.context.location ||
      form.context.order ||
      form.note,
    ),
  );
  const logs = useQuery({
    queryKey: ['logs', listId],
    queryFn: () => api.logs(listId),
    enabled: !!form.itemId,
  });
  const last = logs.data?.logs
    .filter(
      (log) =>
        (log.itemId === form.itemId ||
          items.find((item) => item.id === form.itemId)?.mergedIds?.includes(log.itemId ?? '')) &&
        log.happenedOn <= form.happenedOn,
    )
    .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn) || b.createdAt - a.createdAt)[0];
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    (nameInput.current ?? savedName.current)?.focus();
    return () => node?.close();
  }, []);
  const save = useMutation({
    mutationFn: () => {
      const body =
        form.pending ??
        experienceInput.parse({
          itemId: form.itemId,
          title: form.title,
          type: form.type,
          happenedOn: form.happenedOn,
          note: form.note,
          context: form.context,
        });
      draft.checkpoint({ ...form, pending: body });
      return api.createExperience(listId, body, draft.operationId.current);
    },
    onSuccess: () => {
      draft.clear();
      for (const key of [
        ['items', listId],
        ['logs', listId],
        ['list', listId],
        ['lists'],
        ['overview'],
        ['patterns'],
      ])
        void client.invalidateQueries({ queryKey: key });
      dialog.current?.close();
    },
  });
  function close() {
    if (save.isPending) return;
    if (hasChanges) setDiscard(true);
    else dialog.current?.close();
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!save.isPending) save.mutate();
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog experience-editor-dialog"
      aria-labelledby="experience-title"
      onClose={(e) => {
        e.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">ON THE RECORD</p>
            <h2 id="experience-title">What did you try?</h2>
          </div>
          <button className="icon-button" aria-label="Close experience" onClick={close}>
            <X size={22} />
          </button>
        </div>
        <form className="editor-form" onSubmit={submit}>
          <fieldset className="experience-fields" disabled={save.isPending || !!form.pending}>
            {!form.itemId && (
              <label>
                Name
                <input
                  ref={nameInput}
                  required
                  autoFocus
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
            )}
            {(items.length > 0 || form.itemId) && (
              <details className="experience-extras" open={Boolean(form.itemId)}>
                <summary>{form.itemId ? form.title : 'Use a saved name'}</summary>
                <label>
                  Record
                  <select
                    ref={savedName}
                    value={form.itemId ?? ''}
                    onChange={(e) => {
                      const item = items.find((v) => v.id === e.target.value);
                      setForm({
                        ...form,
                        itemId: item?.id ?? null,
                        title: item?.title ?? '',
                        type: item?.type ?? '',
                      });
                    }}
                  >
                    <option value="">Something new</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
              </details>
            )}
            {last && (
              <aside className="experience-last" aria-label="Previous visit">
                <p className="overline">LAST LOGGED · {formatDate(last.happenedOn)}</p>
                {last.context?.order && <p>{last.context.order}</p>}
                {last.note && <p>{last.note}</p>}
              </aside>
            )}
            {logs.isError && (
              <p role="alert">
                Previous visits couldn’t load.{' '}
                <button type="button" onClick={() => void logs.refetch()}>
                  Try again
                </button>
              </p>
            )}
            <div className="experience-reaction">
              <p>
                This time <span className="optional">optional</span>
              </p>
              <CallChoices
                label="This time"
                value={form.context.reaction}
                disabled={save.isPending || !!form.pending}
                onChange={(reaction) =>
                  setForm({
                    ...form,
                    context: { ...form.context, reaction },
                  })
                }
              />
            </div>
            <details
              className="experience-extras"
              open={detailsOpen}
              onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
            >
              <summary>
                {form.happenedOn === today() ? 'Today' : formatDate(form.happenedOn)} · Date and details
              </summary>
              <div className="experience-fields">
                <label>
                  When
                  <input
                    type="date"
                    required
                    value={form.happenedOn}
                    onInvalid={() => setDetailsOpen(true)}
                    onChange={(e) => setForm({ ...form, happenedOn: e.target.value })}
                  />
                </label>
                <label>
                  Place or neighborhood <span className="optional">optional</span>
                  <input
                    maxLength={120}
                    value={form.context.location}
                    onChange={(e) =>
                      setForm({ ...form, context: { ...form.context, location: e.target.value } })
                    }
                  />
                </label>
                <label>
                  What you ordered or tried <span className="optional">optional</span>
                  <input
                    maxLength={500}
                    value={form.context.order}
                    onChange={(e) =>
                      setForm({ ...form, context: { ...form.context, order: e.target.value } })
                    }
                  />
                </label>
                <label>
                  Note <span className="optional">optional</span>
                  <textarea
                    rows={3}
                    maxLength={4000}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </label>
                {!form.itemId && (
                  <>
                    <label>
                      Type <span className="optional">optional</span>
                      <input
                        maxLength={60}
                        placeholder="Ramen, coffee, film…"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
            </details>
          </fieldset>
          {draft.status && <p role="status">{draft.status}</p>}
          {form.pending && (
            <p>This save is fixed for a safe retry. Check your collection before discarding it.</p>
          )}
          {save.isError && (
            <p role="alert" className="form-error">
              {save.error.message}
            </p>
          )}
          <button className="button button-accent" disabled={save.isPending || !form.title.trim()}>
            {save.isPending ? 'Saving…' : form.pending ? 'Retry save' : 'Save experience'}
          </button>
        </form>
        {discard && (
          <ConfirmDialog
            title="Leave this experience?"
            description="Your unfinished device copy will be removed. A pending save may already exist; check your collection before creating another."
            confirmLabel="Discard draft"
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
