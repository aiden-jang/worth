import { X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { api } from '../api';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { isItemDraft } from '../shared/drafts';
import { emptyItemContext } from '../shared/item-context';
import type { InboxEntry, InboxPayload } from '../shared/inbox';
import { itemInput } from '../shared/validation';
import { duplicateIdentity } from '../shared/record-identity';
import { captureIssueText } from '../shared/reviewed-capture';
import { ConfirmDialog } from './ConfirmDialog';
import { ItemContextEditor } from './ItemContextEditor';
import { CallChoices } from './PersonalCall';

type EditorDraft = { item: InboxPayload; revision: number };
function isEditorDraft(value: unknown): value is EditorDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as EditorDraft;
  return Number.isInteger(draft.revision) && draft.revision >= 0 && isItemDraft(draft.item);
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
    ? { item: itemInput.parse(entry), revision: entry.revision }
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
  const changed = JSON.stringify(item) !== JSON.stringify(initial.item);
  const stale = !!entry && revision !== entry.revision;
  const [confirm, setConfirm] = useState<'reload' | 'trash' | 'close' | null>(null);
  const [targetId, setTargetId] = useState('');
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
  const parsed = itemInput.safeParse(item);
  const save = useMutation({
    mutationKey: ['inbox'],
    mutationFn: () => api.updateInbox(id, itemInput.parse(item), revision),
    onSuccess: ({ entry: saved }) => {
      const next = { item: itemInput.parse(saved), revision: saved.revision };
      draft.clear(next);
      draft.setForm(next);
      client.setQueryData<{ entries: InboxEntry[] }>(
        ['inbox'],
        (current) =>
          current && { entries: current.entries.map((other) => (other.id === saved.id ? saved : other)) },
      );
      void client.invalidateQueries({ queryKey: ['search'] });
      setStatus('Changes saved. Still in the Inbox.');
    },
  });
  const trash = useMutation({
    mutationKey: ['inbox'],
    mutationFn: () => api.deleteInbox(id),
    onSuccess: () => {
      draft.clear(initial);
      void client.invalidateQueries({ queryKey: ['inbox'] });
      void client.invalidateQueries({ queryKey: ['search'] });
      onClose();
    },
  });
  const reload = useMutation({
    mutationKey: ['inbox'],
    mutationFn: () => api.inboxEntry(id),
    onSuccess: ({ entry: latest }) => {
      const next = { item: itemInput.parse(latest), revision: latest.revision };
      client.setQueryData<{ entries: InboxEntry[] }>(
        ['inbox'],
        (current) =>
          current && { entries: current.entries.map((other) => (other.id === latest.id ? latest : other)) },
      );
      draft.clear(next);
      draft.setForm(next);
      save.reset();
      setConfirm(null);
      setKeepSeparate(false);
      setStatus('Saved details reloaded.');
    },
  });
  const busy = save.isPending || trash.isPending || reload.isPending;
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
      aria-labelledby="inbox-editor-title"
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
          <p className="overline">INBOX / UNFILED</p>
          <h2 id="inbox-editor-title">Keep the details.</h2>
        </div>
        <button className="icon-button" aria-label="Close find" disabled={busy} onClick={closeFind}>
          <X size={22} />
        </button>
      </header>
      <p>
        Only a name is needed. You can add photos and visits after filing. Unfinished changes stay on this
        device for seven days.
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
      {stale && (
        <p className="error-banner" role="alert">
          This find changed elsewhere. Your draft is still here. Reload its saved details before saving or
          filing.
        </p>
      )}
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (entry && parsed.success && !stale && online && !busy) save.mutate();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Name
            <input
              autoFocus
              maxLength={120}
              value={item.title}
              onChange={(event) => edit({ title: event.target.value })}
            />
          </label>
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
        </fieldset>
        {entry && !parsed.success && (
          <p className="form-error" role="alert">
            {captureIssueText(parsed.error.issues)}
          </p>
        )}
        <div className="data-actions">
          <button
            className="button button-accent"
            disabled={busy || !online || !entry || stale || !parsed.success || !changed}
          >
            Save changes
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
        <p>
          Moves this saved find into one collection, unranked. Its note, context and any call stay with it.
        </p>
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
