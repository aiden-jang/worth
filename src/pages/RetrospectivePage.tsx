import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { CabinetEmptyState } from '../components/CabinetEmptyState';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  localRetrospectiveFilter,
  retrospectiveDraft,
  retrospectivePeriod,
  type RetrospectiveDraft,
  type RetrospectiveFilter,
  type RetrospectiveRecord,
} from '../shared/retrospective';
import '../retrospective.css';

export function RetrospectivePage() {
  usePageTitle('Look back');
  const online = useConnection();
  const draft = useDraft<RetrospectiveDraft>(
    'retrospective',
    { ...retrospectivePeriod('month'), listId: '', includeArchived: false, notes: false },
    (value): value is RetrospectiveDraft => retrospectiveDraft.safeParse(value).success,
  );
  const form = draft.form;
  const [applied, setApplied] = useState<{ filter: RetrospectiveFilter; zone: string } | null>(null),
    [error, setError] = useState('');
  const results = useRef<HTMLElement>(null),
    focusResults = useRef(false);
  const current = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const archived = useQuery({
    queryKey: ['lists', 'archived'],
    queryFn: api.archivedLists,
    enabled: form.includeArchived,
  });
  const lists = [
    ...(current.data?.lists ?? []),
    ...(form.includeArchived ? (archived.data?.lists ?? []) : []),
  ];
  const scopeReady =
    current.isSuccess &&
    (!form.includeArchived || archived.isSuccess) &&
    (!form.listId || lists.some((list) => list.id === form.listId));
  const query = useQuery({
    queryKey: ['retrospective', applied?.filter],
    queryFn: ({ signal }) => api.retrospective(applied!.filter, signal),
    enabled: !!applied,
  });
  useEffect(() => {
    if (focusResults.current && query.data && !query.isFetching) {
      focusResults.current = false;
      results.current?.focus({ preventScroll: true });
      results.current?.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  }, [query.dataUpdatedAt, query.data, query.isFetching]);
  let changed = false;
  if (applied) {
    try {
      changed = JSON.stringify(applied.filter) !== JSON.stringify(localRetrospectiveFilter(form));
    } catch {
      changed = true;
    }
  }
  function edit(patch: Partial<RetrospectiveDraft>) {
    draft.setForm({ ...form, ...patch });
    setError('');
  }
  function showPeriod() {
    try {
      const filter = localRetrospectiveFilter(form);
      if (!scopeReady) {
        setError('Choose an available list, or all lists and Inbox.');
        return;
      }
      focusResults.current = true;
      if (applied && JSON.stringify(applied.filter) === JSON.stringify(filter)) void query.refetch();
      setApplied({ filter, zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      setError('');
    } catch {
      setError('Choose real start/end dates for a period of one to 366 days.');
    }
  }
  const data = query.data;
  return (
    <main className="light-page page-width retrospective-page">
      <header className="page-head">
        <div>
          <p className="overline">ON RECORD</p>
          <h1>Look back.</h1>
          <p>A few pages, revisited.</p>
        </div>
        <Link to="/patterns">Back to Patterns →</Link>
      </header>
      <p className="retro-intro">
        Choose a period to see what you kept and logged. This is a private look at records you still have.
        Your records are not changed or shared.
      </p>
      <form
        className="retro-form"
        aria-label="Retrospective period"
        onSubmit={(event) => {
          event.preventDefault();
          showPeriod();
        }}
      >
        <div className="data-actions">
          {(
            [
              ['month', 'This month'],
              ['last-month', 'Last month'],
              ['year', 'This year'],
            ] as const
          ).map(([key, label]) => (
            <button
              type="button"
              className="button button-outline"
              key={key}
              onClick={() => edit(retrospectivePeriod(key))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="retro-date-fields">
          <label>
            From
            <input
              type="date"
              required
              value={form.from}
              onChange={(event) => edit({ from: event.target.value })}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              required
              value={form.to}
              onChange={(event) => edit({ to: event.target.value })}
            />
          </label>
        </div>
        <label>
          List to look back on
          <select value={form.listId} onChange={(event) => edit({ listId: event.target.value })}>
            <option value="">All lists and Inbox</option>
            {form.listId && !lists.some((list) => list.id === form.listId) && (
              <option value={form.listId}>Unavailable list — choose another</option>
            )}
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
                {list.archived ? ' / Archived' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="retro-check">
          <input
            type="checkbox"
            checked={form.includeArchived}
            onChange={(event) => edit({ includeArchived: event.target.checked })}
          />
          Include archived collections
        </label>
        {(current.isError || (form.includeArchived && archived.isError)) && (
          <p role="alert">
            Couldn’t read your lists.{' '}
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                void current.refetch();
                if (form.includeArchived) void archived.refetch();
              }}
            >
              Retry lists
            </button>
          </p>
        )}
        <p className="muted">
          Choose up to 366 days. Saved dates follow this device’s time zone; logs use the dates you entered. A
          saved date is when a find was kept, not when it was first tried.
        </p>
        <button type="submit" className="button button-accent" disabled={!scopeReady || !online}>
          Show this period
        </button>
        {changed && <p role="status">These controls changed. Show this period to update the recap below.</p>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {draft.status && (
          <p role="status" className="draft-status">
            {draft.status}
          </p>
        )}
      </form>
      {!online && (
        <p role="status" className="error-banner">
          You’re offline. A loaded recap may be out of date; reconnect to read or refresh a period.
        </p>
      )}
      {applied && query.isPending && <p role="status">Reading this period…</p>}
      {query.isError && (
        <p role="alert" className="error-banner">
          {query.error.message} {data && 'Loaded results may be out of date.'}{' '}
          <button className="button button-outline" disabled={!online} onClick={() => void query.refetch()}>
            Try this period again
          </button>
        </p>
      )}
      {data && applied && (
        <section className="retro-results" aria-labelledby="retro-results-title" ref={results} tabIndex={-1}>
          <header className="retro-results-head">
            <div>
              <p className="overline">
                {data.scopeName}
                {data.period.includeArchived ? ' / INCLUDES ARCHIVED' : ''}
              </p>
              <h2 id="retro-results-title">
                {displayDay(data.period.from)} – {displayDay(data.period.to)}
              </h2>
              <p>Saved dates in {zoneName(applied.zone)}. Names and notes show what is saved now.</p>
            </div>
            <button
              className="button button-outline"
              disabled={!online || query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? 'Refreshing…' : 'Refresh this period'}
            </button>
          </header>
          <section className="pattern-stat-grid" aria-label="Period totals">
            {(
              [
                ['Kept', data.counts.kept, 'Finds saved in this period'],
                ['Revisits', data.counts.revisits, 'Dated collection visits'],
                ['Activity logs', data.counts.activity, 'Dated activity entries'],
              ] as const
            ).map(([label, count, detail]) => (
              <article key={label}>
                <p>{label}</p>
                <strong>{count}</strong>
                <span>{detail}</span>
              </article>
            ))}
          </section>
          {!data.counts.kept && !data.counts.revisits && !data.counts.activity ? (
            <CabinetEmptyState
              title="A quiet page."
              description="No currently kept records match these dates and lists. Choose another period whenever you like."
            />
          ) : (
            <>
              <label className="retro-check retro-notes">
                <input
                  type="checkbox"
                  checked={form.notes}
                  onChange={(event) => edit({ notes: event.target.checked })}
                />
                Show private notes in this recap
              </label>
              <div className="retro-groups">
                <RecordGroup
                  title="Newly kept"
                  records={data.kept}
                  total={data.counts.kept}
                  notes={form.notes}
                  timeZone={applied.zone}
                />
                <RecordGroup
                  title="Visits & activity"
                  records={data.logs}
                  total={data.counts.revisits + data.counts.activity}
                  notes={form.notes}
                  timeZone={applied.zone}
                />
              </div>
            </>
          )}
          <p className="muted retro-footnote">
            This view uses currently kept records, including Inbox when all lists are selected. Merged finds
            are not counted separately; Trash is excluded. It does not reconstruct earlier calls, ranks or
            deleted records.
          </p>
        </section>
      )}
    </main>
  );
}
function displayDay(day: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}
function RecordGroup({
  title,
  records,
  total,
  notes,
  timeZone,
}: {
  title: string;
  records: RetrospectiveRecord[];
  total: number;
  notes: boolean;
  timeZone: string;
}) {
  return (
    <section className="retro-group" aria-label={title}>
      <h3>{title}</h3>
      {total > records.length && (
        <p>
          Showing the latest {records.length} of {total}. Narrow the period to see other records.
        </p>
      )}
      {!records.length ? (
        <p>No matching records in this group.</p>
      ) : (
        <ul>
          {records.map((record) => (
            <li key={`${record.kind}:${record.id}`}>
              <p className="overline">
                {record.kind === 'item' || record.kind === 'inbox'
                  ? 'KEPT'
                  : record.kind === 'visit'
                    ? 'VISIT'
                    : 'ACTIVITY'}{' '}
                /{' '}
                {record.happenedOn ? (
                  <time dateTime={record.happenedOn}>{displayDay(record.happenedOn)}</time>
                ) : (
                  <time dateTime={new Date(record.createdAt).toISOString()}>
                    {new Date(record.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      timeZone,
                    })}
                  </time>
                )}
              </p>
              <Link
                to={
                  record.kind === 'inbox'
                    ? `/inbox?focus=${record.id}`
                    : `/lists/${record.listId}?focus=${record.kind === 'item' ? 'item' : 'log'}:${record.id}`
                }
              >
                {record.title} <span aria-hidden="true">→</span>
              </Link>
              <p className="retro-list-name">
                {record.listName}
                {record.archived ? ' / Archived' : ''}
              </p>
              {notes && record.note && <p className="retro-record-note">{record.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function zoneName(zone: string) {
  try {
    return (
      new Intl.DateTimeFormat(undefined, { timeZone: zone, timeZoneName: 'longGeneric' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? zone.replaceAll('_', ' ')
    );
  } catch {
    return zone.replaceAll('_', ' ');
  }
}
