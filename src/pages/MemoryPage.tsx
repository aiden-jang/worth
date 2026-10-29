import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDate } from '../format';
import { retrospectivePeriod } from '../shared/retrospective';
import { isSavedMemory, memorySourceHref, memoryFilter } from '../shared/memories';
import { decisionLabel } from '../shared/decisions';
import '../memories.css';

export function MemoryPage({ embedded = false }: { embedded?: boolean }) {
  usePageTitle(embedded ? 'Look back' : 'Memories');
  const [params, setParams] = useSearchParams();
  const parsed = memoryFilter.safeParse(Object.fromEntries(params));
  const filter = parsed.success ? parsed.data : memoryFilter.parse({});
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const archived = useQuery({
    queryKey: ['lists', 'archived'],
    queryFn: api.archivedLists,
    enabled: filter.archived === '1',
  });
  const records = useInfiniteQuery({
    queryKey: ['patterns', 'memories', filter],
    initialPageParam: 0,
    enabled: parsed.success,
    queryFn: ({ pageParam, signal }) => api.memories({ ...filter, offset: pageParam }, signal),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const choices = [
    ...(lists.data?.lists ?? []),
    ...(filter.archived === '1' ? (archived.data?.lists ?? []) : []),
  ];
  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.delete('offset');
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }
  const data = parsed.success ? records.data : undefined;
  const entries = data?.pages.flatMap((page) => page.records) ?? [];
  const Container = embedded ? 'section' : 'main';
  return (
    <Container
      className={embedded ? 'memory-page embedded-memories' : 'light-page page-width memory-page'}
      aria-label={embedded ? 'Memories' : undefined}
    >
      {!embedded && (
        <header className="page-head">
          <div>
            <p className="overline">YOUR PAPER TRAIL</p>
            <h1>Memories.</h1>
            <p>Where you went. What you tried.</p>
          </div>
          <Link to="/patterns">Back to Look back →</Link>
        </header>
      )}
      <div className="memory-modes" role="group" aria-label="Memory type">
        <button
          className="button button-outline"
          aria-pressed={filter.mode === 'visits'}
          onClick={() => update({ mode: 'visits', list: filter.list === 'inbox' ? '' : filter.list })}
        >
          Experiences
        </button>
        <button
          className="button button-outline"
          aria-pressed={filter.mode === 'saved'}
          onClick={() => update({ mode: 'saved' })}
        >
          Saved things
        </button>
      </div>
      <p>
        {filter.mode === 'visits'
          ? 'Dated visits and activity. Names you kept are under Saved things.'
          : 'Dates below are when you first saved each name (UTC), not when you experienced it.'}
      </p>
      <form className="memory-filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Find a name, place or note
          <input
            type="search"
            maxLength={120}
            value={params.get('q') ?? ''}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
      </form>
      <details
        className="memory-date-options"
        open={Boolean(
          params.get('from') ||
          params.get('to') ||
          filter.archived === '1' ||
          filter.list ||
          filter.type ||
          filter.label,
        )}
      >
        <summary>
          Filters
          {filter.from || filter.to || filter.list || filter.archived === '1' || filter.type || filter.label
            ? ' · On'
            : ''}
        </summary>
        <div className="memory-filters">
          <label>
            Collection or activity
            <select value={filter.list} onChange={(e) => update({ list: e.target.value })}>
              <option value="">All lists</option>
              {filter.mode === 'saved' && <option value="inbox">Unfiled</option>}
              {filter.list && filter.list !== 'inbox' && !choices.some((list) => list.id === filter.list) && (
                <option value={filter.list}>Selected list</option>
              )}
              {choices.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                  {list.archived ? ' / archived' : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            From
            <input
              type="date"
              value={params.get('from') ?? ''}
              onChange={(e) => update({ from: e.target.value })}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={params.get('to') ?? ''}
              onChange={(e) => update({ to: e.target.value })}
            />
          </label>
          <label className="memory-check">
            <input
              type="checkbox"
              checked={filter.archived === '1'}
              onChange={(e) => update({ archived: e.target.checked ? '1' : '0', list: '' })}
            />
            Include archived lists
          </label>
        </div>
        <div className="memory-shortcuts">
          {(['month', 'last-month', 'year'] as const).map((period, index) => (
            <button
              className="button button-outline"
              key={period}
              onClick={() => update(retrospectivePeriod(period))}
            >
              {['This month', 'Last month', 'This year'][index]}
            </button>
          ))}
          <button
            className="button button-outline"
            onClick={() => setParams({ mode: filter.mode }, { replace: true })}
          >
            Clear filters
          </button>
        </div>
      </details>
      {(filter.type || filter.label) && (
        <p>
          Supporting records for {filter.type || filter.label}. All reactions, including no reaction, are
          included.
        </p>
      )}
      {!parsed.success && <p role="alert">Choose real dates, with the end on or after the start.</p>}
      {(lists.isError || archived.isError) && (
        <p role="alert">
          Some lists couldn’t load.{' '}
          <button
            onClick={() => {
              void lists.refetch();
              if (filter.archived === '1') void archived.refetch();
            }}
          >
            Try again
          </button>
        </p>
      )}
      {records.isPending && parsed.success && <p role="status">Finding your records…</p>}
      {parsed.success && records.isError && (
        <p role="alert">
          Couldn’t load these memories.{' '}
          <button className="button button-outline" onClick={() => void records.refetch()}>
            Try again
          </button>
        </p>
      )}
      {data && (
        <p role="status">
          {data.pages[0].total} matching {data.pages[0].total === 1 ? 'record' : 'records'}
        </p>
      )}
      {data && !entries.length && (
        <p className="workspace-empty">
          Nothing recorded here yet. Try another period, or log an experience in a collection.
        </p>
      )}
      <ol className="memory-timeline">
        {entries.map((record) => (
          <li key={`${record.kind}:${record.id}`}>
            <time dateTime={record.date}>{formatDate(record.date)}</time>
            <article>
              <p className="overline">
                {record.kind === 'unfiled'
                  ? 'SAVED / UNFILED'
                  : record.kind === 'saved'
                    ? 'SAVED'
                    : record.kind === 'visit'
                      ? 'VISIT'
                      : 'ACTIVITY'}{' '}
                · {record.listName}
              </p>
              <h2>
                <Link to={memorySourceHref(record)}>{record.title} ↗</Link>
              </h2>
              {record.location && <p>{record.location}</p>}
              {record.order && <p>{record.order}</p>}
              {record.reaction && (
                <span className="memory-stamp">
                  {decisionLabel(record.reaction)}
                  {record.kind === 'visit' ? ' this time' : ''}
                </span>
              )}
              {record.note && <p className="memory-note">{record.note}</p>}
              {record.hasPhoto && record.kind !== 'unfiled' && (
                <img
                  className="memory-photo"
                  src={`/api/${isSavedMemory(record) ? 'items' : 'logs'}/${record.id}/photo`}
                  alt={`Saved photo for ${record.title}`}
                  loading="lazy"
                />
              )}
            </article>
          </li>
        ))}
      </ol>
      {data && records.hasNextPage && (
        <button
          className="button button-outline"
          disabled={records.isFetchingNextPage}
          onClick={() => void records.fetchNextPage()}
        >
          {records.isFetchingNextPage ? 'Loading…' : 'Show older records'}
        </button>
      )}
    </Container>
  );
}
