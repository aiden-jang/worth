import { usePageTitle } from '../hooks/usePageTitle';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MagnifyingGlass, ArrowUpRight, X } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { CabinetEmptyState } from '../components/CabinetEmptyState';
import type { SearchResult } from '../shared/models';
import { searchScope, type SearchScope } from '../shared/search';

const resultKey = (result: SearchResult) => `${result.kind}-${result.id}`;

export function SearchPage() {
  usePageTitle('Search');
  const [params, setParams] = useSearchParams();
  const routeQuery = params.get('q') ?? '';
  const parsedScope = searchScope.safeParse(params.get('scope'));
  const scope = parsedScope.success ? parsedScope.data : 'all';
  const [query, setQuery] = useState(routeQuery);
  const input = useRef<HTMLInputElement>(null);
  const resultSection = useRef<HTMLElement>(null);
  const allScope = useRef<HTMLButtonElement>(null);
  useEffect(() => setQuery(routeQuery), [routeQuery]);
  const [term, setTerm] = useState(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useInfiniteQuery({
    queryKey: ['search', term, scope],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => api.search(term, signal, { scope, offset: pageParam }),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
    enabled: term.length >= 2,
  });
  const entries = [
    ...new Map(
      results.data?.pages.flatMap((page) => page.results).map((result) => [resultKey(result), result]),
    ).values(),
  ];
  const listResults = entries.filter((result) => result.kind === 'list');
  const itemResults = entries.filter((result) => result.kind === 'item');
  const inboxResults = entries.filter((result) => result.kind === 'inbox');
  const logResults = entries.filter((result) => result.kind === 'log');
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
  async function showMore() {
    const shown = new Set(entries.map(resultKey));
    const next = await results.fetchNextPage();
    if (next.isError) return;
    const first = next.data?.pages.at(-1)?.results.find((result) => !shown.has(resultKey(result)));
    if (!first) return;
    requestAnimationFrame(() => {
      const section = resultSection.current;
      if (
        section?.dataset.query !== term ||
        section.dataset.scope !== scope ||
        input.current?.value.trim() !== term
      )
        return;
      document.getElementById(`search-${resultKey(first)}`)?.focus();
    });
  }
  return (
    <main className="light-page search-page page-width">
      <header className="page-head">
        <div>
          <h1>Find that thing.</h1>
          <p>Search names and notes across your archive.</p>
        </div>
      </header>
      <div className="global-search">
        <MagnifyingGlass size={26} />
        <label className="sr-only" htmlFor="archive-search">
          Search all lists
        </label>
        <input
          id="archive-search"
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
      </div>
      {term.length < 2 ? (
        <CabinetEmptyState
          title="Somewhere in here."
          description="Search names and notes. Two characters will do."
        />
      ) : (
        <section ref={resultSection} className="search-results" data-query={term} data-scope={scope}>
          <div className="search-results-head">
            <p className="overline" role="status">
              {results.isPending
                ? 'Searching…'
                : `${results.hasNextPage ? 'SHOWING ' : ''}${visibleCount} ${visibleCount === 1 ? 'RESULT' : 'RESULTS'}`}
            </p>
            <div className="search-scope" role="group" aria-label="Filter search results">
              {(
                [
                  ['all', 'All'],
                  ['lists', 'Lists'],
                  ['inbox', 'Unfiled'],
                  ['items', 'Items'],
                  ['logs', 'Logs'],
                  ['exercises', 'Exercises'],
                ] as const
              ).map(([nextScope, label]) => (
                <button
                  ref={nextScope === 'all' ? allScope : undefined}
                  key={nextScope}
                  type="button"
                  className={scope === nextScope ? 'active' : undefined}
                  aria-pressed={scope === nextScope}
                  onClick={() => updateSearch(query, nextScope)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {results.isPending ? null : results.isError && !entries.length ? (
            <div className="error-banner" role="alert">
              Search isn't available right now.{' '}
              <button onClick={() => void results.refetch()}>Try again</button>
            </div>
          ) : visibleCount ? (
            visibleGroups.map((group) =>
              group.results.length ? (
                <SearchGroup key={group.scope} label={group.label} results={group.results} />
              ) : null,
            )
          ) : (
            <CabinetEmptyState
              title="It’s being elusive."
              description={
                scope === 'all'
                  ? 'Try a shorter search or a different spelling.'
                  : 'No matches with this filter.'
              }
            >
              {scope !== 'all' && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    updateSearch(query, 'all');
                    allScope.current?.focus();
                  }}
                >
                  Search all categories
                </button>
              )}
            </CabinetEmptyState>
          )}
          {results.isFetchNextPageError && (
            <p className="form-error" role="alert">
              More results couldn’t load. Your current results are still here.
            </p>
          )}
          {results.hasNextPage && (
            <button
              className="button button-outline search-more"
              type="button"
              disabled={results.isFetchingNextPage}
              onClick={() => void showMore()}
            >
              {results.isFetchingNextPage
                ? 'Loading…'
                : results.isFetchNextPageError
                  ? 'Retry more results'
                  : 'Show more results'}
            </button>
          )}
        </section>
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
          id={`search-${resultKey(result)}`}
          key={resultKey(result)}
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
