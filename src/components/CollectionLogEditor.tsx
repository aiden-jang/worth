import { X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { formatDate } from '../format';
import { useDraft } from '../hooks/useDraft';
import { visitContext, emptyVisitContext } from '../shared/visit-context';
import { z } from 'zod';
import { VisitContextFields } from './VisitContext';
import type { Log } from '../shared/models';
import { ConfirmDialog } from './ConfirmDialog';
import { PhotoControl } from './PhotoControl';

const visitDraft = z.object({
  happenedOn: z.string().max(10),
  note: z.string().max(4000),
  context: visitContext,
  revision: z.number().int().nonnegative(),
});
type VisitDraft = z.infer<typeof visitDraft>;
const isVisitDraft = (value: unknown): value is VisitDraft => visitDraft.safeParse(value).success;
const fromLog = (log: Log): VisitDraft => ({
  happenedOn: log.happenedOn,
  note: log.note,
  context: log.context ?? emptyVisitContext,
  revision: log.revision ?? 0,
});

export function CollectionLogEditor({
  log,
  listId,
  onClose,
}: {
  log: Log;
  listId: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const draft = useDraft<VisitDraft>(`visit:${listId}:${log.id}`, fromLog(log), isVisitDraft);
  const [baseline, setBaseline] = useState(fromLog(log));
  const { form, setForm } = draft;
  const { happenedOn, note } = form;
  const [confirmReload, setConfirmReload] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const cleanNote = note.trim();
  const hasChanges = JSON.stringify({ ...form, note: cleanNote }) !== JSON.stringify(baseline);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const save = useMutation({
    mutationFn: () =>
      api.updateLog(log.id, {
        happenedOn,
        note: cleanNote,
        context: form.context,
        expectedRevision: form.revision,
      }),
    onSuccess: ({ log: saved }) => {
      setBaseline(fromLog(saved));
      draft.clear(fromLog(saved));
      setForm(fromLog(saved));
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      dialog.current?.close();
    },
  });

  const reload = useMutation({
    mutationFn: async () => {
      const { logs } = await api.logs(listId);
      const current = logs.find((entry) => entry.id === log.id);
      if (!current)
        throw new Error('This visit is no longer available here. Close it and refresh the collection.');
      return current;
    },
    onSuccess: (current) => {
      const next = fromLog(current);
      setBaseline(next);
      draft.clear(next);
      setForm(next);
      save.reset();
      setConfirmReload(false);
      client.setQueryData<{ logs: Log[] }>(['logs', listId], (data) => ({
        logs: (data?.logs ?? []).map((entry) => (entry.id === current.id ? current : entry)),
      }));
    },
  });
  function requestClose() {
    if (save.isPending || reload.isPending) return;
    if (hasChanges) {
      setConfirmingDiscard(true);
      return;
    }
    dialog.current?.close();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!save.isPending && !reload.isPending) save.mutate();
  }

  return (
    <dialog
      className="editor-dialog collection-log-dialog"
      aria-labelledby="revisit-editor-title"
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
            <p className="overline">REVISIT DETAIL</p>
            <h2 id="revisit-editor-title">{formatDate(log.happenedOn)}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={requestClose}>
            <X size={22} />
          </button>
        </div>
        <PhotoControl kind="logs" id={log.id} hasPhoto={log.hasPhoto} version={log.updatedAt} />
        <form className="editor-form record-form" onSubmit={submit}>
          <label>
            When
            <input
              type="date"
              required
              autoFocus
              value={happenedOn}
              onChange={(event) => setForm({ ...form, happenedOn: event.target.value })}
            />
          </label>
          <label>
            Private note <span className="optional">optional</span>
            <textarea
              rows={4}
              maxLength={4000}
              value={note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="What stood out this time?"
            />
          </label>
          <VisitContextFields value={form.context} onChange={(context) => setForm({ ...form, context })} />
          {draft.status && (
            <p role="status" className="draft-status">
              {draft.status}
            </p>
          )}
          {save.isError && (
            <p className="form-error" role="alert">
              {save.error.message}
            </p>
          )}
          {save.isError && (
            <button type="button" className="button button-outline" onClick={() => setConfirmReload(true)}>
              Reload saved visit
            </button>
          )}
          <button
            className="button button-accent"
            disabled={!happenedOn || !hasChanges || save.isPending || reload.isPending}
          >
            Save changes
          </button>
        </form>
        {confirmReload && (
          <ConfirmDialog
            title="Replace this visit draft?"
            description="This reloads the saved date, note and visit details. Your current draft will be replaced."
            confirmLabel="Reload saved visit"
            pending={reload.isPending}
            error={reload.error?.message}
            onConfirm={() => reload.mutate()}
            onClose={() => setConfirmReload(false)}
          />
        )}
        {confirmingDiscard && (
          <ConfirmDialog
            eyebrow="DISCARD CHANGES"
            title="Leave without saving?"
            description="Your changes to this private revisit log will be lost."
            cancelLabel="Keep editing"
            confirmLabel="Discard changes"
            onConfirm={() => {
              draft.clear(baseline);
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
