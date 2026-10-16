import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Item } from '../shared/models';
import { rankedItems } from '../shared/ranking';
import { shuffled } from '../shared/workbench';
import '../web-capture.css';

type QuickPreference = { listId: string; archived: boolean; from: string };
function readPreference(key: string): QuickPreference | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value &&
      typeof value.listId === 'string' &&
      value.listId.length <= 100 &&
      typeof value.archived === 'boolean' &&
      ['all', 'want', 'queue', 'favorites'].includes(value.from)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function QuickPage() {
  usePageTitle('Quick picks');
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'find' ? 'find' : 'shortlist';
  const client = useQueryClient();
  const owner = client.getQueryData<{ user: { id: string } }>(['me'])?.user.id;
  const preferenceKey = `worth:quick-picks:${owner}`;
  const [preference, setPreference] = useState(() => ({
    key: preferenceKey,
    value: readPreference(preferenceKey),
  }));
  const remembered = preference.key === preferenceKey ? preference.value : readPreference(preferenceKey);
  const explicit = params.has('list');
  const selected = params.get('list') ?? remembered?.listId ?? '';
  const archived = params.has('archived')
    ? params.get('archived') === '1'
    : !explicit && !!remembered?.archived;
  const value = params.get('from') ?? (!explicit ? remembered?.from : 'all');
  const filter = value === 'want' || value === 'queue' || value === 'favorites' ? value : 'all';
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const archivedLists = useQuery({
    queryKey: ['lists', 'archived'],
    queryFn: api.archivedLists,
    enabled: archived,
  });
  const choices = [
    ...(lists.data?.lists ?? []),
    ...(archived ? (archivedLists.data?.lists ?? []) : []),
  ].filter((list) => list.kind === 'collection');
  const chosen = choices.find((list) => list.id === selected);
  const list = useQuery({
    queryKey: ['list', selected],
    queryFn: () => api.list(selected),
    enabled: !!chosen,
  });
  const items = useQuery({
    queryKey: ['items', selected],
    queryFn: () => api.items(selected),
    enabled: !!chosen,
  });
  const [copyStatus, setCopyStatus] = useState('');
  function update(patch: Record<string, string>) {
    const next = new URLSearchParams({
      mode,
      list: selected,
      from: filter,
      ...(archived ? { archived: '1' } : {}),
    });
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
    setCopyStatus('');
  }
  const ranked = list.data ? rankedItems(list.data.list, items.data?.items ?? []).slice(0, 5) : [];
  const candidates = (items.data?.items ?? []).filter(
    (item) =>
      filter === 'all' ||
      (filter === 'want'
        ? item.wantToTry
        : filter === 'queue'
          ? item.revisitQueued
          : item.decision === 'favorite'),
  );
  function remember() {
    if (!owner || !chosen) return;
    const value = { listId: chosen.id, archived: !!chosen.archived, from: filter };
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(value));
      setPreference({ key: preferenceKey, value });
      setCopyStatus('Collection and group remembered for Worth shortcuts on this device.');
    } catch {
      setCopyStatus('Couldn’t remember these choices. Bookmark this page instead.');
    }
  }
  function forget() {
    try {
      localStorage.removeItem(preferenceKey);
      setPreference({ key: preferenceKey, value: null });
      setCopyStatus('Remembered shortcut choices cleared.');
    } catch {
      setCopyStatus('Couldn’t clear remembered choices. Clear Worth’s site data in your browser.');
    }
  }
  async function copy() {
    const url = new URL('/quick', location.origin);
    url.searchParams.set('mode', mode);
    url.searchParams.set('list', selected);
    if (mode === 'find') url.searchParams.set('from', filter);
    if (chosen?.archived) url.searchParams.set('archived', '1');
    try {
      await navigator.clipboard.writeText(url.href);
      setCopyStatus('Private shortcut copied.');
    } catch {
      setCopyStatus(`Copy this private shortcut: ${url.href}`);
    }
  }
  return (
    <main className="light-page page-width quick-page">
      <header className="page-head">
        <div>
          <p className="overline">QUICK PICKS</p>
          <h1>Within reach.</h1>
          <p>A shortlist or a saved find from your own collections.</p>
        </div>
      </header>
      <section className="quick-panel" aria-label="Private quick picks">
        <label>
          Open
          <select value={mode} onChange={(event) => update({ mode: event.target.value })}>
            <option value="shortlist">Chosen shortlist</option>
            <option value="find">Random saved find</option>
          </select>
        </label>
        <label>
          Collection
          <select value={chosen?.id ?? ''} onChange={(event) => update({ list: event.target.value })}>
            <option value="">Choose a collection</option>
            {choices.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.archived ? ' / archived' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="quick-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) =>
              update({
                archived: event.target.checked ? '1' : '',
                ...(!event.target.checked && chosen?.archived ? { list: '' } : {}),
              })
            }
          />
          Include archived collections
        </label>
        {(lists.isError || (archived && archivedLists.isError)) && (
          <p role="alert">
            Couldn’t load collections.{' '}
            <button
              className="button button-outline"
              onClick={() => {
                void lists.refetch();
                if (archived) void archivedLists.refetch();
              }}
            >
              Try again
            </button>
          </p>
        )}
        {(lists.isPending || (archived && archivedLists.isPending)) && (
          <p role="status">Loading collections…</p>
        )}
        {selected && !chosen && lists.data && !lists.isFetching && (
          <p role="alert">
            This shortcut’s collection is unavailable for this account. Choose a collection above.
          </p>
        )}
        {mode === 'find' && (
          <label>
            Find from
            <select value={filter} onChange={(event) => update({ from: event.target.value })}>
              <option value="all">All saved items</option>
              <option value="want">Want to try</option>
              <option value="queue">Revisit queue</option>
              <option value="favorites">Favorites</option>
            </select>
          </label>
        )}
        {chosen && (
          <>
            <details className="quick-options">
              <summary>Bookmark and shortcut options</summary>
              <div className="data-actions">
                <Link className="button button-outline" to={`/lists/${chosen.id}?capture=1`}>
                  Capture in {chosen.name}
                </Link>
                <button className="button button-outline" onClick={() => void copy()}>
                  Copy private shortcut
                </button>
              </div>
              <p>
                Bookmark this page for this exact collection and group. Installed Worth may also offer
                Shortlist and Saved find in its shortcut menu. Remember these choices below to reopen this
                collection there; browser support varies. No public share link is created.
              </p>
              <div className="data-actions">
                <button className="button button-outline" onClick={remember}>
                  Remember for app shortcuts
                </button>
                {remembered && (
                  <button className="button button-outline" onClick={forget}>
                    Forget shortcut choices
                  </button>
                )}
              </div>
              {copyStatus && <p role="status">{copyStatus}</p>}
            </details>
            {(list.isPending || items.isPending) && <p role="status">Opening saved records…</p>}
            {(list.isError || items.isError) && (
              <p role="alert">
                Couldn’t open this collection.{' '}
                <button
                  className="button button-outline"
                  onClick={() => {
                    void list.refetch();
                    void items.refetch();
                  }}
                >
                  Retry records
                </button>
              </p>
            )}
            {list.data &&
              items.data &&
              !list.isError &&
              !items.isError &&
              (mode === 'shortlist' ? (
                <section className="quick-shortlist" aria-label="Saved shortlist">
                  <p className="overline">SAVED ORDER · UP TO FIVE</p>
                  <h2>{chosen.name}</h2>
                  {ranked.length ? (
                    <ol>
                      {ranked.map((item) => (
                        <li key={item.id}>
                          <Link to={`/lists/${chosen.id}?focus=item:${item.id}`}>
                            {item.title}
                            <span>{item.type || 'No type'}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>
                      No ranked records yet. <Link to={`/lists/${chosen.id}`}>Open the collection</Link> to
                      choose an order.
                    </p>
                  )}
                  <p>Rank is independent of your calls. Unranked records stay in the collection.</p>
                </section>
              ) : (
                <SavedFind key={`${chosen.id}:${filter}`} items={candidates} listId={chosen.id} />
              ))}
          </>
        )}
        {!chosen && !selected && <p>Choose a collection to start. Your records stay private.</p>}
      </section>
      <p>
        <Link to="/capture">Open web capture →</Link>
      </p>
    </main>
  );
}

function SavedFind({ items, listId }: { items: Item[]; listId: string }) {
  const [remaining, setRemaining] = useState<string[]>([]),
    [picked, setPicked] = useState<string | null>(null);
  const item = items.find((entry) => entry.id === picked);
  function draw() {
    const valid = remaining.filter((id) => items.some((entry) => entry.id === id));
    const deck = valid.length ? valid : shuffled(items.map((entry) => entry.id));
    setPicked(deck[0] ?? null);
    setRemaining(deck.slice(1));
  }
  return (
    <section aria-label="Saved find" className="quick-find">
      <p>
        {items.length} eligible {items.length === 1 ? 'record' : 'records'}. Each is drawn once before the
        deck starts again. Calls and ranks stay unchanged.
      </p>
      <button className="button button-accent" disabled={!items.length} onClick={draw}>
        {item ? 'Draw another' : 'Draw a saved find'}
      </button>
      {item && (
        <article className="quick-shortlist" aria-live="polite">
          <p className="overline">FROM YOUR COLLECTION</p>
          <h2>{item.title}</h2>
          <p>{item.type || 'No type'}</p>
          <Link className="button button-outline" to={`/lists/${listId}?focus=item:${item.id}`}>
            Open record
          </Link>
        </article>
      )}
      {!items.length && <p>No records in this group. Choose another group or add one in the collection.</p>}
    </section>
  );
}
