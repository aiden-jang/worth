import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { X } from '@phosphor-icons/react';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useConnection } from '../hooks/useConnection';
import { today } from '../format';
import { itemInput, logInput } from '../shared/validation';
import { experienceInput } from '../shared/memories';
import {
  quickEntryDraft,
  type QuickEntryDraft,
  type QuickEntryPending,
  type SavedEntry,
} from '../shared/quick-entry';
import type { ListSummary } from '../shared/models';
import { CallChoices } from './PersonalCall';
import { ConfirmDialog } from './ConfirmDialog';

export function QuickEntry({
  lists,
  initialListId,
  initialTitle = '',
  onClose,
  onSaved,
}: {
  lists: ListSummary[];
  initialListId: string;
  initialTitle?: string;
  onClose: () => void;
  onSaved: (entry: SavedEntry) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    name = useRef<HTMLInputElement>(null);
  const online = useConnection(),
    client = useQueryClient();
  const initial: QuickEntryDraft = {
    listId: initialListId,
    title: initialTitle,
    itemId: null,
    note: '',
    decision: null,
    wantToTry: false,
    experienced: false,
    happenedOn: today(),
    pending: null,
  };
  const draft = useDraft<QuickEntryDraft>(
    'quick-entry',
    initial,
    (value): value is QuickEntryDraft => quickEntryDraft.safeParse(value).success,
  );
  const { form, setForm } = draft;
  const target = lists.find((list) => list.id === form.listId && !list.archived);
  const activity = form.pending?.kind === 'activity' || target?.kind === 'activity';
  const collection = target?.kind === 'collection';
  const names = useQuery({
    queryKey: ['items', form.listId],
    queryFn: () => api.items(form.listId),
    enabled: collection && form.experienced,
  });
  const matchingNames = (names.data?.items ?? []).filter(
    (item) => item.title.trim().toLocaleLowerCase() === form.title.trim().toLocaleLowerCase(),
  );
  const ready = form.listId === 'inbox' || !!target;
  const [discard, setDiscard] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(form.note || form.decision || form.wantToTry || form.experienced),
  );
  const [validation, setValidation] = useState('');
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    name.current?.focus();
    return () => node?.close();
  }, []);
  const save = useMutation({
    mutationFn: async (pending: QuickEntryPending): Promise<SavedEntry> => {
      if (pending.kind === 'inbox') {
        const { entry } = await api.createInbox(pending.item, draft.operationId.current);
        return { id: entry.id, title: entry.title, listId: null, kind: 'inbox' };
      }
      if (pending.kind === 'item') {
        const { item } = await api.createItem(pending.listId, pending.item, draft.operationId.current);
        return { id: item.id, title: item.title, listId: item.listId, kind: 'item' };
      }
      if (pending.kind === 'experience') {
        const { item, log } = await api.createExperience(
          pending.listId,
          pending.body,
          draft.operationId.current,
        );
        return {
          id: log.id,
          title: pending.body.title,
          listId: pending.listId,
          kind: 'log',
          // A new name and its first visit are one save; repeat visits undo only the visit.
          undoItemId: pending.body.itemId ? undefined : item.id,
        };
      }
      const { log } = await api.createLog(pending.listId, pending.body, draft.operationId.current);
      return { id: log.id, title: log.title, listId: log.listId, kind: 'log' };
    },
    onSuccess: (entry) => {
      draft.clear();
      for (const key of ['inbox', 'items', 'logs', 'list', 'lists', 'overview', 'patterns', 'search'])
        void client.invalidateQueries({ queryKey: [key] });
      onSaved(entry);
      dialog.current?.close();
    },
  });
  const locked = save.isPending || !!form.pending;
  function edit(patch: Partial<QuickEntryDraft>) {
    setForm({ ...form, ...patch });
    setValidation('');
    save.reset();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending || !online || (!ready && !form.pending)) return;
    try {
      const pending: QuickEntryPending =
        form.pending ??
        (activity
          ? {
              kind: 'activity',
              listId: form.listId,
              body: logInput.parse({ title: form.title, happenedOn: form.happenedOn, note: form.note }),
            }
          : collection && form.experienced
            ? {
                kind: 'experience',
                listId: form.listId,
                body: experienceInput.parse({
                  itemId: form.itemId ?? null,
                  title: form.title,
                  happenedOn: form.happenedOn,
                  note: form.note,
                  context: { reaction: form.decision },
                }),
              }
            : form.listId === 'inbox'
              ? {
                  kind: 'inbox',
                  item: itemInput.parse({
                    title: form.title,
                    note: form.note,
                    decision: form.decision,
                    wantToTry: form.wantToTry,
                  }),
                }
              : {
                  kind: 'item',
                  listId: form.listId,
                  item: itemInput.parse({
                    title: form.title,
                    note: form.note,
                    decision: form.decision,
                    wantToTry: form.wantToTry,
                  }),
                });
      draft.checkpoint({ ...form, pending });
      save.mutate(pending);
    } catch {
      setValidation('Check the name and date before saving.');
      setDetailsOpen(true);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog quick-entry-dialog"
      aria-labelledby="quick-entry-title"
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!save.isPending) dialog.current?.close();
      }}
    >
      <div className="editor-inner">
        <header className="editor-head">
          <h2 id="quick-entry-title">Keep something.</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close Add"
            disabled={save.isPending}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </header>
        <form onSubmit={submit} className="editor-form quick-entry-form">
          <fieldset disabled={locked}>
            <label>
              Name
              <input
                ref={name}
                autoFocus
                required
                maxLength={120}
                value={form.title}
                placeholder="What do you want to remember?"
                onChange={(event) => edit({ title: event.target.value, itemId: null })}
              />
            </label>
            <label>
              Save in
              <select
                value={form.listId}
                onChange={(event) =>
                  edit({
                    listId: event.target.value,
                    itemId: null,
                    experienced:
                      form.experienced &&
                      lists.some((list) => list.id === event.target.value && list.kind === 'collection'),
                    decision:
                      lists.some((list) => list.id === event.target.value && list.kind === 'activity') ||
                      (form.experienced && event.target.value === 'inbox')
                        ? null
                        : form.decision,
                    wantToTry: lists.some(
                      (list) => list.id === event.target.value && list.kind === 'activity',
                    )
                      ? false
                      : form.wantToTry,
                  })
                }
              >
                <option value="inbox">Unfiled — choose a collection later</option>
                {!ready && <option value={form.listId}>Unavailable collection — choose another</option>}
                <optgroup label="Collections">
                  {lists
                    .filter((list) => list.kind === 'collection' && !list.archived)
                    .map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Activity">
                  {lists
                    .filter((list) => list.kind === 'activity' && !list.archived)
                    .map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} · activity entry
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
            {activity && target && (
              <p className="quick-entry-helper">
                One dated activity entry. For exercise sets,{' '}
                <Link to={`/lists/${target.id}`} onClick={() => dialog.current?.close()}>
                  open {target.name} →
                </Link>
              </p>
            )}
            <details
              open={detailsOpen}
              onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
              className="quick-entry-details"
            >
              <summary>{activity ? 'Add a note' : 'Add a note or an opinion'}</summary>
              <label>
                Note <span className="optional">optional</span>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={form.note}
                  onChange={(event) => edit({ note: event.target.value })}
                />
              </label>
              {!activity && (
                <>
                  {collection && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.experienced}
                        onChange={(event) =>
                          edit({
                            experienced: event.target.checked,
                            wantToTry: false,
                            decision: null,
                            itemId: null,
                          })
                        }
                      />
                      Record a dated experience
                    </label>
                  )}
                  <p className="quick-entry-label">
                    {collection && form.experienced ? 'This time' : 'Overall call'}{' '}
                    <span className="optional">optional</span>
                  </p>
                  <CallChoices
                    label={collection && form.experienced ? 'This time' : 'Overall call'}
                    value={form.decision}
                    onChange={(decision) => edit({ decision })}
                  />
                  {!form.experienced && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.wantToTry}
                        onChange={(event) => edit({ wantToTry: event.target.checked })}
                      />
                      Want to try
                    </label>
                  )}
                  {form.listId === 'inbox' && (
                    <p className="quick-entry-helper">
                      Photos and dated visits can be added after choosing a collection.
                    </p>
                  )}
                </>
              )}
            </details>
            {collection && form.experienced && (
              <div className="quick-entry-existing">
                {form.itemId ? (
                  <p>
                    Recording a visit to this saved name.{' '}
                    <button type="button" onClick={() => edit({ itemId: null })}>
                      Use a new name instead
                    </button>
                  </p>
                ) : (
                  matchingNames.length > 0 && (
                    <>
                      <p className="quick-entry-helper">Already in this collection:</p>
                      {matchingNames.slice(0, 5).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className="button button-outline"
                          onClick={() => edit({ itemId: item.id, title: item.title })}
                        >
                          Use saved {item.title}
                          {item.type ? ` · ${item.type}` : ''}
                        </button>
                      ))}
                      <p className="quick-entry-helper">
                        Choose a saved name to add its visit, or Save to keep a separate new name.
                      </p>
                    </>
                  )
                )}
                {names.isError && (
                  <p role="alert">
                    Saved names couldn’t load.{' '}
                    <button type="button" onClick={() => void names.refetch()}>
                      Try again
                    </button>
                  </p>
                )}
              </div>
            )}
            {(activity || (collection && form.experienced)) && (
              <label>
                When
                <input
                  type="date"
                  required
                  value={form.happenedOn}
                  onChange={(event) => edit({ happenedOn: event.target.value })}
                />
              </label>
            )}
          </fieldset>
          {!online && (
            <p role="status">You’re offline. Your draft stays on this device. Reconnect to save.</p>
          )}
          {form.pending && (
            <p className="quick-entry-helper">
              This save is waiting for confirmation. Retry to check the same entry.
            </p>
          )}
          {(save.isError || validation) && (
            <p role="alert" className="form-error">
              {save.error?.message ?? validation}
            </p>
          )}
          {(draft.status.includes('restored') || draft.status.includes('could not')) && (
            <p role="status" className="draft-state">
              {draft.status}
            </p>
          )}
          <button
            className="button button-accent quick-entry-save"
            disabled={!online || save.isPending || (!ready && !form.pending)}
          >
            {save.isPending ? 'Saving…' : form.pending ? 'Retry save' : 'Save'}
          </button>
          <p className="quick-entry-helper">A name is enough. You can add more later.</p>
          {(form.title || form.pending) && (
            <button
              type="button"
              className="quick-entry-discard"
              disabled={save.isPending}
              onClick={() => setDiscard(true)}
            >
              Clear draft
            </button>
          )}
        </form>
      </div>
      {discard && (
        <ConfirmDialog
          title="Clear this draft?"
          description={
            form.pending
              ? 'The save may already have completed. Check your saved entries before starting a new copy. This clears only the draft on this device.'
              : 'This removes the unfinished draft on this device.'
          }
          confirmLabel="Clear draft"
          onClose={() => setDiscard(false)}
          onConfirm={() => {
            draft.clear(initial);
            setForm(initial);
            draft.operationId.current = crypto.randomUUID();
            save.reset();
            setDiscard(false);
          }}
        />
      )}
    </dialog>
  );
}
