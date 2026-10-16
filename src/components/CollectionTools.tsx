import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, announceTrash, type ArchiveAction } from '../api';
import type { Item, ListDetail } from '../shared/models';

export function CollectionTools({
  list,
  items,
  selectedIds,
  visibleIds,
  onSelection,
  onDone,
  onClose,
}: {
  list: ListDetail;
  items: Item[];
  selectedIds: Set<string>;
  visibleIds: string[];
  onSelection: (ids: Set<string>) => void;
  onDone: (message: string) => void;
  onClose: () => void;
}) {
  const selected = items.filter((i) => selectedIds.has(i.id));
  const [action, setAction] = useState<ArchiveAction['action'] | null>(null);
  return (
    <section className="collection-tools" aria-label="Selected items">
      <p role="status">{selected.length} selected · up to 100 at a time</p>
      <div className="data-actions">
        <button
          className="button button-outline"
          onClick={() => onSelection(new Set(visibleIds.slice(0, 100)))}
        >
          Select visible
        </button>
        <button
          className="button button-outline"
          onClick={() => onSelection(new Set())}
          disabled={!selected.length}
        >
          Clear selection
        </button>
        <button className="button button-outline" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="data-actions">
        {(['move', 'merge', 'queue', 'want', 'type', 'trash'] as const).map((value) => (
          <button
            key={value}
            className="button button-outline"
            disabled={
              !selected.length || (value === 'merge' && (selected.length < 2 || selected.length > 20))
            }
            onClick={() => setAction(value)}
          >
            {
              {
                move: 'Move',
                merge: 'Merge',
                queue: 'Revisit queue',
                want: 'Want to try',
                type: 'Change type',
                trash: 'Move to Trash',
              }[value]
            }
          </button>
        ))}
      </div>
      {action && (
        <ActionDialog
          action={action}
          list={list}
          items={selected}
          onClose={() => setAction(null)}
          onDone={onDone}
        />
      )}
    </section>
  );
}

function ActionDialog({
  action,
  list,
  items,
  onClose,
  onDone,
}: {
  action: ArchiveAction['action'];
  list: ListDetail;
  items: Item[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists, enabled: action === 'move' });
  const [destinationId, setDestination] = useState('');
  const [targetId, setTarget] = useState(items[0]?.id ?? '');
  const [value, setValue] = useState(true);
  const [type, setType] = useState('');
  const retry = useRef({ signature: '', key: crypto.randomUUID() });
  const mutation = useMutation({
    mutationFn: (body: ArchiveAction) => {
      const signature = JSON.stringify(body);
      if (retry.current.signature !== signature) retry.current = { signature, key: crypto.randomUUID() };
      return api.collectionAction(list.id, body, retry.current.key);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      if (action === 'trash') announceTrash(items.map((i) => ({ kind: 'item', id: i.id })));
      onDone(
        `${items.length} ${items.length === 1 ? 'item' : 'items'} ${action === 'move' ? 'moved. They are unranked in the destination.' : action === 'merge' ? 'merged. Originals are available in Details.' : action === 'trash' ? 'moved to Trash.' : 'updated.'}`,
      );
    },
  });
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const titles = {
    move: 'Move items',
    merge: 'Merge items',
    queue: 'Update revisit queue',
    want: 'Update Want to try',
    type: 'Change type',
    trash: 'Move to Trash',
  };
  return (
    <dialog
      ref={dialog}
      className="editor-dialog archive-action-dialog"
      aria-labelledby="archive-action-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!mutation.isPending) onClose();
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mutation.isPending) return;
          const itemIds = items.map((i) => i.id);
          const body: ArchiveAction =
            action === 'move'
              ? { action, itemIds, destinationId }
              : action === 'merge'
                ? { action, itemIds, targetId }
                : action === 'trash'
                  ? { action, itemIds }
                  : action === 'type'
                    ? { action, itemIds, value: type }
                    : { action, itemIds, value };
          mutation.mutate(body);
        }}
      >
        <h2 id="archive-action-title">{titles[action]}</h2>
        <p>
          {items.length} selected in {list.name}.
        </p>
        <ul className="archive-selection-preview">
          {items.map((i) => (
            <li key={i.id}>{i.title}</li>
          ))}
        </ul>
        <fieldset disabled={mutation.isPending}>
          {action === 'move' && (
            <>
              <label>
                Destination
                <select required value={destinationId} onChange={(e) => setDestination(e.target.value)}>
                  <option value="">Choose a collection</option>
                  {lists.data?.lists
                    .filter((l) => l.kind === 'collection' && l.id !== list.id)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </label>
              {lists.isPending && <p role="status">Opening collections…</p>}
              {lists.isError && (
                <p role="alert">
                  {lists.error.message}{' '}
                  <button type="button" onClick={() => void lists.refetch()}>
                    Try again
                  </button>
                </p>
              )}
              {lists.isSuccess &&
                !lists.data.lists.some((l) => l.kind === 'collection' && l.id !== list.id) && (
                  <p>Create another collection before moving items.</p>
                )}
              <p>
                Notes, photos, merged originals and visit history move together. Moved items become unranked;
                existing rankings in the destination stay intact.
              </p>
            </>
          )}
          {action === 'merge' && (
            <>
              <label>
                Main entry
                <select value={targetId} onChange={(e) => setTarget(e.target.value)}>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                The main entry keeps its title, call, Want to try state and rank. Original notes, dates,
                calls, photos and visits remain available in Details. Separate an original there to undo its
                merge; it returns unranked.
              </p>
            </>
          )}
          {(action === 'queue' || action === 'want') && (
            <label>
              Action
              <select value={String(value)} onChange={(e) => setValue(e.target.value === 'true')}>
                <option value="true">Add selected items</option>
                <option value="false">Remove selected items</option>
              </select>
            </label>
          )}
          {action === 'type' && (
            <label>
              Type
              <input
                maxLength={60}
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Leave blank to clear"
              />
            </label>
          )}
          {action === 'trash' && (
            <p>
              Items and their attached history and photos can be restored for 30 days. Restored items return
              unranked.
            </p>
          )}
          {mutation.isError && (
            <p className="form-error" role="alert">
              {mutation.error.message}
            </p>
          )}
          <div className="data-actions">
            <button className="button button-outline" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-accent" disabled={action === 'move' && !destinationId}>
              {mutation.isPending ? 'Saving…' : titles[action]}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
