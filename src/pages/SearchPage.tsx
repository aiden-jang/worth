import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, ArrowUpRight, X } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import type { SearchResult } from '../shared/models';

type SearchScope = 'all' | 'lists' | 'items' | 'logs';

function searchScope(value: string | null): SearchScope {
  return value === 'lists' || value === 'items' || value === 'logs' ? value : 'all';
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const routeQuery = params.get('q') ?? '';
  const scope = searchScope(params.get('scope'));
  const [query, setQuery] = useState(routeQuery);
  useEffect(() => setQuery(routeQuery), [routeQuery]);
  const term = query.trim();
  const results = useQuery({
    queryKey: ['search', term],
    queryFn: () => api.search(term),
    enabled: term.length >= 2,
  });
  const listResults = results.data?.results.filter((result) => result.kind === 'list') ?? [];
  const itemResults = results.data?.results.filter((result) => result.kind === 'item') ?? [];
  const logResults = results.data?.results.filter((result) => result.kind === 'log') ?? [];
  const groups: { scope: Exclude<SearchScope, 'all'>; label: string; results: SearchResult[] }[] = [
    { scope: 'lists', label: 'Lists', results: listResults },
    { scope: 'items', label: 'Items', results: itemResults },
    { scope: 'logs', label: 'Logs', results: logResults },
  ];
  const visibleGroups = scope === 'all' ? groups : groups.filter((group) => group.scope === scope);
  const visibleCount = visibleGroups.reduce((total, group) => total + group.results.length, 0);

  function updateSearch(nextQuery: string, nextScope = scope) {
    const next = new URLSearchParams();
    if (nextQuery.trim()) next.set('q', nextQuery);
    if (nextScope !== 'all') next.set('scope', nextScope);
    setParams(next, { replace: true });
  }
  return (
    <main className="light-page search-page page-width">
      <p className="overline">YOUR ARCHIVE, ALL AT ONCE</p>
      <h1>Find that thing.</h1>
      <label className="global-search">
        <MagnifyingGlass size={26} />
        <span className="sr-only">Search all lists</span>
        <input
          autoFocus
          placeholder="A film, a place, a good drink…"
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
            }}
          >
            <X size={18} />
          </button>
        )}
      </label>
      {term.length < 2 ? (
        <p className="search-hint">Type at least two characters to search your lists and logs.</p>
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
                  ['items', 'Items', itemResults.length],
                  ['logs', 'Logs', logResults.length],
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
            <div className="search-filter-empty">Nothing in this part of your archive matches that name.</div>
          )}
        </section>
      ) : (
        <div className="search-empty">
          <h2>Nothing under that name.</h2>
          <p>Try a shorter search or a different spelling.</p>
        </div>
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
            result.kind === 'list'
              ? `/lists/${result.listId}`
              : `/lists/${result.listId}?focus=${result.kind}:${result.id}`
          }
        >
          <span>
            <small>
              {result.kind === 'list'
                ? `LIST / ${result.detail || 'ARCHIVE'}`
                : `${result.listName} / ${result.kind === 'item' ? 'ITEM' : result.itemId ? 'REVISIT' : 'ACTIVITY'}`}
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
