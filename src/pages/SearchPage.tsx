import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass, ArrowUpRight, X } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const routeQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(routeQuery);
  useEffect(() => setQuery(routeQuery), [routeQuery]);
  const term = query.trim();
  const results = useQuery({
    queryKey: ['search', term],
    queryFn: () => api.search(term),
    enabled: term.length >= 2,
  });
  const itemResults = results.data?.results.filter((result) => result.kind === 'item') ?? [];
  const logResults = results.data?.results.filter((result) => result.kind === 'log') ?? [];
  return (
    <main className="light-page search-page page-width">
      <p className="overline">YOUR ARCHIVE, ALL AT ONCE</p>
      <h1>Find something</h1>
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
            setParams(next.trim() ? { q: next } : {}, { replace: true });
          }}
        />
        {query && (
          <button
            className="search-clear"
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setParams({}, { replace: true });
            }}
          >
            <X size={18} />
          </button>
        )}
      </label>
      {term.length < 2 ? (
        <p className="search-hint">Type at least two characters to search your lists and logs.</p>
      ) : results.isPending ? (
        <p className="search-hint">Searching…</p>
      ) : results.isError ? (
        <p className="error-banner">Search isn't available right now.</p>
      ) : results.data.results.length ? (
        <section className="search-results">
          <p className="overline">{results.data.results.length} RESULTS</p>
          {itemResults.length > 0 && <SearchGroup label="Items" results={itemResults} />}
          {logResults.length > 0 && <SearchGroup label="Activity logs" results={logResults} />}
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

function SearchGroup({
  label,
  results,
}: {
  label: string;
  results: {
    id: string;
    listId: string;
    listName: string;
    kind: 'item' | 'log';
    title: string;
    detail: string;
  }[];
}) {
  return (
    <section className="search-group" aria-label={label}>
      <p>{label}</p>
      {results.map((result) => (
        <Link
          key={`${result.kind}-${result.id}`}
          to={`/lists/${result.listId}?focus=${result.kind}:${result.id}`}
        >
          <span>
            <small>
              {result.listName} / {result.kind === 'log' ? 'LOG' : 'ITEM'}
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
