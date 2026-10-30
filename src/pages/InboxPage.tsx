import { requestAddEntry } from '../shared/quick-entry';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { api } from '../api';
import { BlankSlips } from '../components/BlankSlips';
import { InboxEntryEditor } from '../components/InboxEntryEditor';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import { useConnection } from '../hooks/useConnection';
import { inboxEntry } from '../shared/inbox';
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

export function InboxPanel({ drawer = false }: { drawer?: boolean }) {
  const client = useQueryClient(),
    online = useConnection();
  const query = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const [params, setParams] = useSearchParams();
  const focus = z.string().uuid().safeParse(params.get('focus'));
  const [selected, setSelected] = useState<string | null>(!drawer && focus.success ? focus.data : null);
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
    },
    onError: () => {
      // A lost reply may follow a completed filing; refresh without losing its retry receipt.
      void client.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
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
  const Heading = drawer ? 'h2' : 'h1';
  function closeEditor() {
    setSelected(null);
    if (!drawer && params.has('focus')) {
      const next = new URLSearchParams(params);
      next.delete('focus');
      setParams(next, { replace: true });
    }
  }
  return (
    <>
      <header className="page-head inbox-head">
        <div>
          <p className="overline">SAVED / UNFILED</p>
          <Heading id={drawer ? 'inbox-drawer-title' : undefined}>Unfiled.</Heading>
          <p>Saved here. Organize whenever you like.</p>
        </div>
        <button className="button button-accent" onClick={() => requestAddEntry({ listId: 'inbox' })}>
          Add a name
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
          <Link
            to={`/lists/${saved.listId}?focus=${saved.logId ? `log:${saved.logId}` : `item:${saved.id}`}`}
          >
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
          {!!filtered.length && (
            <ul className="inbox-list">
              {filtered.slice(0, limit).map((find) => (
                <li key={find.id}>
                  <button
                    aria-label={`Review ${find.title}`}
                    disabled={!!pending}
                    onClick={() => setSelected(find.id)}
                  >
                    <span className="inbox-row-mark" aria-hidden="true">
                      ↳
                    </span>
                    <span>
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
                    <span className="inbox-row-open">Review →</span>
                  </button>
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
      {selected && query.data && !pending && (
        <InboxEntryEditor
          key={selected}
          id={selected}
          entry={entry}
          onClose={closeEditor}
          onFile={(current, target) => {
            const next = { pending: { entry: current, targetId: target.id, targetName: target.name } };
            draft.checkpoint(next);
            closeEditor();
            file.mutate(next.pending);
          }}
        />
      )}
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
