import { PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type ItemInput } from '../api';
import { formatDate, today } from '../format';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { isItemDraft } from '../shared/drafts';
import type { Item, Log } from '../shared/models';
import { preparePhoto } from '../shared/photos';
import { CollectionLogEditor } from './CollectionLogEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { DraftPhoto } from './DraftPhoto';
import { MergedRecords } from './MergedRecords';
import { OpinionSlip } from './OpinionSlip';
import { PhotoControl } from './PhotoControl';
import { ItemContextEditor } from './ItemContextEditor';
import { emptyItemContext } from '../shared/item-context';

const emptyItem: ItemInput = {
  context: emptyItemContext,
  expectedContextRevision: 0,
  wantToTry: false,
  title: '',
  type: '',
  note: '',
  decision: null,
  startedOn: null,
  endedOn: null,
};

export function ItemEditor({
  listId,
  item,
  rank,
  items,
  logs,
  focusLogId,
  focusLogComposer,
  focusNoteComposer,
  onClose,
  onCreated,
}: {
  listId: string;
  item: Item | null;
  rank?: number;
  items: Item[];
  logs: Log[];
  focusLogId: string | null;
  focusLogComposer: boolean;
  focusNoteComposer: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const logNoteInput = useRef<HTMLInputElement>(null);
  const itemNoteInput = useRef<HTMLTextAreaElement>(null);
  const client = useQueryClient();
  const draft = useDraft<ItemInput>(
    `item:${listId}:${item?.id ?? 'new'}`,
    item ? fromItem(item) : emptyItem,
    isItemDraft,
  );
  const { form, setForm } = draft;
  const photoDraft = useDraftPhoto(`item:${listId}:${item?.id ?? 'new'}`);
  const photo = photoDraft.file;
  const setPhoto = photoDraft.change;
  const online = useConnection();
  const previousItemId = useRef(item?.id);
  const [savedForm, setSavedForm] = useState<ItemInput>(item ? fromItem(item) : emptyItem);
  const [logDate, setLogDate] = useState(today());
  const [logNote, setLogNote] = useState('');
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [confirmingContextReload, setConfirmingContextReload] = useState(false);
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [handledFocusLogId, setHandledFocusLogId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'item'; title: string } | { kind: 'log'; id: string; title: string } | null
  >(null);
  const history = logs.filter(
    (log) => log.itemId === item?.id || item?.mergedIds?.includes(log.itemId ?? ''),
  );
  const typeSuggestions = Array.from(new Set(items.map((entry) => entry.type).filter(Boolean))).sort();
  const hasItemChanges = JSON.stringify(form) !== JSON.stringify(savedForm);
  const hasUnsavedChanges = hasItemChanges || Boolean(logNote.trim()) || Boolean(photo);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  useEffect(() => {
    const nextForm = item ? fromItem(item) : emptyItem;
    if (previousItemId.current !== item?.id) {
      setForm(nextForm);
      draft.clear();
      previousItemId.current = item?.id;
    }
    setSavedForm(nextForm);
    // Save handles the new baseline. Photo/query refreshes must not replace an active draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  useEffect(() => {
    if (!focusLogId || focusLogId === handledFocusLogId || !item) return;
    const focusedLog = logs.find(
      (log) =>
        log.id === focusLogId && (log.itemId === item.id || item.mergedIds?.includes(log.itemId ?? '')),
    );
    if (focusedLog) {
      setEditingLog(focusedLog);
      setHandledFocusLogId(focusLogId);
    }
  }, [focusLogId, handledFocusLogId, item, logs]);
  useEffect(() => {
    if (!focusLogComposer || !item) return;
    requestAnimationFrame(() => {
      logNoteInput.current?.scrollIntoView({ block: 'center' });
      logNoteInput.current?.focus();
    });
  }, [focusLogComposer, item]);
  useEffect(() => {
    if (!focusNoteComposer || !item) return;
    requestAnimationFrame(() => {
      itemNoteInput.current?.scrollIntoView({ block: 'center' });
      itemNoteInput.current?.focus();
    });
  }, [focusNoteComposer, item]);

  const save = useMutation({
    mutationFn: async () => {
      const input = cleanItemInput(form);
      if (item && JSON.stringify(form.context) === JSON.stringify(savedForm.context)) {
        delete input.context;
        delete input.expectedContextRevision;
      }
      const blob = photo ? await preparePhoto(photo) : null;
      const id = item?.id ?? draft.savedId.current;
      let result = id
        ? await api.updateItem(id, input)
        : await api.createItem(listId, input, draft.operationId.current);
      draft.rememberSaved(result.item.id);
      if (!id) result = await api.updateItem(result.item.id, input);
      if (blob) {
        await api.uploadPhoto('items', result.item.id, blob);
        result.item.hasPhoto = true;
      }
      return result;
    },
    onSuccess: ({ item: saved }) => {
      draft.clear(fromItem(saved));
      setPhoto(null);
      if (!item) {
        client.setQueryData<{ items: Item[] }>(['items', listId], (current) => ({
          items: [saved, ...(current?.items ?? [])],
        }));
        onCreated(saved.id);
      } else {
        const nextForm = fromItem(saved);
        setForm(nextForm);
        setSavedForm(nextForm);
      }
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ['items', listId] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteItem(item!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      dialog.current?.close();
    },
  });
  const addLog = useMutation({
    mutationFn: () =>
      api.createLog(listId, {
        itemId: item!.id,
        title: '',
        happenedOn: logDate,
        note: logNote.trim(),
        amount: null,
        unit: '',
        sets: null,
        reps: null,
      }),
    onSuccess: ({ log }) => {
      setLogNote('');
      setEditingLog(log);
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
    },
  });
  const deleteLog = useMutation({
    mutationFn: api.deleteLog,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
    },
  });

  function saveItem(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    save.mutate();
  }
  function logAgain(event: FormEvent) {
    event.preventDefault();
    addLog.mutate();
  }

  function requestClose() {
    if (save.isPending || addLog.isPending || remove.isPending) return;
    if (hasUnsavedChanges) {
      setConfirmingDiscard(true);
      return;
    }
    dialog.current?.close();
  }

  return (
    <dialog
      className="editor-dialog item-editor-dialog"
      aria-labelledby="item-editor-title"
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
            <p className="overline">{item ? 'ITEM DETAIL' : 'NEW ITEM'}</p>
            <h2 id="item-editor-title">{item ? item.title : 'Keep this one.'}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={requestClose}>
            <X size={22} />
          </button>
        </div>
        <form
          className="editor-form record-form record-layout"
          onSubmit={saveItem}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !save.isPending) {
              event.preventDefault();
              event.currentTarget.requestSubmit();
            }
          }}
        >
          <div className="record-identity">
            <label>
              Name
              <input
                required
                autoFocus={!item}
                maxLength={120}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="The thing you want to remember"
              />
            </label>
            <label>
              Type <span className="optional">optional</span>
              <input
                maxLength={60}
                value={form.type}
                list={`item-types-${listId}`}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
                placeholder="Whiskey, wine, film…"
              />
              {typeSuggestions.length > 0 && (
                <datalist id={`item-types-${listId}`}>
                  {typeSuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              )}
            </label>
          </div>
          <OpinionSlip
            className="record-call"
            title={form.title.trim() || 'This one'}
            type={form.type}
            rank={rank}
            decision={form.decision}
            onChange={(decision) => setForm({ ...form, decision })}
          >
            <p className="record-call-hint">Optional. Tap the selected call to clear it.</p>
          </OpinionSlip>
          <div className="record-notes">
            <label className="capture-want">
              <input
                type="checkbox"
                checked={Boolean(form.wantToTry)}
                onChange={(e) => setForm({ ...form, wantToTry: e.target.checked })}
              />
              Want to try
            </label>
            <label>
              Private note <span className="optional">never included in shares</span>
              <textarea
                ref={itemNoteInput}
                rows={3}
                maxLength={4000}
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="Anything to remember?"
              />
            </label>
            <details className="record-extras" open={Boolean(item?.startedOn || item?.endedOn)}>
              <summary>
                Dates <span>optional</span>
              </summary>
              <div className="date-pair">
                <label>
                  From <span className="optional">optional</span>
                  <input
                    type="date"
                    value={form.startedOn ?? ''}
                    onChange={(event) => setForm({ ...form, startedOn: event.target.value || null })}
                  />
                </label>
                <label>
                  To <span className="optional">optional</span>
                  <input
                    type="date"
                    value={form.endedOn ?? ''}
                    onChange={(event) => setForm({ ...form, endedOn: event.target.value || null })}
                  />
                </label>
              </div>
            </details>
            <ItemContextEditor
              value={form.context}
              onChange={(context) => setForm({ ...form, context })}
              title={form.title}
            />
            {item && (form.expectedContextRevision ?? 0) !== (item.contextRevision ?? 0) && (
              <div role="alert">
                <p>Saved context changed elsewhere. Your context draft is still here.</p>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setConfirmingContextReload(true)}
                >
                  Reload saved context
                </button>
              </div>
            )}
          </div>
          {!item && (
            <div className="record-notes">
              <DraftPhoto file={photo} onChange={setPhoto} disabled={save.isPending} />
              {photoDraft.status && (
                <p className="draft-state" role="status">
                  {photoDraft.status}
                </p>
              )}
            </div>
          )}
          <div className="record-save">
            {save.isError && (
              <p className="form-error" role="alert">
                {draft.savedId.current
                  ? 'Record saved. Retry to finish saving changes or the photo; it will not create a duplicate. '
                  : ''}
                {save.error.message}
              </p>
            )}
            <button
              className="button button-accent"
              disabled={
                !online ||
                !photoDraft.ready ||
                !form.title.trim() ||
                save.isPending ||
                Boolean(item && !hasItemChanges)
              }
            >
              {save.isPending ? 'Saving…' : item ? 'Save changes' : 'Add item'}
            </button>
            {draft.status && (
              <span className="draft-state" role="status">
                {draft.status}
              </span>
            )}
            {save.isSuccess && !hasItemChanges && <span role="status">Saved.</span>}
          </div>
        </form>
        {item && (
          <details className="record-extras record-photo" open={item.hasPhoto}>
            <summary>
              Photo <span>optional · private</span>
            </summary>
            <PhotoControl
              kind="items"
              id={item.id}
              hasPhoto={item.hasPhoto}
              version={item.updatedAt}
              listId={listId}
            />
          </details>
        )}
        {item && <MergedRecords item={item} />}
        {item && (
          <section className="item-history">
            <div className="panel-title">
              <h3>Revisits</h3>
              <span>
                {history.length} {history.length === 1 ? 'log' : 'logs'}
              </span>
            </div>
            <form className="repeat-form" onSubmit={logAgain}>
              <input
                type="date"
                aria-label="Date"
                required
                value={logDate}
                onChange={(event) => setLogDate(event.target.value)}
              />
              <input
                ref={logNoteInput}
                value={logNote}
                maxLength={4000}
                aria-label="Note"
                onChange={(event) => setLogNote(event.target.value)}
                placeholder="A note, if you want"
              />
              <button className="button button-outline" disabled={addLog.isPending}>
                <Plus size={17} /> Log again
              </button>
            </form>
            {addLog.isError && <p className="form-error">{addLog.error.message}</p>}
            <div className="history-list">
              {history.map((log) => (
                <div key={log.id} className="history-row">
                  <span>{formatDate(log.happenedOn)}</span>
                  <p>{log.note || 'No note'}</p>
                  <div className="history-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit log from ${formatDate(log.happenedOn)}`}
                      onClick={() => setEditingLog(log)}
                    >
                      <PencilSimple size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete log from ${formatDate(log.happenedOn)}`}
                      onClick={() => setDeleteTarget({ kind: 'log', id: log.id, title: 'this log' })}
                    >
                      <Trash size={17} />
                    </button>
                  </div>
                </div>
              ))}
              {!history.length && <p className="muted">Been here before? Log a revisit.</p>}
            </div>
          </section>
        )}
        {item && (
          <button
            className="text-danger"
            onClick={() => setDeleteTarget({ kind: 'item', title: item.title })}
            disabled={remove.isPending}
          >
            Delete item
          </button>
        )}
        {remove.isError && <p className="form-error">{remove.error.message}</p>}
        {deleteTarget && (
          <ConfirmDialog
            eyebrow={deleteTarget.kind === 'item' ? 'DELETE ITEM' : 'DELETE LOG'}
            title={`Delete ${deleteTarget.title}?`}
            description={
              deleteTarget.kind === 'item'
                ? 'This moves the item, merged originals, attached logs and private photos to Trash for 30 days. Restored items return unranked.'
                : 'This moves the log and its private photo to Trash for 30 days.'
            }
            confirmLabel={deleteTarget.kind === 'item' ? 'Delete item' : 'Delete log'}
            pending={deleteTarget.kind === 'item' ? remove.isPending : deleteLog.isPending}
            error={
              deleteTarget.kind === 'item'
                ? remove.isError
                  ? remove.error.message
                  : undefined
                : deleteLog.isError
                  ? deleteLog.error.message
                  : undefined
            }
            onConfirm={() => {
              if (deleteTarget.kind === 'item') remove.mutate();
              else deleteLog.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
            }}
            onClose={() => setDeleteTarget(null)}
          />
        )}
        {confirmingDiscard && (
          <ConfirmDialog
            eyebrow="DISCARD CHANGES"
            title="Leave without saving?"
            description="Your changes to this private record will be lost."
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
        {confirmingContextReload && item && (
          <ConfirmDialog
            title="Replace this context draft?"
            description="This loads the latest saved context and replaces your local context edits. Your name, note, dates and call edits stay in place."
            confirmLabel="Reload saved context"
            onConfirm={() => {
              setForm({
                ...form,
                context: item.context ?? emptyItemContext,
                expectedContextRevision: item.contextRevision ?? 0,
              });
              setConfirmingContextReload(false);
            }}
            onClose={() => setConfirmingContextReload(false)}
          />
        )}
        {editingLog && (
          <CollectionLogEditor log={editingLog} listId={listId} onClose={() => setEditingLog(null)} />
        )}
      </div>
    </dialog>
  );
}

function fromItem(item: Item): ItemInput {
  return {
    context: item.context ?? emptyItemContext,
    expectedContextRevision: item.contextRevision ?? 0,
    wantToTry: item.wantToTry ?? false,
    title: item.title,
    type: item.type,
    note: item.note,
    decision: item.decision,
    startedOn: item.startedOn,
    endedOn: item.endedOn,
  };
}

function cleanItemInput(input: ItemInput): ItemInput {
  return { ...input, title: input.title.trim(), type: input.type.trim(), note: input.note.trim() };
}
