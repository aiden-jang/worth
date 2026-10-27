import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  calendarDays,
  calendarFilter,
  calendarLabel,
  shiftCalendarMonth,
  type CalendarFilter,
} from '../shared/activity-calendar';
import { today } from '../format';
import '../activity-calendar.css';

export function ActivityCalendarPage() {
  usePageTitle('Activity calendar');
  const [initial] = useState<CalendarFilter>(() => {
    const day = today();
    return { month: day.slice(0, 7), day, includeArchived: false };
  });
  const draft = useDraft<CalendarFilter>(
    'activity-calendar',
    initial,
    (value): value is CalendarFilter => calendarFilter.safeParse(value).success,
  );
  const form = draft.form;
  const [applied, setApplied] = useState<CalendarFilter | null>(null),
    [cursor, setCursor] = useState('');
  const calendar = useQuery({
    queryKey: ['activity-calendar', applied, cursor],
    queryFn: ({ signal }) => api.calendar(applied!, cursor, signal),
    enabled: !!applied,
    placeholderData: keepPreviousData,
  });
  const result = calendar.data;
  const agendaHeading = useRef<HTMLHeadingElement>(null),
    pendingDay = useRef<string | null>(null);
  useEffect(() => {
    if (!result || calendar.isFetching || pendingDay.current !== result.filter.day) return;
    pendingDay.current = null;
    agendaHeading.current?.focus({ preventScroll: true });
    agendaHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [result, calendar.isFetching]);

  const days = result ? calendarDays(result.filter.month) : [];
  const selectedCount = result?.days.find((row) => row.day === result.filter.day);
  const total =
    (selectedCount?.planned ?? 0) + (selectedCount?.visits ?? 0) + (selectedCount?.activities ?? 0);

  const weekday = days.length ? new Date(`${days[0]}T00:00:00Z`).getUTCDay() : 0;
  const changed = applied && JSON.stringify(form) !== JSON.stringify(applied);
  function show(filter: CalendarFilter) {
    pendingDay.current = null;
    setCursor('');
    setApplied(filter);
  }
  function month(value: string) {
    draft.setForm({ ...form, month: value, day: `${value}-01` });
  }
  return (
    <main className="light-page page-width activity-calendar-page">
      <header className="page-head">
        <div>
          <p className="overline">DAYS YOU CHOSE</p>
          <h1>Calendar</h1>
          <p>Plans, visits and activities.</p>
        </div>
        <Link to="/patterns">Back to Patterns →</Link>
      </header>
      <p className="calendar-intro">
        See visits and activities on the dates you logged. Revisit plans use the saved date or snooze. Opening
        a plan changes nothing. Worth sends no reminders.
      </p>
      <form
        className="calendar-controls"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = calendarFilter.safeParse(form);
          if (parsed.success) show(parsed.data);
        }}
      >
        <label>
          Month
          <input type="month" required value={form.month} onChange={(e) => month(e.target.value)} />
        </label>
        <label className="calendar-check">
          <input
            type="checkbox"
            checked={form.includeArchived}
            onChange={(e) => draft.setForm({ ...form, includeArchived: e.target.checked })}
          />
          Include archived collections
        </label>
        <button className="button button-accent" disabled={!calendarFilter.safeParse(form).success}>
          Show calendar
        </button>
        <div className="data-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={!calendarFilter.safeParse(form).success}
            onClick={() => month(shiftCalendarMonth(form.month, -1))}
          >
            Previous month
          </button>
          <button
            type="button"
            className="button button-outline"
            disabled={!calendarFilter.safeParse(form).success}
            onClick={() => month(shiftCalendarMonth(form.month, 1))}
          >
            Next month
          </button>
        </div>
      </form>
      <p role="status">
        {draft.status || 'Calendar choices can recover on this account/device for seven days.'}
      </p>
      {changed && <p role="status">Your choices changed. Show calendar to apply them.</p>}
      {calendar.isFetching && <p role="status">Opening entered days…</p>}
      {calendar.isError && !result && (
        <p role="alert">
          {calendar.error.message}{' '}
          <button className="button button-outline" onClick={() => void calendar.refetch()}>
            Try calendar again
          </button>
        </p>
      )}
      {result && (
        <>
          <section aria-label="Month calendar" className="calendar-month">
            <h2 id="calendar-month" tabIndex={-1}>
              {new Date(`${result.filter.month}-01T00:00:00Z`).toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </h2>
            <p>
              Plans are not completed visits. Choose a day for its readable list.{' '}
              {result.filter.includeArchived
                ? 'Archived collections are included.'
                : 'Archived collections are excluded.'}
            </p>
            <div className="calendar-weekdays" aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <ol className="calendar-grid">
              {days.map((day, index) => {
                const count = result.days.find((row) => row.day === day);
                const summary = `${count?.planned ?? 0} planned, ${count?.visits ?? 0} ${count?.visits === 1 ? 'visit' : 'visits'}, ${count?.activities ?? 0} ${count?.activities === 1 ? 'activity' : 'activities'}`;
                return (
                  <li key={day} style={index === 0 ? { gridColumnStart: weekday + 1 } : undefined}>
                    <button
                      aria-pressed={result.filter.day === day}
                      aria-label={`${day}: ${summary}`}
                      onClick={() => {
                        const next = { ...result.filter, day };
                        draft.setForm(next);
                        show(next);
                        if (result.filter.day === day && !calendar.isFetching) {
                          agendaHeading.current?.focus({ preventScroll: true });
                          agendaHeading.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
                        } else pendingDay.current = day;
                      }}
                    >
                      <time dateTime={day}>{day.slice(-2)}</time>{' '}
                      <span className="calendar-day-summary">
                        {count?.planned ? <span>{count.planned} planned</span> : null}{' '}
                        {count?.visits ? (
                          <span>
                            {count.visits} {count.visits === 1 ? 'visit' : 'visits'}
                          </span>
                        ) : null}{' '}
                        {count?.activities ? (
                          <span>
                            {count.activities} {count.activities === 1 ? 'activity' : 'activities'}
                          </span>
                        ) : null}
                        {!count && <span className="calendar-empty-day">—</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="calendar-agenda" aria-label="Selected day" aria-busy={calendar.isFetching}>
            <header>
              <h2 ref={agendaHeading} tabIndex={-1}>
                <time dateTime={result.filter.day}>{result.filter.day}</time>
              </h2>
              <div className="data-actions">
                <a className="button button-outline" href="#calendar-month">
                  Choose another day
                </a>
                <button className="button button-outline" onClick={() => void calendar.refetch()}>
                  Refresh this day
                </button>
              </div>
            </header>
            {calendar.isFetching && <p role="status">Refreshing this day…</p>}
            {calendar.isError && (
              <p role="alert">
                {calendar.error.message} Showing the last opened entries.{' '}
                <button className="button button-outline" onClick={() => void calendar.refetch()}>
                  Try calendar again
                </button>
              </p>
            )}
            {!result.entries.length && <p>No saved plans or logs on this day.</p>}
            {total > result.entries.length && (
              <p>
                {result.entries.length} of {total} entries on this page. Use the entry controls below to
                continue or return.
              </p>
            )}

            <ul>
              {result.entries.map((entry) => (
                <li key={`${entry.kind}:${entry.id}`}>
                  <p className="overline">{calendarLabel(entry.kind)}</p>
                  <Link
                    to={
                      entry.kind === 'inbox'
                        ? `/inbox?focus=${entry.id}`
                        : `/lists/${entry.listId}?focus=${entry.kind === 'revisit' ? 'item' : 'log'}:${entry.id}`
                    }
                  >
                    {entry.title} →
                  </Link>
                  <p>
                    {entry.listName}
                    {entry.archived ? ' / Archived' : ''}
                  </p>
                  {entry.originalDay && entry.originalDay !== entry.day && (
                    <p>
                      Originally {entry.originalDay}; snoozed to {entry.day}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <div className="data-actions">
              {cursor && (
                <button className="button button-outline" onClick={() => setCursor('')}>
                  First entries
                </button>
              )}
              {result.next && (
                <button className="button button-outline" onClick={() => setCursor(result.next!)}>
                  Next 50 entries
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
