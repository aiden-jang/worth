import { usePageTitle } from '../hooks/usePageTitle';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, ArrowUpRight, X } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { CabinetEmptyState } from '../components/CabinetEmptyState';
import type { SearchResult } from '../shared/models';

type SearchScope = 'all' | 'lists' | 'items' | 'logs' | 'exercises' | 'inbox';

function searchScope(value: string | null): SearchScope {
  return value === 'lists' ||
    value === 'items' ||
    value === 'logs' ||
    value === 'exercises' ||
    value === 'inbox'
    ? value
    : 'all';
}

export function SearchPage() {
  usePageTitle('Search');
  const [params, setParams] = useSearchParams();
  const routeQuery = params.get('q') ?? '';
  const scope = searchScope(params.get('scope'));
  const [query, setQuery] = useState(routeQuery);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setQuery(routeQuery), [routeQuery]);
  const [term, setTerm] = useState(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useQuery({
    queryKey: ['search', term],
    queryFn: ({ signal }) => api.search(term, signal),
    enabled: term.length >= 2,
  });
  const listResults = results.data?.results.filter((result) => result.kind === 'list') ?? [];
  const itemResults = results.data?.results.filter((result) => result.kind === 'item') ?? [];
  const inboxResults = results.data?.results.filter((result) => result.kind === 'inbox') ?? [];
  const logResults = results.data?.results.filter((result) => result.kind === 'log') ?? [];
  const groups: { scope: Exclude<SearchScope, 'all'>; label: string; results: SearchResult[] }[] = [
    { scope: 'inbox', label: 'Unfiled', results: inboxResults },
    { scope: 'lists', label: 'Lists', results: listResults },
    { scope: 'items', label: 'Items', results: itemResults },
    { scope: 'logs', label: 'Logs', results: logResults },
  ];
  const exercises = logResults.filter((result) => result.exercise);
  const visibleGroups =
    scope === 'exercises'
      ? [{ scope: 'exercises', label: 'Exercises', results: exercises }]
      : scope === 'all'
        ? groups
        : groups.filter((group) => group.scope === scope);
  const visibleCount = visibleGroups.reduce((total, group) => total + group.results.length, 0);

  function updateSearch(nextQuery: string, nextScope = scope) {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set('q', nextQuery);
    if (nextScope !== 'all') next.set('scope', nextScope);
    setParams(next, { replace: true });
  }
  return (
    <main className="light-page search-page page-width">
      <p className="overline">SEARCH YOUR ARCHIVE</p>
      <h1>Find that thing.</h1>
      <label className="global-search">
        <MagnifyingGlass size={26} />
        <span className="sr-only">Search all lists</span>
        <input
          ref={input}
          autoFocus
          placeholder="An exercise, a note, a good drink…"
          maxLength={40}
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            updateSearch(next);
          }}
        />
        {query && (
          <button
            className="search-clear"
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              updateSearch('');
              input.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        )}
      </label>
      {term.length < 2 ? (
        <CabinetEmptyState
          title="Somewhere in here."
          description="Search names and notes. Two characters will do."
        />
      ) : results.isPending ? (
        <p className="search-hint" role="status">
          Searching…
        </p>
      ) : results.isError ? (
        <div className="error-banner" role="alert">
          Search isn't available right now. <button onClick={() => void results.refetch()}>Try again</button>
        </div>
      ) : results.data.results.length ? (
        <section className="search-results">
          <div className="search-results-head">
            <p className="overline">
              {visibleCount} {visibleCount === 1 ? 'RESULT' : 'RESULTS'}
            </p>
            <div className="search-scope" role="group" aria-label="Filter search results">
              {(
                [
                  ['all', 'All', results.data.results.length],
                  ['lists', 'Lists', listResults.length],
                  ['inbox', 'Unfiled', inboxResults.length],
                  ['items', 'Items', itemResults.length],
                  ['logs', 'Logs', logResults.length],
                  ['exercises', 'Exercises', exercises.length],
                ] as const
              ).map(([nextScope, label, count]) => (
                <button
                  key={nextScope}
                  type="button"
                  className={scope === nextScope ? 'active' : undefined}
                  aria-pressed={scope === nextScope}
                  onClick={() => updateSearch(query, nextScope)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
          </div>
          {visibleCount ? (
            visibleGroups.map((group) =>
              group.results.length ? (
                <SearchGroup key={group.scope} label={group.label} results={group.results} />
              ) : null,
            )
          ) : (
            <div className="search-filter-empty">No matches with this filter.</div>
          )}
        </section>
      ) : (
        <CabinetEmptyState
          title="It’s being elusive."
          description="Try a shorter search or a different spelling."
        />
      )}
    </main>
  );
}

function SearchGroup({ label, results }: { label: string; results: SearchResult[] }) {
  return (
    <section className="search-group" aria-label={label}>
      <p>{label}</p>
      {results.map((result) => (
        <Link
          key={`${result.kind}-${result.id}`}
          to={
            result.kind === 'inbox'
              ? `/inbox?focus=${result.id}`
              : result.kind === 'list'
                ? `/lists/${result.listId}`
                : `/lists/${result.listId}?focus=${result.kind}:${result.id}`
          }
        >
          <span>
            <small>
              {result.kind === 'list'
                ? `LIST / ${result.detail || 'ARCHIVE'}`
                : result.kind === 'inbox'
                  ? 'INBOX / UNFILED'
                  : `${result.listName} / ${result.kind === 'item' ? 'ITEM' : result.itemId ? 'REVISIT' : 'ACTIVITY'}`}
              {result.listArchived && ' · ARCHIVED'}
            </small>
            <strong>{result.title}</strong>
            {result.detail && <em>{result.detail}</em>}
          </span>
          <ArrowUpRight size={20} />
        </Link>
      ))}
    </section>
  );
}
