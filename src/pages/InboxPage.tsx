import { requestAddEntry } from '../shared/quick-entry';
import { recordHref } from '../shared/record-links';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { api } from '../api';
import { BlankSlips } from '../components/BlankSlips';
import { InboxEntryEditor } from '../components/InboxEntryEditor';
import { RecordDetails } from '../components/RecordDetails';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import { useConnection } from '../hooks/useConnection';
import { inboxEntry, type InboxEntry } from '../shared/inbox';
import type { Item, ListSummary } from '../shared/models';
import { duplicateIdentity } from '../shared/record-identity';
import { InboxFileActions } from '../components/InboxFileActions';
import { contextSearchText } from '../shared/item-context';
import { formatDate, formatRelativeTimestamp } from '../format';
import '../inbox.css';

const filingDraft = z.object({
  pending: z
    .object({ entry: inboxEntry, targetId: z.string().uuid(), targetName: z.string().max(80) })
    .nullable(),
});
type FilingDraft = z.infer<typeof filingDraft>;

export function InboxPage() {
  usePageTitle('Unfiled');
  return (
    <main className="light-page page-width inbox-page">
      <InboxPanel />
    </main>
  );
}

export function InboxPanel() {
  const client = useQueryClient(),
    online = useConnection();
  const query = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const collections = lists.data?.lists.filter((list) => list.kind === 'collection' && !list.archived) ?? [];
  const focusAfterFiling = useRef<HTMLElement | null>(null);
  const preflightLock = useRef(false);
  const [creatingBusyId, setCreatingBusyId] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const [duplicateFiling, setDuplicateFiling] = useState<{
    entry: InboxEntry;
    target: ListSummary;
    item: Item;
  } | null>(null);
  const [params, setParams] = useSearchParams();
  const focus = z.string().uuid().safeParse(params.get('focus'));
  const [selected, setSelected] = useState<string | null>(focus.success ? focus.data : null);
  const focusId = focus.success ? focus.data : null;
  const [reading, setReading] = useState(params.get('view') === '1');
  const routeView = params.get('view');
  useEffect(() => {
    setSelected(focusId);
    setReading(routeView === '1');
  }, [focusId, routeView]);
  const [term, setTerm] = useState(''),
    [limit, setLimit] = useState(30);
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState<{
    id: string;
    listId: string;
    title: string;
    logId?: string | null;
  } | null>(null);
  const draft = useDraft<FilingDraft>(
    'inbox-filing',
    { pending: null },
    (value): value is FilingDraft => filingDraft.safeParse(value).success,
  );
  const pending = draft.form.pending;
  const file = useMutation({
    mutationKey: ['inbox'],
    mutationFn: (value: NonNullable<FilingDraft['pending']>) =>
      api.fileInbox(value.entry.id, value.targetId, value.entry.revision, draft.operationId.current),
    onSuccess: ({ item, logId }) => {
      draft.clear({ pending: null });
      draft.setForm({ pending: null });
      draft.operationId.current = crypto.randomUUID();
      setSaved({ id: item.id, listId: item.listId, title: item.title, logId });
      void client.invalidateQueries();
      requestAnimationFrame(() => {
        const target = focusAfterFiling.current;
        const heading = document.querySelector<HTMLElement>('main h1');
        if (target?.isConnected) target.focus({ preventScroll: true });
        else if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    },
    onError: () => {
      // A lost reply may follow a completed filing; refresh without losing its retry receipt.
      void client.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
  function beginFiling(current: InboxEntry, target: { id: string; name: string }) {
    if (pending || file.isPending || !online) return;
    const row = [...document.querySelectorAll<HTMLElement>('[data-inbox-id]')].find(
      (node) => node.dataset.inboxId === current.id,
    );
    focusAfterFiling.current =
      row?.nextElementSibling?.querySelector<HTMLElement>('button') ??
      row?.previousElementSibling?.querySelector<HTMLElement>('button') ??
      null;
    const next = { pending: { entry: current, targetId: target.id, targetName: target.name } };
    draft.checkpoint(next);
    setDuplicateFiling(null);
    closeEditor();
    file.mutate(next.pending);
  }
  const checkFiling = useMutation({
    mutationFn: async (value: { entry: InboxEntry; target: ListSummary }) => {
      const { items } = await client.fetchQuery({
        queryKey: ['items', value.target.id],
        queryFn: () => api.items(value.target.id),
        staleTime: 0,
      });
      return {
        ...value,
        item: items.find((item) => duplicateIdentity(item) === duplicateIdentity(value.entry)),
      };
    },
    onSuccess: ({ entry, target, item }) => {
      if (live.current) {
        if (item) setDuplicateFiling({ entry, target, item });
        else beginFiling(entry, target);
      }
    },
    onSettled: () => {
      preflightLock.current = false;
    },
  });
  function requestFiling(entry: InboxEntry, target: ListSummary) {
    if (pending || file.isPending || preflightLock.current || !online) return;
    preflightLock.current = true;
    setDuplicateFiling(null);
    checkFiling.mutate({ entry, target });
  }
  const entries = query.data?.entries ?? [];
  const search = term.trim().toLocaleLowerCase();
  const filtered = search
    ? entries.filter((entry) =>
        `${entry.title} ${entry.type} ${entry.note} ${contextSearchText(entry.context)}`
          .toLocaleLowerCase()
          .includes(search),
      )
    : entries;
  const entry = entries.find((entry) => entry.id === selected);
  function closeEditor() {
    setSelected(null);
    if (params.has('focus')) {
      const next = new URLSearchParams(params);
      next.delete('focus');
      next.delete('view');
      setParams(next, { replace: true });
    }
  }
  function openFind(id: string, view: boolean) {
    setSelected(id);
    setReading(view);
    const next = new URLSearchParams(params);
    next.set('focus', id);
    if (view) next.set('view', '1');
    else next.delete('view');
    setParams(next);
  }
  return (
    <>
      <header className="page-head inbox-head">
        <div>
          <h1>Unfiled.</h1>
          <p>Saved. Filing department currently on break.</p>
        </div>
        <button className="button button-accent" onClick={() => requestAddEntry({ listId: 'inbox' })}>
          Add item
        </button>
      </header>
      <p className="inbox-count">
        {query.data && `${entries.length} saved ${entries.length === 1 ? 'find' : 'finds'} · `}
        Private
      </p>
      {pending && (
        <section className="inbox-pending" aria-label="Pending filing">
          <p className="overline">FILING RECEIPT</p>
          <h3>{pending.entry.title}</h3>
          <p>Destination: {pending.targetName} · Unranked</p>
          <p>
            This request stays fixed until confirmed. If its reply was lost, retrying finds the same saved
            record.
          </p>
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!online || file.isPending}
              onClick={() => file.mutate(pending)}
            >
              Retry same filing
            </button>
            <button
              className="button button-outline"
              disabled={file.isPending}
              onClick={() => setDiscard(true)}
            >
              Discard filing receipt
            </button>
          </div>
          {file.isError && (
            <p className="form-error" role="alert">
              {file.error.message}
            </p>
          )}
        </section>
      )}
      {saved && (
        <p role="status">
          “{saved.title}” filed.{' '}
          <Link to={recordHref(saved.listId, saved.logId ? 'log' : 'item', saved.logId ?? saved.id)}>
            Open filed record →
          </Link>
        </p>
      )}
      {query.isPending && <p role="status">Opening the Unfiled…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}{' '}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry Unfiled
          </button>
        </p>
      )}
      {query.data && (
        <>
          {!!entries.length && (
            <label className="inbox-search">
              Find in Unfiled
              <input
                type="search"
                value={term}
                onChange={(event) => {
                  setTerm(event.target.value);
                  setLimit(30);
                }}
                placeholder="Name, note or context"
              />
            </label>
          )}
          {!entries.length && (
            <section className="inbox-empty">
              <BlankSlips className="inbox-blank-slips" />
              <div>
                <h2>A place for the maybes.</h2>
                <p>Keep a name or a link here. No collection or opinion required.</p>
                <button
                  className="button button-outline"
                  onClick={() => requestAddEntry({ listId: 'inbox' })}
                >
                  Save your first find →
                </button>
              </div>
            </section>
          )}
          {!!entries.length && !filtered.length && <p>No Unfiled finds match “{term}”.</p>}
          {lists.isError && !!entries.length && (
            <p className="form-error" role="alert">
              Collections couldn’t load.{' '}
              <button type="button" onClick={() => void lists.refetch()}>
                Try again
              </button>
            </p>
          )}
          {!!filtered.length && (
            <ul className="inbox-list">
              {filtered.slice(0, limit).map((find) => (
                <li key={find.id} data-inbox-id={find.id}>
                  <button
                    disabled={!!pending || checkFiling.isPending || !!creatingBusyId}
                    onClick={() => openFind(find.id, true)}
                  >
                    <span className="inbox-row-mark" aria-hidden="true">
                      ↳
                    </span>
                    <span>
                      <span className="sr-only">View </span>
                      <strong>{find.title}</strong>
                      <small>
                        {find.type ? `${find.type} · ` : ''}
                        {formatRelativeTimestamp(find.createdAt)}
                        {find.memory ? ` · Experienced ${formatDate(find.memory.happenedOn)}` : ''}
                        {find.photo?.available ? ' · Photo' : ''}
                        {find.wantToTry ? ' · Want to try' : ''}
                      </small>
                      {find.note && <span className="inbox-row-note">{find.note}</span>}
                    </span>
                    <span className="inbox-row-open" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                  <button
                    className="inbox-row-edit"
                    aria-label={`Edit ${find.title}`}
                    disabled={!!pending || checkFiling.isPending || !!creatingBusyId}
                    onClick={() => openFind(find.id, false)}
                  >
                    Edit
                  </button>
                  {lists.data && (
                    <InboxFileActions
                      entry={find}
                      collections={collections}
                      disabled={
                        !!pending ||
                        checkFiling.isPending ||
                        (!!creatingBusyId && creatingBusyId !== find.id) ||
                        !online
                      }
                      checking={checkFiling.isPending && checkFiling.variables.entry.id === find.id}
                      error={
                        checkFiling.isError && checkFiling.variables.entry.id === find.id
                          ? checkFiling.error.message
                          : ''
                      }
                      duplicate={duplicateFiling?.entry.id === find.id ? duplicateFiling : null}
                      onBusyChange={(busy) =>
                        setCreatingBusyId((current) =>
                          busy ? find.id : current === find.id ? null : current,
                        )
                      }
                      onFile={(target) => requestFiling(find, target)}
                      onCancelDuplicate={() => setDuplicateFiling(null)}
                      onFileSeparate={() => {
                        if (duplicateFiling) beginFiling(duplicateFiling.entry, duplicateFiling.target);
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          {filtered.length > limit && (
            <button className="button button-outline" onClick={() => setLimit(limit + 30)}>
              Show more finds
            </button>
          )}
        </>
      )}
      {selected && entry && reading && !pending ? (
        <RecordDetails
          key={selected}
          record={{ kind: 'inbox', entry }}
          listName="Unfiled"
          onClose={closeEditor}
          onEdit={() => openFind(selected, false)}
        />
      ) : (
        selected &&
        query.data &&
        (!reading || (!query.isFetching && !query.isError)) &&
        !pending && (
          <InboxEntryEditor
            key={selected}
            id={selected}
            entry={entry}
            onClose={closeEditor}
            onFile={beginFiling}
          />
        )
      )}
      {selected && reading && !entry && query.isFetching && <p role="status">Opening saved find…</p>}
      {discard && (
        <ConfirmDialog
          title="Discard this filing receipt?"
          description="The request may already have filed this find. Check your collections and Trash before starting another filing. This only removes this device’s retry receipt."
          confirmLabel="Discard receipt"
          onClose={() => setDiscard(false)}
          onConfirm={() => {
            draft.clear({ pending: null });
            draft.setForm({ pending: null });
            draft.operationId.current = crypto.randomUUID();
            file.reset();
            setDiscard(false);
            void query.refetch();
          }}
        />
      )}
    </>
  );
}
