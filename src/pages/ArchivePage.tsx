import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { useState, type FormEvent } from 'react';
import { api } from '../api';

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

function activityDetail(entry: { listName: string; amount: number | null; unit: string }) {
  return entry.amount === null ? entry.listName : `${entry.listName} · ${entry.amount} ${entry.unit}`;
}

export function ArchivePage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const data = overview.data;

  function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  const today = new Date();
  const dayNumber = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(today);
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(today).toUpperCase();
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today).toUpperCase();
  const totalRecords = data?.lists.reduce((total, list) => total + list.itemCount + list.logCount, 0) ?? 0;

  return (
    <main className="archive-page">
      <h1 className="sr-only">Archive</h1>
      {overview.isPending ? (
        <div className="page-width loading-line">Opening your archive…</div>
      ) : overview.isError ? (
        <div className="page-width error-banner">
          Couldn't load your archive. <button onClick={() => void overview.refetch()}>Try again</button>
        </div>
      ) : !data?.lists.length ? (
        <EmptyArchive />
      ) : (
        <section className="archive-dashboard page-width">
          <header className="archive-dashboard-head">
            <div className="archive-day" aria-label={`${weekday}, ${month} ${dayNumber}`}>
              <strong>{dayNumber}</strong>
              <span>
                {month}
                <br />
                {weekday}
              </span>
            </div>
            <form className="archive-search" onSubmit={search} role="search">
              <MagnifyingGlass size={18} />
              <input
                aria-label="Find something you logged"
                placeholder="Search your records"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
          </header>
          <div className="archive-workspace">
            <section className="archive-activity" aria-labelledby="recent-heading">
              <header className="workspace-head">
                <p id="recent-heading">Recent</p>
                <Link to="/search">
                  View all <ArrowRight size={15} />
                </Link>
              </header>
              {data.recent.length ? (
                <ol className="activity-rail">
                  {data.recent.slice(0, 8).map((entry) => (
                    <li key={entry.id}>
                      <span className="activity-marker" aria-hidden="true" />
                      <time dateTime={entry.happenedOn}>{dateLabel(entry.happenedOn).toUpperCase()}</time>
                      <Link to={`/lists/${entry.listId}`}>
                        <strong>{entry.title}</strong>
                        <span>{activityDetail(entry)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="workspace-empty">Log something and it will appear here.</div>
              )}
            </section>
            <aside className="archive-shortlist" aria-labelledby="shortlist-heading">
              <header className="workspace-head">
                <p id="shortlist-heading">Your shortlist</p>
                <Link to="/lists">
                  Lists <ArrowRight size={15} />
                </Link>
              </header>
              {data.topPicks.length ? (
                <ol className="shortlist-items">
                  {data.topPicks.map((pick) => (
                    <li key={pick.itemId}>
                      <span>{String(pick.rank).padStart(2, '0')}</span>
                      <Link to={`/lists/${pick.listId}?focus=item:${pick.itemId}`}>
                        <strong>{pick.title}</strong>
                        <small>
                          {pick.listName}
                          {pick.type ? ` · ${pick.type}` : ''}
                        </small>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="workspace-empty">Rank a collection to keep its first pick close.</div>
              )}
            </aside>
          </div>
          <footer className="archive-totals" aria-label="Archive totals">
            <div>
              <span>Records</span>
              <strong>{totalRecords}</strong>
            </div>
            <div>
              <span>Lists</span>
              <strong>{data.lists.length}</strong>
            </div>
            <div>
              <span>Last record</span>
              <strong>{data.recent[0] ? dateLabel(data.recent[0].happenedOn).toUpperCase() : '—'}</strong>
            </div>
          </footer>
        </section>
      )}
    </main>
  );
}

function EmptyArchive() {
  return (
    <section className="empty-archive page-width">
      <div className="empty-index">NO. 001</div>
      <div>
        <h2>Start with one thing.</h2>
        <p>
          Make a list for anything you want to find, revisit, or avoid next time. Add the first record when it
          comes to mind.
        </p>
        <Link className="button button-accent" to="/lists?create=1">
          Create your first list <ArrowRight size={18} />
        </Link>
      </div>
      <div className="empty-kinds">
        <span>DRINKS</span>
        <span>PLACES</span>
        <span>MOVIES</span>
        <span>RUNS</span>
        <span>WHATEVER ELSE</span>
      </div>
    </section>
  );
}
