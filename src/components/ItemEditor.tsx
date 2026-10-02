import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash, X } from '@phosphor-icons/react';
import type { Item, Log } from '../shared/models';
import { api, type ItemInput } from '../api';
import { formatDate, today } from '../format';
import { ConfirmDialog } from './ConfirmDialog';
import { PhotoControl } from './PhotoControl';

const emptyItem: ItemInput = {
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
  logs,
  onClose,
  onCreated,
}: {
  listId: string;
  item: Item | null;
  logs: Log[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [form, setForm] = useState<ItemInput>(item ? fromItem(item) : emptyItem);
  const [logDate, setLogDate] = useState(today());
  const [logNote, setLogNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'item'; title: string } | { kind: 'log'; id: string; title: string } | null
  >(null);
  const history = logs.filter((log) => log.itemId === item?.id);

  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
    };
  }, []);
  useEffect(() => {
    setForm(item ? fromItem(item) : emptyItem);
  }, [item?.id]);

  const save = useMutation({
    mutationFn: () => (item ? api.updateItem(item.id, form) : api.createItem(listId, form)),
    onSuccess: ({ item: saved }) => {
      if (!item) {
        client.setQueryData<{ items: Item[] }>(['items', listId], (current) => ({
          items: [saved, ...(current?.items ?? [])],
        }));
        onCreated(saved.id);
      }
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
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
      dialog.current?.close();
    },
  });
  const addLog = useMutation({
    mutationFn: () =>
      api.createLog(listId, {
        itemId: item!.id,
        title: '',
        happenedOn: logDate,
        note: logNote,
        amount: null,
        unit: '',
        sets: null,
        reps: null,
      }),
    onSuccess: () => {
      setLogNote('');
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['items', listId] });
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
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
    },
  });

  function saveItem(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  function logAgain(event: FormEvent) {
    event.preventDefault();
    addLog.mutate();
  }

  return (
    <dialog
      className="editor-dialog item-editor-dialog"
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">{item ? 'ITEM DETAIL' : 'NEW ITEM'}</p>
            <h2>{item ? item.title : 'Keep this one.'}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={22} />
          </button>
        </div>
        {item && (
          <PhotoControl
            kind="items"
            id={item.id}
            hasPhoto={item.hasPhoto}
            version={item.updatedAt}
            listId={listId}
          />
        )}
        <form className="editor-form record-form" onSubmit={saveItem}>
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
              onChange={(event) => setForm({ ...form, type: event.target.value })}
              placeholder="Whiskey, wine, film…"
            />
          </label>
          <label>
            Private note <span className="optional">never included in shares</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="What made it worth keeping?"
            />
          </label>
          <fieldset className="item-decision">
            <legend>
              Your call <span className="optional">optional</span>
            </legend>
            <div role="group" aria-label="Item decision">
              <button
                type="button"
                className={form.decision === 'favorite' ? 'active' : ''}
                aria-pressed={form.decision === 'favorite'}
                onClick={() => setForm({ ...form, decision: 'favorite' })}
              >
                Favorite
              </button>
              <button
                type="button"
                className={form.decision === 'would_not_again' ? 'active' : ''}
                aria-pressed={form.decision === 'would_not_again'}
                onClick={() => setForm({ ...form, decision: 'would_not_again' })}
              >
                Would not again
              </button>
              <button
                type="button"
                className={form.decision === null ? 'active' : ''}
                aria-pressed={form.decision === null}
                onClick={() => setForm({ ...form, decision: null })}
              >
                No call yet
              </button>
            </div>
          </fieldset>
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
          {save.isError && <p className="form-error">{save.error.message}</p>}
          <button className="button button-dark" disabled={save.isPending}>
            {item ? 'Save changes' : 'Add item'}
          </button>
        </form>
        {item && (
          <section className="item-history">
            <div className="panel-title">
              <h3>Every time</h3>
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
                  <button
                    className="icon-button"
                    aria-label={`Delete log from ${formatDate(log.happenedOn)}`}
                    onClick={() => setDeleteTarget({ kind: 'log', id: log.id, title: 'this log' })}
                  >
                    <Trash size={17} />
                  </button>
                </div>
              ))}
              {!history.length && (
                <p className="muted">No dates yet. Log it when you try, watch, or revisit it.</p>
              )}
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
                ? 'This permanently removes the item, every log attached to it, and all of their private photos.'
                : 'This permanently removes this log and its private photo, if it has one.'
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
      </div>
    </dialog>
  );
}

function fromItem(item: Item): ItemInput {
  return {
    title: item.title,
    type: item.type,
    note: item.note,
    decision: item.decision,
    startedOn: item.startedOn,
    endedOn: item.endedOn,
  };
}
