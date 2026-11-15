import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { memoryFilter, memoryPhotoHref, memorySourceHref } from '../shared/memories';
import { requestAddEntry } from '../shared/quick-entry';
import { CallBadge } from '../components/PersonalCall';
import { CabinetEmptyState } from '../components/CabinetEmptyState';
import { ArchiveIllustration } from '../components/ArchiveIllustration';
import '../choose.css';

const views = [
  { id: 'all', label: 'All saved' },
  { id: 'want', label: 'Want to try' },
  { id: 'favorite', label: 'Favorites' },
] as const;

export function ChoosePage() {
  usePageTitle('Choose');
  const [params, setParams] = useSearchParams();
  const view = views.find(({ id }) => id === params.get('view'))?.id ?? 'all';
  const query = params.get('q') ?? '';
  const [term, setTerm] = useState(query.trim());
  const search = useRef<HTMLInputElement>(null);
  const resultSection = useRef<HTMLElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const parsed = memoryFilter.safeParse({
    mode: 'saved',
    q: term,
    list: params.get('list') ?? '',
    call: view === 'favorite' ? 'favorite' : '',
    want: view === 'want' ? '1' : '',
  });
  const filter = parsed.success ? parsed.data : memoryFilter.parse({ mode: 'saved' });
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const records = useInfiniteQuery({
    queryKey: ['patterns', 'choices', filter],
    initialPageParam: 0,
    enabled: parsed.success,
    queryFn: ({ signal, pageParam }) => api.memories({ ...filter, offset: pageParam }, signal),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const entries = parsed.success
    ? [
        ...new Map(
          records.data?.pages
            .flatMap((page) => page.records)
            .map((record) => [`${record.kind}:${record.id}`, record]),
        ).values(),
      ]
    : [];
  const total = records.data?.pages[0]?.total ?? 0;
  const filtered = Boolean(query || filter.list || view !== 'all');
  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value && !(key === 'view' && value === 'all')) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }
  function clear() {
    setParams({}, { replace: true });
    search.current?.focus();
  }
  async function showMore() {
    const shown = new Set(entries.map((record) => `${record.kind}:${record.id}`));
    const next = await records.fetchNextPage();
    if (next.isError) return;
    const first = next.data?.pages
      .at(-1)
      ?.records.find((record) => !shown.has(`${record.kind}:${record.id}`));
    if (first)
      requestAnimationFrame(() => {
        if (
          resultSection.current?.dataset.filter === JSON.stringify(filter) &&
          search.current?.value.trim() === filter.q
        )
          document.getElementById(`choice-${first.kind}-${first.id}`)?.focus();
      });
  }
  return (
    <main className="light-page page-width choose-page">
      <header className="page-head">
        <div>
          <h1>Find your next pick.</h1>
          <p>What you liked. What you had in mind.</p>
        </div>
        <button
          className="button button-accent"
          onClick={() => requestAddEntry({ listId: filter.list || 'inbox' })}
        >
          <Plus size={18} /> Add item
        </button>
      </header>
      <div className="choice-filters">
        <div className="home-search">
          <MagnifyingGlass size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="choice-search">
            Search your saved choices
          </label>
          <input
            ref={search}
            id="choice-search"
            type="search"
            maxLength={120}
            placeholder="A name, a type, a word from your notes…"
            value={query}
            onChange={(event) => update({ q: event.target.value })}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear choice search"
              onClick={() => {
                update({ q: '' });
                search.current?.focus();
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <label className="choice-collection">
          <span className="sr-only">Collection</span>
          <select value={filter.list} onChange={(event) => update({ list: event.target.value })}>
            <option value="">All collections</option>
            <option value="inbox">Unfiled</option>
            {lists.data?.lists
              .filter((list) => list.kind === 'collection')
              .map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="choice-search-hint">Search your own words, like “quiet,” “light” or “for a rainy day.”</p>
      {lists.isError && (
        <p className="form-error" role="alert">
          Collections couldn’t load. <button onClick={() => void lists.refetch()}>Try again</button>
        </p>
      )}
      <div className="choice-views" role="group" aria-label="Saved choices">
        {views.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => update({ view: id })}>
            {label}
          </button>
        ))}
      </div>
      {!parsed.success ? (
        <div className="error-banner" role="alert">
          This filter isn’t available. <button onClick={clear}>Clear filters</button>
        </div>
      ) : records.isError && !entries.length ? (
        <div className="error-banner" role="alert">
          Your saved choices couldn’t load. <button onClick={() => void records.refetch()}>Try again</button>
          {filtered && <button onClick={clear}>Clear filters</button>}
        </div>
      ) : records.isPending ? (
        <p role="status">Finding your saved choices…</p>
      ) : entries.length ? (
        <section
          ref={resultSection}
          data-filter={JSON.stringify(filter)}
          aria-label="Your saved choices"
          aria-busy={records.isFetching || term !== query.trim()}
        >
          <div className="choice-results-head">
            <p role="status">
              {records.hasNextPage ? `Showing ${entries.length} of ${total}` : total} saved{' '}
              {total === 1 ? 'choice' : 'choices'}
            </p>
            {filtered && (
              <button type="button" onClick={clear}>
                Clear filters
              </button>
            )}
          </div>
          <div className="choice-grid">
            {entries.map((record) => (
              <article key={`${record.kind}:${record.id}`} className="choice-card">
                {record.hasPhoto && (
                  <img src={memoryPhotoHref(record)} alt={`Saved photo for ${record.title}`} loading="lazy" />
                )}
                <small>{record.listName}</small>
                <h2>
                  <Link id={`choice-${record.kind}-${record.id}`} to={memorySourceHref(record)}>
                    {record.title}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </h2>
                <div className="choice-calls">
                  {record.reaction ? (
                    <CallBadge value={record.reaction} />
                  ) : (
                    !record.wantToTry && <span className="choice-no-call">No call</span>
                  )}
                  {record.wantToTry && <span className="choice-plan">Want to try</span>}
                </div>
                {record.note && <p className="choice-note">{record.note}</p>}
              </article>
            ))}
          </div>
          {records.isFetchNextPageError && (
            <p className="form-error" role="alert">
              More choices couldn’t load. <button onClick={() => void showMore()}>Retry more choices</button>
            </p>
          )}
          {records.isRefetchError && (
            <p className="form-error" role="alert">
              Your choices couldn’t refresh. <button onClick={() => void records.refetch()}>Try again</button>
            </p>
          )}
          {records.hasNextPage && !records.isFetchNextPageError && (
            <button
              className="button button-outline choice-more"
              disabled={records.isFetchingNextPage}
              onClick={() => void showMore()}
            >
              {records.isFetchingNextPage ? 'Loading…' : 'Show more choices'}
            </button>
          )}
        </section>
      ) : (
        <CabinetEmptyState
          art={<ArchiveIllustration kind="search" />}
          title={filtered ? 'Nothing here yet.' : 'Your next pick starts here.'}
          description={
            filtered
              ? 'Try another word or browse all your saved choices.'
              : 'Save something you liked, or something you want to try. Your choices will be here.'
          }
        >
          {filtered ? (
            <button className="button button-outline" onClick={clear}>
              Clear filters
            </button>
          ) : (
            <button className="button button-accent" onClick={() => requestAddEntry()}>
              Add your first item
            </button>
          )}
        </CabinetEmptyState>
      )}
    </main>
  );
}
