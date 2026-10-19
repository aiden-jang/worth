import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { decisionLabel } from '../shared/decisions';
import type { Item, ListDetail, Log } from '../shared/models';
import { historyDraft, historyOrder, type TasteEvent } from '../shared/taste-history';
import { ConfirmDialog } from './ConfirmDialog';
import '../taste-history.css';

export function TasteHistory({
  list,
  items,
  logs,
  onDraft,
  onOpen,
}: {
  list: ListDetail;
  items: Item[];
  logs: Log[];
  onDraft: (ids: string[]) => void;
  onOpen: (id: string) => void;
}) {
  const [before, setBefore] = useState('');
  const [filter, setFilter] = useState<'all' | 'rank' | 'opinion'>('all');
  const [editing, setEditing] = useState<TasteEvent | null>(null);
  const [selected, setSelected] = useState<string>('');
  const parsedBefore = before ? new Date(before + 'T00:00:00').valueOf() : NaN;
  const until = Number.isFinite(parsedBefore) ? String(parsedBefore) : '';
  const query = useInfiniteQuery({
    queryKey: ['taste-history', list.id, until],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => api.tasteHistory(list.id, pageParam, until, signal),
    getNextPageParam: (page) => page.next ?? undefined,
  });
  const events = query.data?.pages.flatMap((page) => page.events) ?? [];
  const available = new Set(items.map((i) => i.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const mergedParents = new Map(
    items.flatMap((item) => (item.mergedIds ?? []).map((id) => [id, item.title] as const)),
  );
  return (
    <section className="workbench-section taste-history" aria-label="Taste history">
      <h3>A paper trail.</h3>
      <p>
        Future ranking and call changes appear here. Earlier changes are unknown. Dates record when a change
        was saved; names are current.
      </p>
      <div className="workbench-filters">
        <label>
          Changes
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All changes</option>
            <option value="rank">Rankings</option>
            <option value="opinion">Opinions</option>
          </select>
        </label>
        <label>
          Before this date (optional)
          <input
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
          />
        </label>
      </div>
      <p>Looking back is optional. No reminders are scheduled.</p>
      {query.isPending && <p role="status">Opening history…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message} <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      )}
      {query.isSuccess && !events.length && (
        <p>No saved changes in this period. Existing calls and rankings are unchanged.</p>
      )}
      <div className="taste-history-events">
        {events
          .filter((event) => filter === 'all' || event.kind === filter)
          .map((event) => (
            <article className="taste-history-event" key={event.id}>
              <p className="overline">
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>{' '}
                · {event.kind === 'rank' ? 'Ranking' : 'Opinion'}
              </p>
              {event.kind === 'opinion' ? (
                <>
                  <h4>
                    {byId.get(event.itemId)?.title ??
                      `Merged original${mergedParents.has(event.itemId) ? ` of ${mergedParents.get(event.itemId)}` : ''}`}
                  </h4>
                  <p>
                    {decisionLabel(event.before) || 'No call'} <span aria-hidden="true">→</span>
                    <span className="sr-only">changed to</span> {decisionLabel(event.after) || 'No call'}
                  </p>
                  {byId.has(event.itemId) && (
                    <p>Current call: {decisionLabel(byId.get(event.itemId)!.decision) || 'No call'}</p>
                  )}
                  {available.has(event.itemId) && (
                    <button className="button button-outline" onClick={() => onOpen(event.itemId)}>
                      Open current record
                    </button>
                  )}
                </>
              ) : (
                <>
                  <h4>Ranking changed</h4>
                  <button
                    className="button button-outline"
                    aria-expanded={selected === event.id}
                    onClick={() => setSelected(selected === event.id ? '' : event.id)}
                  >
                    Compare orders
                  </button>
                  {selected === event.id && (
                    <>
                      <p>
                        Unavailable positions remain gaps. This view does not change your current ranking.
                      </p>
                      <div className="taste-history-orders">
                        <Order title="Before" ids={historyOrder(event.before, available)} items={byId} />
                        <Order title="After" ids={historyOrder(event.after, available)} items={byId} />
                        <Order title="Current" ids={list.rankedIds} items={byId} />
                      </div>
                      <div className="data-actions">
                        <button
                          className="button button-outline"
                          onClick={() =>
                            onDraft(event.before.filter((id): id is string => !!id && available.has(id)))
                          }
                        >
                          Review before order in sandbox
                        </button>
                        <button
                          className="button button-outline"
                          onClick={() =>
                            onDraft(event.after.filter((id): id is string => !!id && available.has(id)))
                          }
                        >
                          Review after order in sandbox
                        </button>
                      </div>
                      <p>
                        Only available records enter the sandbox. Other records stay unranked if you later
                        apply it.
                      </p>
                    </>
                  )}
                </>
              )}
              {event.reason && <p className="workbench-note">{event.reason}</p>}
              {event.logId && (
                <p>Linked visit: {logs.find((g) => g.id === event.logId)?.happenedOn ?? 'Unavailable'}</p>
              )}
              <button className="button button-outline" onClick={() => setEditing(event)}>
                {event.kind === 'opinion' ? 'Reason & visit' : 'Reason'}
              </button>
            </article>
          ))}
      </div>
      {!!events.length && !events.some((event) => filter === 'all' || event.kind === filter) && (
        <p>No matching changes on the loaded pages.</p>
      )}
      {query.hasNextPage && (
        <button
          className="button button-outline"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Opening older changes…' : 'Load older changes'}
        </button>
      )}
      {editing && (
        <HistoryNote
          key={editing.id}
          event={editing}
          items={items}
          logs={logs}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
function Order({ title, ids, items }: { title: string; ids: (string | null)[]; items: Map<string, Item> }) {
  return (
    <section className="taste-history-order" aria-label={`${title} order`}>
      <h5>{title}</h5>
      <ol>
        {ids.map((id, index) => (
          <li key={index}>{id ? (items.get(id)?.title ?? 'Unavailable record') : 'Unavailable record'}</li>
        ))}
      </ol>
      {!ids.length && <p>All unranked</p>}
    </section>
  );
}
function HistoryNote({
  event,
  items,
  logs,
  onClose,
}: {
  event: TasteEvent;
  items: Item[];
  logs: Log[];
  onClose: () => void;
}) {
  const node = useRef<HTMLDialogElement>(null),
    client = useQueryClient();
  const initial = { reason: event.reason, logId: event.logId, expectedRevision: event.revision };
  const draft = useDraft(`history:${event.id}`, initial, historyDraft);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saved, setSaved] = useState(event);
  const dirty = draft.form.reason !== saved.reason || draft.form.logId !== saved.logId;
  const item = items.find((i) => i.id === event.itemId);
  const visits =
    event.kind === 'opinion'
      ? logs.filter((g) => g.itemId === event.itemId || item?.mergedIds?.includes(g.itemId ?? ''))
      : [];
  const mutation = useMutation({
    mutationFn: () => api.historyNote(event.id, draft.form),
    onSuccess: ({ event: next }) => {
      draft.clear({ reason: next.reason, logId: next.logId, expectedRevision: next.revision });
      void client.invalidateQueries({ queryKey: ['taste-history'] });
      onClose();
    },
  });
  const reload = useMutation({
    mutationFn: async () => (await api.tasteEvent(event.id)).event,
    onSuccess: (next) => setSaved(next),
  });
  useEffect(() => {
    const dialog = node.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function close() {
    if (mutation.isPending || reload.isPending) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  }
  return (
    <>
      <dialog
        className="editor-dialog history-note-dialog"
        ref={node}
        aria-labelledby="history-note-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <h2 id="history-note-title">Why it changed.</h2>
        <p>
          Optional private context for this saved change. Editing it does not change your current call or
          ranking.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <fieldset disabled={mutation.isPending || reload.isPending}>
            <label>
              Reason
              <textarea
                maxLength={2000}
                value={draft.form.reason}
                onChange={(e) => draft.setForm({ ...draft.form, reason: e.target.value })}
              />
            </label>
            {event.kind === 'opinion' && (
              <label>
                Visit that changed your mind
                <select
                  value={draft.form.logId ?? ''}
                  onChange={(e) => draft.setForm({ ...draft.form, logId: e.target.value || null })}
                >
                  <option value="">No linked visit</option>
                  {visits.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.happenedOn}
                      {g.note ? ` · ${g.note.slice(0, 80)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {draft.status && <p role="status">{draft.status}</p>}
            {draft.form.expectedRevision !== saved.revision && (
              <p role="alert">The saved reason changed. Reload saved details before choosing what to keep.</p>
            )}
            {(mutation.isError || reload.isError) && (
              <p role="alert">{mutation.error?.message || reload.error?.message}</p>
            )}
            <div className="data-actions">
              <button className="button button-outline" type="button" onClick={close}>
                Close reason
              </button>
              <button
                className="button button-accent"
                disabled={!dirty || draft.form.expectedRevision !== saved.revision}
              >
                {mutation.isPending ? 'Saving…' : 'Save reason'}
              </button>
              <button type="button" className="button button-outline" onClick={() => reload.mutate()}>
                Reload saved details
              </button>
            </div>
            {saved.revision !== draft.form.expectedRevision && (
              <div className="taste-history-saved">
                <p>Saved reason: {saved.reason || 'No reason'}</p>
                <p>
                  Saved visit:{' '}
                  {logs.find((g) => g.id === saved.logId)?.happenedOn ?? 'No available linked visit'}
                </p>
                <p>
                  Your draft above is preserved. Use the saved revision only after reviewing the difference.
                </p>
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => draft.setForm({ ...draft.form, expectedRevision: saved.revision })}
                >
                  Keep draft with this revision
                </button>
              </div>
            )}
          </fieldset>
        </form>
      </dialog>
      {confirmClose && (
        <ConfirmDialog
          title="Close unfinished reason?"
          description="You can keep this draft on this account/device for seven days when device storage is available. If storage is blocked, copy it before closing."
          confirmLabel="Keep draft and close"
          onConfirm={onClose}
          onClose={() => setConfirmClose(false)}
        >
          <button
            className="button button-outline"
            onClick={() => {
              draft.clear(initial);
              onClose();
            }}
          >
            Discard draft and close
          </button>
        </ConfirmDialog>
      )}
    </>
  );
}
