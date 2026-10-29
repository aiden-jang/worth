import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDraft } from '../hooks/useDraft';
import { useConnection } from '../hooks/useConnection';
import {
  connectionNote,
  connectionInput,
  connectionKind,
  connectionLabels,
  emptyConnectionDraft,
  isConnectionDraft,
  type ConnectionView,
  type ConnectedRecord,
} from '../shared/connections';
import { usePageTitle } from '../hooks/usePageTitle';
import '../connections.css';

export function ConnectionsPage() {
  usePageTitle('Connections');
  const client = useQueryClient(),
    online = useConnection();
  const query = useQuery({ queryKey: ['connections'], queryFn: api.connections });
  const [focus, setFocus] = useState(''),
    [kind, setKind] = useState('all'),
    [limit, setLimit] = useState(25);
  const [editing, setEditing] = useState<ConnectionView | null>(null),
    [removing, setRemoving] = useState<ConnectionView | null>(null);
  const links = query.data?.connections ?? [];
  const nodes = new Map(
    links.flatMap(
      (link) =>
        [
          [link.from.id, link.from],
          [link.to.id, link.to],
        ] as [string, ConnectedRecord][],
    ),
  );
  const center = nodes.get(focus);
  const shown = links.filter(
    (link) =>
      (kind === 'all' || link.kind === kind) &&
      (!center || link.fromId === center.id || link.toId === center.id),
  );
  const remove = useMutation({
    mutationFn: () => api.removeConnection(removing!.id, removing!.revision),
    onSuccess: () => {
      setRemoving(null);
      void client.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ['connections'] });
    },
  });
  return (
    <main className="light-page page-width connections-page">
      <header className="page-head">
        <div>
          <p className="overline">YOUR ARCHIVE</p>
          <h1>Connections</h1>
          <p>Keep the things in common.</p>
        </div>
        <Link to="/patterns">Back to Look back →</Link>
      </header>
      <p className="connections-intro">
        Link related finds, editions or versions, the same thing across places, and replacements. Records keep
        their own calls, ranks, notes and photos. Links and reasons stay private.
      </p>
      <ConnectionCreate />
      <section aria-label="Saved connections" className="connections-saved">
        <h2>Your constellation</h2>
        {query.isPending && <p role="status">Opening connections…</p>}
        {query.isError && (
          <p role="alert">
            {query.error.message}{' '}
            <button className="button button-outline" onClick={() => void query.refetch()}>
              Try again
            </button>
          </p>
        )}
        {query.isSuccess && !links.length && (
          <p>No saved connections yet. Choose two records above to keep the first link.</p>
        )}
        {!!links.length && (
          <>
            <div className="connection-fields">
              <label>
                Center on a record
                <select
                  value={center?.id ?? ''}
                  onChange={(e) => {
                    setFocus(e.target.value);
                    setLimit(25);
                  }}
                >
                  <option value="">All connected records</option>
                  {[...nodes.values()]
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.title}
                        {node.detail ? ` · ${node.detail}` : ''} · {node.listName}
                        {node.merged ? ' · merged original' : ''}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Connection type
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setLimit(25);
                  }}
                >
                  <option value="all">All types</option>
                  {connectionKind.options.map((value) => (
                    <option key={value} value={value}>
                      {connectionLabels[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {center && <Constellation center={center} links={shown} />}
            {!center && (
              <p>Choose a record to see its constellation. The list below contains every saved connection.</p>
            )}
            <p>
              {shown.length} matching {shown.length === 1 ? 'connection' : 'connections'} · up to 1,000 saved,
              including links temporarily hidden by Trash.
            </p>
            <ul className="connection-list">
              {shown.slice(0, limit).map((link) => (
                <li key={link.id}>
                  <p className="overline">{connectionLabels[link.kind]}</p>
                  <h3>
                    <RecordLink record={link.from} />
                    <span aria-hidden="true"> {link.kind === 'replaces' ? '→' : '↔'} </span>
                    <span className="sr-only">
                      {' '}
                      {link.kind === 'replaces' ? 'replaces' : 'connected to'}{' '}
                    </span>
                    <RecordLink record={link.to} />
                  </h3>
                  <p>
                    {link.from.listName} / {link.to.listName}
                    {link.from.archived || link.to.archived ? ' · includes an archived collection' : ''}
                  </p>
                  {(link.from.merged || link.to.merged) && (
                    <p>
                      Merged originals keep their stored links. Opening a name shows its current main record.
                    </p>
                  )}
                  {link.reason && <p className="connection-reason">{link.reason}</p>}
                  <div className="data-actions">
                    <button
                      className="button button-outline"
                      onClick={() => {
                        setFocus(link.fromId);
                        setLimit(25);
                      }}
                    >
                      Center on {link.from.title}
                    </button>
                    <button
                      className="button button-outline"
                      onClick={() => {
                        setFocus(link.toId);
                        setLimit(25);
                      }}
                    >
                      Center on {link.to.title}
                    </button>
                    <button className="button button-outline" onClick={() => setEditing(link)}>
                      Edit reason
                    </button>
                    <button
                      className="button button-outline"
                      disabled={!online}
                      onClick={() => {
                        remove.reset();
                        setRemoving(link);
                      }}
                    >
                      Remove connection
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {limit < shown.length && (
              <button className="button button-outline" onClick={() => setLimit(limit + 25)}>
                Show more connections
              </button>
            )}
          </>
        )}
      </section>
      {editing && <ConnectionReason key={editing.id} connection={editing} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title="Remove this connection?"
          description="Both records and their calls, ranks, notes and photos stay. You can add a new connection later."
          confirmLabel="Remove connection"
          pending={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate()}
          onClose={() => {
            if (!remove.isPending) setRemoving(null);
          }}
        >
          <p>
            {removing.from.title} {removing.kind === 'replaces' ? 'replaces' : '↔'} {removing.to.title}
          </p>
        </ConfirmDialog>
      )}
    </main>
  );
}
function RecordLink({ record }: { record: ConnectedRecord }) {
  return (
    <Link to={`/lists/${record.listId}?focus=item:${record.currentId}`}>
      {record.title}
      {record.detail && <small className="connection-record-detail">{record.detail}</small>}
    </Link>
  );
}
function Constellation({ center, links }: { center: ConnectedRecord; links: ConnectionView[] }) {
  const neighbors = [
    ...new Map(
      links.map((link) => {
        const node = link.fromId === center.id ? link.to : link.from;
        return [node.id, node];
      }),
    ).values(),
  ];
  const visible = neighbors.slice(0, 12);
  return (
    <figure className="connection-constellation">
      <div
        className={`connection-map ${visible.length <= 2 ? 'connection-map-small' : ''}`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {visible.map((node, index) => {
            const point = connectionPoint(index, visible.length);
            return (
              <line
                key={node.id}
                x1="50"
                y1={visible.length <= 2 ? 68 : 50}
                x2={point.x}
                y2={point.y}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <span
          className="connection-map-center"
          style={{ left: '50%', top: visible.length <= 2 ? '68%' : '50%' }}
        >
          Here
        </span>
        {visible.map((node, index) => {
          const point = connectionPoint(index, visible.length);
          return (
            <span
              key={node.id}
              className="connection-map-node"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {index + 1}
            </span>
          );
        })}
      </div>
      <figcaption>
        <strong>{center.title}</strong> · {visible.length} of {neighbors.length} neighbors shown. Lines mean a
        saved connection; they do not imply a call or rank.
      </figcaption>
      <ol>
        {visible.map((node) => (
          <li key={node.id}>
            <RecordLink record={node} />
          </li>
        ))}
      </ol>
      <p>The full readable list below includes the type, direction and reason for every matching link.</p>
    </figure>
  );
}
function connectionPoint(index: number, total: number) {
  if (total === 1) return { x: 50, y: 20 };
  if (total === 2) return { x: index ? 75 : 25, y: 22 };
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return { x: 50 + 36 * Math.cos(angle), y: 50 + 36 * Math.sin(angle) };
}
function ConnectionCreate() {
  const client = useQueryClient(),
    online = useConnection();
  const draft = useDraft('new-connection', emptyConnectionDraft, isConnectionDraft),
    form = draft.form;
  const current = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const archived = useQuery({
    queryKey: ['lists', 'archived'],
    queryFn: api.archivedLists,
    enabled: form.includeArchived,
  });
  const collections = [
    ...(current.data?.lists ?? []),
    ...(form.includeArchived ? (archived.data?.lists ?? []) : []),
  ].filter((list) => list.kind === 'collection');
  const source = useQuery({
    queryKey: ['items', form.fromList],
    queryFn: () => api.items(form.fromList),
    enabled: !!form.fromList,
  });
  const target = useQuery({
    queryKey: ['items', form.toList],
    queryFn: () => api.items(form.toList),
    enabled: !!form.toList,
  });
  const [status, setStatus] = useState(''),
    [fresh, setFresh] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyConnectionDraft);
  const blocker = useBlocker(dirty);
  function saved() {
    draft.clear(emptyConnectionDraft);
    draft.setForm(emptyConnectionDraft);
    setStatus('Connection saved.');
    void client.invalidateQueries({ queryKey: ['connections'] });
  }
  const create = useMutation({
    mutationFn: (attempt: NonNullable<typeof form.attempt>) =>
      api.createConnection(attempt.payload, attempt.key),
    onSuccess: saved,
  });
  const check = useMutation({ mutationFn: () => api.connection(form.attempt!.key), onSuccess: saved });
  const recordsAvailable =
    !!source.data?.items.some((i) => i.id === form.fromId) &&
    !!target.data?.items.some((i) => i.id === form.toId) &&
    collections.some((l) => l.id === form.fromList) &&
    collections.some((l) => l.id === form.toList);
  const valid = connectionInput.safeParse({
    fromId: form.fromId,
    toId: form.toId,
    kind: form.kind,
    reason: form.reason,
  });
  const change = (next: Partial<typeof form>) => {
    draft.setForm({ ...form, ...next });
    setStatus('');
  };
  return (
    <section className="connection-create" aria-labelledby="connection-create-title">
      <h2 id="connection-create-title">Connect two records</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid.success || !recordsAvailable || form.attempt || create.isPending) return;
          const attempt = {
            key: crypto.randomUUID(),
            payload: valid.data,
            fromName: source.data?.items.find((i) => i.id === form.fromId)?.title ?? 'Unavailable record',
            toName: target.data?.items.find((i) => i.id === form.toId)?.title ?? 'Unavailable record',
          };
          draft.checkpoint({ ...form, attempt });
          create.mutate(attempt);
        }}
      >
        <fieldset disabled={!!form.attempt || create.isPending}>
          <label className="connection-check">
            <input
              type="checkbox"
              checked={form.includeArchived}
              onChange={(e) => change({ includeArchived: e.target.checked })}
            />
            Include archived collections
          </label>
          <div className="connection-fields">
            {(['from', 'to'] as const).map((side) => {
              const listKey = side === 'from' ? 'fromList' : 'toList',
                itemKey = side === 'from' ? 'fromId' : 'toId',
                records = side === 'from' ? source : target;
              return (
                <div key={side} className="connection-side">
                  <h3>{side === 'from' ? 'First record' : 'Second record'}</h3>
                  <label>
                    {side === 'from' ? 'First collection' : 'Second collection'}
                    <select
                      value={form[listKey]}
                      onChange={(e) => change({ [listKey]: e.target.value, [itemKey]: '' })}
                    >
                      <option value="">Choose a collection</option>
                      {collections.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                          {list.archived ? ' · archived' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {side === 'from' ? 'First record' : 'Second record'}
                    <select value={form[itemKey]} onChange={(e) => change({ [itemKey]: e.target.value })}>
                      <option value="">Choose a record</option>
                      {records.data?.items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                          {[item.context?.location, item.context?.version].filter(Boolean).length
                            ? ` · ${[item.context?.location, item.context?.version].filter(Boolean).join(' · ')}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {records.isError && (
                    <p role="alert">
                      {records.error.message}{' '}
                      <button type="button" onClick={() => void records.refetch()}>
                        Try again
                      </button>
                    </p>
                  )}
                  {!!form[listKey] && records.isPending && <p role="status">Opening records…</p>}
                </div>
              );
            })}
          </div>
          <label>
            Relationship
            <select value={form.kind} onChange={(e) => change({ kind: e.target.value as typeof form.kind })}>
              {connectionKind.options.map((kind) => (
                <option key={kind} value={kind}>
                  {connectionLabels[kind]}
                </option>
              ))}
            </select>
          </label>
          {form.kind === 'replaces' && (
            <p>
              The first record replaces the second. Keep a reason for switching. Replacement loops are
              rejected.
            </p>
          )}
          <label>
            Reason{form.kind === 'replaces' ? ' (required)' : ' (optional)'}
            <textarea
              aria-label="Connection reason"
              maxLength={2000}
              required={form.kind === 'replaces'}
              value={form.reason}
              onChange={(e) => change({ reason: e.target.value })}
            />
          </label>
          <button className="button button-accent" disabled={!valid.success || !recordsAvailable || !online}>
            Save connection
          </button>
        </fieldset>
        {(current.isError || (form.includeArchived && archived.isError)) && (
          <p role="alert">
            {current.error?.message || archived.error?.message}{' '}
            <button
              type="button"
              onClick={() => {
                void current.refetch();
                if (form.includeArchived) void archived.refetch();
              }}
            >
              Try collections again
            </button>
          </p>
        )}
        {form.attempt && (
          <div className="connection-attempt">
            <h3>{create.isPending ? 'Saving connection…' : 'Check this save'}</h3>
            <p>
              {form.attempt.fromName} {form.attempt.payload.kind === 'replaces' ? 'replaces' : '↔'}{' '}
              {form.attempt.toName}
            </p>
            <p>{connectionLabels[form.attempt.payload.kind]}</p>
            <p className="connection-reason">{form.attempt.payload.reason}</p>
            <p>The exact request is kept for retry. A lost reply may mean it was saved already.</p>
            <div className="data-actions">
              <button
                type="button"
                className="button button-accent"
                disabled={create.isPending || check.isPending || !online}
                onClick={() => create.mutate(form.attempt!)}
              >
                Retry exact save
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={create.isPending || check.isPending || !online}
                onClick={() => check.mutate()}
              >
                Check saved connection
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={create.isPending || check.isPending}
                onClick={() => setFresh(true)}
              >
                Start a new review
              </button>
            </div>
          </div>
        )}
        {(create.isError || check.isError) && (
          <p role="alert">{create.error?.message || check.error?.message}</p>
        )}
        {draft.status && <p role="status">{draft.status}</p>}
        {status && <p role="status">{status}</p>}
        {!online && <p>Offline. Keep your draft and reconnect to save.</p>}
      </form>
      {fresh && (
        <ConfirmDialog
          title="Start a new connection review?"
          description="The earlier request may already be saved. Check saved connections before adding it again. This keeps your fields and clears only the retry request."
          confirmLabel="Start new review"
          onConfirm={() => {
            change({ attempt: null });
            create.reset();
            check.reset();
            setFresh(false);
            void client.invalidateQueries({ queryKey: ['connections'] });
          }}
          onClose={() => setFresh(false)}
        />
      )}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Leave this connection draft?"
          description="Drafts can recover on this account/device for seven days when storage is available. If storage is blocked, copy your text before leaving."
          confirmLabel="Leave page"
          pending={create.isPending || check.isPending}
          onConfirm={() => blocker.proceed()}
          onClose={() => blocker.reset()}
        />
      )}
    </section>
  );
}
function ConnectionReason({ connection, onClose }: { connection: ConnectionView; onClose: () => void }) {
  const node = useRef<HTMLDialogElement>(null),
    client = useQueryClient();
  const [saved, setSaved] = useState(connection),
    [closing, setClosing] = useState(false);
  const initial = { reason: connection.reason, expectedRevision: connection.revision };
  const draft = useDraft(
    `connection-reason:${connection.id}`,
    initial,
    (value): value is typeof initial => connectionNote.safeParse(value).success,
  );
  const dirty = draft.form.reason !== saved.reason;
  const mutation = useMutation({
    mutationFn: () => api.updateConnection(connection.id, draft.form.reason, draft.form.expectedRevision),
    onSuccess: () => {
      draft.clear();
      void client.invalidateQueries({ queryKey: ['connections'] });
      onClose();
    },
  });
  const reload = useMutation({
    mutationFn: () => api.connection(connection.id),
    onSuccess: (next) => setSaved(next.connection),
  });
  useEffect(() => {
    const dialog = node.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function close() {
    if (mutation.isPending || reload.isPending) return;
    if (dirty) setClosing(true);
    else onClose();
  }
  return (
    <>
      <dialog
        className="editor-dialog connection-reason-dialog"
        ref={node}
        aria-labelledby="connection-reason-title"
        onCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
        }}
      >
        <h2 id="connection-reason-title">Why they connect</h2>
        <p>
          {connection.from.title} / {connection.to.title}
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
                aria-label="Saved connection reason"
                maxLength={2000}
                required={connection.kind === 'replaces'}
                value={draft.form.reason}
                onChange={(e) => draft.setForm({ ...draft.form, reason: e.target.value })}
              />
            </label>
            {draft.status && <p role="status">{draft.status}</p>}
            {(mutation.isError || reload.isError) && (
              <p role="alert">{mutation.error?.message || reload.error?.message}</p>
            )}
            <div className="data-actions">
              <button type="button" className="button button-outline" onClick={close}>
                Close reason
              </button>
              <button
                className="button button-accent"
                disabled={!dirty || draft.form.expectedRevision !== saved.revision}
              >
                Save reason
              </button>
              <button type="button" className="button button-outline" onClick={() => reload.mutate()}>
                Reload saved reason
              </button>
            </div>
            {saved.revision !== draft.form.expectedRevision && (
              <div className="connection-attempt">
                <p>Saved reason: {saved.reason || 'No reason'}</p>
                <p>Your draft above is preserved. Review the difference before using the latest revision.</p>
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
      {closing && (
        <ConfirmDialog
          title="Close unfinished reason?"
          description="Drafts recover for seven days when device storage is available. Copy your text first if storage is blocked."
          confirmLabel="Keep draft and close"
          onConfirm={onClose}
          onClose={() => setClosing(false)}
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
