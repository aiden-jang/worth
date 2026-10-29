import { X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { api } from '../api';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { preparePhoto } from '../shared/photos';
import { DraftPhoto } from './DraftPhoto';
import { today } from '../format';
import { z } from 'zod';
import { emptyItemContext } from '../shared/item-context';
import type { InboxEntry, InboxPayload } from '../shared/inbox';
import { inboxPayload } from '../shared/inbox';
import { duplicateIdentity } from '../shared/record-identity';
import { captureIssueText } from '../shared/reviewed-capture';
import { ConfirmDialog } from './ConfirmDialog';
import { ItemContextEditor } from './ItemContextEditor';
import { CallChoices } from './PersonalCall';

const editorDraft = z.object({
  item: inboxPayload,
  revision: z.number().int().nonnegative(),
  pending: z.boolean().optional(),
  photoKey: z.string().uuid().optional(),
});
type EditorDraft = z.infer<typeof editorDraft>;
function isEditorDraft(value: unknown): value is EditorDraft {
  return editorDraft.safeParse(value).success;
}

export function InboxEntryEditor({
  entry,
  id,
  onClose,
  onFile,
}: {
  entry: InboxEntry | undefined;
  id: string;
  onClose: () => void;
  onFile: (entry: InboxEntry, target: { id: string; name: string }) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const online = useConnection(),
    client = useQueryClient();
  const initial: EditorDraft = entry
    ? { item: inboxPayload.parse(entry), revision: entry.revision }
    : {
        item: {
          title: '',
          type: '',
          note: '',
          context: emptyItemContext,
          decision: null,
          wantToTry: false,
          revisitQueued: false,
          startedOn: null,
          endedOn: null,
        },
        revision: 0,
      };
  const draft = useDraft<EditorDraft>(`inbox:${id}`, initial, isEditorDraft);
  const { item, revision } = draft.form;
  const photo = useDraftPhoto(`inbox:${id}`);
  const [preparing, setPreparing] = useState(false),
    [photoError, setPhotoError] = useState('');
  const changed = JSON.stringify(item) !== JSON.stringify(initial.item) || !!photo.file;
  const stale = !!entry && revision !== entry.revision;
  const [confirm, setConfirm] = useState<'reload' | 'trash' | 'close' | 'photo' | null>(null);
  const [targetId, setTargetId] = useState('');
  const photoRemoval = useRef<{ revision: number; id: string } | null>(null);
  const [keepSeparate, setKeepSeparate] = useState(false);
  const [status, setStatus] = useState('');
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const collections = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const target = collections.find((list) => list.id === targetId);
  const targetItems = useQuery({
    queryKey: ['items', targetId],
    queryFn: () => api.items(targetId),
    enabled: !!target,
  });
  const duplicate = targetItems.data?.items.some(
    (other) => duplicateIdentity(other) === duplicateIdentity(item),
  );
  const parsed = inboxPayload.safeParse(item);
  const save = useMutation({
    mutationKey: ['inbox'],
    mutationFn: async ({ snapshot, file }: { snapshot: EditorDraft; file: File | null }) => {
      let result = await api.updateInbox(id, inboxPayload.parse(snapshot.item), snapshot.revision);
      if (snapshot.photoKey && file)
        result = await api.uploadInboxPhoto(id, file, snapshot.photoKey, result.entry.revision);
      return result;
    },
    onSuccess: ({ entry: saved }) => {
      const next = { item: inboxPayload.parse(saved), revision: saved.revision };
      draft.clear(next);
      draft.setForm(next);
      photo.clear();
      client.setQueryData<{ entries: InboxEntry[] }>(
        ['inbox'],
        (current) =>
          current && { entries: current.entries.map((other) => (other.id === saved.id ? saved : other)) },
      );
      void client.invalidateQueries();
      setStatus('Changes saved. Still in Unfiled.');
    },
  });
  const trash = useMutation({
    mutationKey: ['inbox'],
    mutationFn: () => api.deleteInbox(id),
    onSuccess: () => {
      draft.clear(initial);
      photo.clear();
      void client.invalidateQueries({ queryKey: ['inbox'] });
      void client.invalidateQueries({ queryKey: ['search'] });
      onClose();
    },
  });
  const reload = useMutation({
    mutationKey: ['inbox'],
    mutationFn: () => api.inboxEntry(id),
    onSuccess: ({ entry: latest }) => {
      const next = { item: inboxPayload.parse(latest), revision: latest.revision };
      client.setQueryData<{ entries: InboxEntry[] }>(
        ['inbox'],
        (current) =>
          current && { entries: current.entries.map((other) => (other.id === latest.id ? latest : other)) },
      );
      draft.clear(next);
      draft.setForm(next);
      photo.clear();
      save.reset();
      setConfirm(null);
      setKeepSeparate(false);
      setStatus('Saved details reloaded.');
    },
  });
  const removePhoto = useMutation({
    mutationFn: () => api.deleteInboxPhoto(id, photoRemoval.current!.revision, photoRemoval.current!.id),
    onSuccess: ({ entry: saved }) => {
      const next = { item: inboxPayload.parse(saved), revision: saved.revision };
      draft.clear(next);
      draft.setForm(next);
      setConfirm(null);
      void client.invalidateQueries();
      setStatus('Photo removed. Your saved details remain.');
    },
  });
  const busy = preparing || save.isPending || trash.isPending || reload.isPending || removePhoto.isPending;
  async function submit() {
    if (!entry || !parsed.success || !online || busy || !photo.ready || (stale && !draft.form.pending))
      return;
    setPreparing(true);
    setPhotoError('');
    try {
      let file: File | null = null,
        photoKey = draft.form.photoKey;
      if (photoKey && (!photo.file || photo.operationId.current !== photoKey))
        throw new Error(
          'This photo draft could not be recovered. Reload saved details before choosing another photo.',
        );
      if (photo.file) {
        const prepared = await photo.freeze(await preparePhoto(photo.file));
        file = prepared.file;
        photoKey = prepared.key;
      }
      const snapshot = { ...draft.form, pending: true, photoKey };
      draft.checkpoint(snapshot);
      save.mutate({ snapshot, file });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'This photo could not be prepared.');
    } finally {
      setPreparing(false);
    }
  }
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function edit(patch: Partial<InboxPayload>) {
    draft.setForm({ item: { ...item, ...patch }, revision });
    save.reset();
    setKeepSeparate(false);
    setStatus('');
  }
  function closeFind() {
    if (changed && draft.status.includes('could not be saved')) setConfirm('close');
    else dialog.current?.close();
  }
  return createPortal(
    <dialog
      className="inbox-editor"
      ref={dialog}
      aria-label="Keep the details."
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        if (!busy) closeFind();
      }}
    >
      <header className="dialog-head">
        <div>
          <p className="overline">UNFILED</p>
          <h2>Keep the details.</h2>
        </div>
        <button className="icon-button" aria-label="Close find" disabled={busy} onClick={closeFind}>
          <X size={22} />
        </button>
      </header>
      <p>
        Only a name is needed. Dates and a photo are optional. Unfinished changes stay on this device for
        seven days.
      </p>
      {!online && <p role="status">You’re offline. This draft stays on this device; reconnect to save.</p>}
      {!entry && (
        <section className="error-banner" aria-label="Unavailable find">
          <p>
            This find was filed or removed elsewhere. Any recovered draft is still here for you to copy.
            Saving and filing are unavailable.
          </p>
          <button
            className="button button-outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(JSON.stringify(item, null, 2));
                setStatus('Draft details copied.');
              } catch {
                setStatus('Select and copy the fields below before closing.');
              }
            }}
          >
            Copy draft details
          </button>
        </section>
      )}
      {stale && !draft.form.pending && (
        <p className="error-banner" role="alert">
          This find changed elsewhere. Your draft is still here. Reload its saved details before saving or
          filing.
        </p>
      )}
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={busy || !!draft.form.pending}>
          <label>
            Name
            <input
              autoFocus
              maxLength={120}
              value={item.title}
              onChange={(event) => edit({ title: event.target.value })}
            />
          </label>
          <details className="record-extras" open={!!item.memory}>
            <summary>
              Memory details <span>optional</span>
            </summary>
            <label className="inbox-check">
              <input
                type="checkbox"
                checked={!!item.memory}
                onChange={(event) =>
                  edit({ memory: event.target.checked ? { happenedOn: today(), reaction: null } : null })
                }
              />
              Record a dated experience
            </label>
            {item.memory && (
              <>
                <label>
                  When
                  <input
                    type="date"
                    value={item.memory.happenedOn}
                    required
                    onChange={(event) =>
                      edit({ memory: { ...item.memory!, happenedOn: event.target.value } })
                    }
                  />
                </label>
                <p>
                  This time <span className="optional">optional</span>
                </p>
                <CallChoices
                  label="This time"
                  value={item.memory.reaction}
                  onChange={(reaction) => edit({ memory: { ...item.memory!, reaction } })}
                />
                <p>The overall call stays separate.</p>
              </>
            )}
          </details>
          <label>
            Type
            <input
              maxLength={60}
              value={item.type}
              onChange={(event) => edit({ type: event.target.value })}
            />
          </label>
          <label>
            Private note
            <textarea
              rows={3}
              maxLength={4000}
              value={item.note}
              onChange={(event) => edit({ note: event.target.value })}
            />
          </label>
          <details className="record-extras">
            <summary>
              Call, plans and dates <span>optional</span>
            </summary>
            <CallChoices value={item.decision} onChange={(decision) => edit({ decision })} />
            <p>No call is separate from Meh. Click a selected call again to clear it.</p>
            <label className="inbox-check">
              <input
                type="checkbox"
                checked={item.wantToTry}
                onChange={(event) => edit({ wantToTry: event.target.checked })}
              />
              Want to try
            </label>
            <label className="inbox-check">
              <input
                type="checkbox"
                checked={item.revisitQueued}
                onChange={(event) => edit({ revisitQueued: event.target.checked })}
              />
              Revisit queue
            </label>
            <div className="date-pair">
              <label>
                Started on
                <input
                  type="date"
                  value={item.startedOn ?? ''}
                  onChange={(event) => edit({ startedOn: event.target.value || null })}
                />
              </label>
              <label>
                Finished on
                <input
                  type="date"
                  value={item.endedOn ?? ''}
                  onChange={(event) => edit({ endedOn: event.target.value || null })}
                />
              </label>
            </div>
          </details>
          <ItemContextEditor
            value={item.context}
            title={item.title}
            onChange={(context) => edit({ context })}
          />
          {entry?.photo?.available && (
            <img
              className="unfiled-photo"
              src={`/api/inbox/${id}/photo?v=${entry.revision}`}
              alt={`Saved photo for ${item.title}`}
            />
          )}
          {entry?.photo && !entry.photo.available && (
            <p>This records-only copy has no photo original. Choose a photo to attach one.</p>
          )}
          <DraftPhoto
            file={photo.file}
            onChange={photo.change}
            disabled={busy || !!draft.form.pending || !photo.ready}
            helper="Keeps one private photo with this Unfiled find. It stays attached when you file it."
          />
          {entry?.photo && (
            <button
              className="button button-outline"
              type="button"
              disabled={changed || stale || busy || !online || !!draft.form.pending}
              onClick={() => {
                photoRemoval.current = { revision: entry.revision, id: entry.photo!.id };
                setConfirm('photo');
              }}
            >
              Remove saved photo
            </button>
          )}
        </fieldset>
        {photo.status && (
          <p role="status" className="draft-state">
            {photo.status}
          </p>
        )}
        {photoError && (
          <p role="alert" className="form-error">
            {photoError}
          </p>
        )}
        {entry && !parsed.success && (
          <p className="form-error" role="alert">
            {captureIssueText(parsed.error.issues)}
          </p>
        )}
        <div className="data-actions">
          <button
            className="button button-accent"
            disabled={
              busy ||
              !photo.ready ||
              !online ||
              !entry ||
              (stale && !draft.form.pending) ||
              !parsed.success ||
              (!changed && !draft.form.pending)
            }
          >
            {draft.form.pending ? 'Retry save' : 'Save changes'}
          </button>
          <button
            className="button button-outline"
            type="button"
            disabled={busy}
            onClick={() => setConfirm('reload')}
          >
            Reload saved details
          </button>
        </div>
        {draft.form.pending && (
          <p>This save is waiting for confirmation. Retry checks the same details and photo.</p>
        )}
      </form>
      {draft.status && (
        <p className="draft-status" role="status">
          {draft.status}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {save.isError && (
        <p className="form-error" role="alert">
          {save.error.message}
        </p>
      )}
      <section className="inbox-filing" aria-label="File this find">
        <p className="overline">GIVE IT A PLACE</p>
        <h3>File when you’re ready.</h3>
        <p>Moves this saved find into one collection, unranked. Its details, date and photo stay with it.</p>
        {changed && <p>Save or reload your changes before filing.</p>}
        {lists.isError && (
          <p role="alert">
            {lists.error.message}{' '}
            <button className="button button-outline" onClick={() => void lists.refetch()}>
              Retry collections
            </button>
          </p>
        )}
        <label>
          Destination collection
          <select
            value={targetId}
            disabled={busy || lists.isPending}
            onChange={(event) => {
              setTargetId(event.target.value);
              setKeepSeparate(false);
            }}
          >
            <option value="">Choose a collection</option>
            {collections.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>
        {!lists.isPending && !collections.length && (
          <p>
            <Link to="/lists?kind=collection&create=1" onClick={onClose}>
              Create a collection
            </Link>
            . This find can wait here.
          </p>
        )}
        {targetItems.isError && (
          <p role="alert">
            {targetItems.error.message}{' '}
            <button className="button button-outline" onClick={() => void targetItems.refetch()}>
              Retry destination check
            </button>
          </p>
        )}
        {duplicate && (
          <label className="inbox-check">
            <input
              type="checkbox"
              checked={keepSeparate}
              onChange={(event) => setKeepSeparate(event.target.checked)}
            />
            A record with this name and type already exists. Keep a separate record.
          </label>
        )}
        <button
          className="button button-accent"
          disabled={
            busy ||
            !entry ||
            !online ||
            changed ||
            stale ||
            !!draft.form.pending ||
            !target ||
            targetItems.isPending ||
            targetItems.isError ||
            (duplicate && !keepSeparate)
          }
          onClick={() => {
            if (entry && target) onFile(entry, target);
          }}
        >
          File in collection
        </button>
      </section>
      <button
        className="button button-outline"
        disabled={busy || !online || !entry}
        onClick={() => setConfirm('trash')}
      >
        Move find to Trash
      </button>
      {confirm === 'reload' && (
        <ConfirmDialog
          title="Reload this find?"
          description="Replaces this device’s unfinished changes with the latest saved details."
          confirmLabel="Reload details"
          onClose={() => setConfirm(null)}
          pending={reload.isPending}
          error={reload.error?.message}
          onConfirm={() => reload.mutate()}
        />
      )}
      {confirm === 'photo' && (
        <ConfirmDialog
          title="Remove this saved photo?"
          description="Permanently removes this photo original. Your name, note and date remain."
          confirmLabel="Remove photo"
          pending={removePhoto.isPending}
          error={removePhoto.error?.message}
          onClose={() => setConfirm(null)}
          onConfirm={() => removePhoto.mutate()}
        />
      )}
      {confirm === 'close' && (
        <ConfirmDialog
          title="Close without a saved draft?"
          description="This device couldn’t keep your unfinished changes. Cancel to copy or save them before closing. Closing now discards these changes."
          confirmLabel="Discard changes and close"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            draft.clear(initial);
            dialog.current?.close();
          }}
        />
      )}
      {confirm === 'trash' && (
        <ConfirmDialog
          title="Move this find to Trash?"
          description="Keeps its saved details recoverable for 30 days. Unfinished changes on this device are discarded."
          confirmLabel="Move to Trash"
          pending={trash.isPending}
          error={trash.error?.message}
          onClose={() => setConfirm(null)}
          onConfirm={() => trash.mutate()}
        />
      )}
    </dialog>,
    document.body,
  );
}
