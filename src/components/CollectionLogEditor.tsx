import { X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api';
import { formatDate } from '../format';
import type { Log } from '../shared/models';
import { ConfirmDialog } from './ConfirmDialog';
import { PhotoControl } from './PhotoControl';

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
  const [happenedOn, setHappenedOn] = useState(log.happenedOn);
  const [note, setNote] = useState(log.note);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const cleanNote = note.trim();
  const hasChanges = happenedOn !== log.happenedOn || cleanNote !== log.note;

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const save = useMutation({
    mutationFn: () => api.updateLog(log.id, { happenedOn, note: cleanNote }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      dialog.current?.close();
    },
  });

  function requestClose() {
    if (hasChanges) {
      setConfirmingDiscard(true);
      return;
    }
    dialog.current?.close();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
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
        <PhotoControl
          kind="logs"
          id={log.id}
          hasPhoto={log.hasPhoto}
          version={log.updatedAt}
          listId={listId}
        />
        <form className="editor-form record-form" onSubmit={submit}>
          <label>
            When
            <input
              type="date"
              required
              autoFocus
              value={happenedOn}
              onChange={(event) => setHappenedOn(event.target.value)}
            />
          </label>
          <label>
            Private note <span className="optional">optional</span>
            <textarea
              rows={4}
              maxLength={4000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What stood out this time?"
            />
          </label>
          {save.isError && <p className="form-error">{save.error.message}</p>}
          <button className="button button-accent" disabled={!happenedOn || !hasChanges || save.isPending}>
            Save changes
          </button>
        </form>
        {confirmingDiscard && (
          <ConfirmDialog
            eyebrow="DISCARD CHANGES"
            title="Leave without saving?"
            description="Your changes to this private revisit log will be lost."
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
