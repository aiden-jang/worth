import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { useState, type FormEvent } from 'react';
import { api } from '../api';

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

export function ArchivePage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const data = overview.data;

  function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <main className="archive-page">
      <section className="archive-intro page-width">
        <div>
          <p className="overline">
            {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
              .format(new Date())
              .toUpperCase()}
          </p>
          <h1>
            Lately<span>.</span>
          </h1>
        </div>
        <form className="archive-search" onSubmit={search} role="search">
          <MagnifyingGlass size={22} />
          <input
            aria-label="Find something you logged"
            placeholder="Find something you logged"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
      </section>

      {overview.isPending ? (
        <div className="page-width loading-line">Opening your archive…</div>
      ) : overview.isError ? (
        <div className="page-width error-banner">
          Couldn't load your archive. <button onClick={() => void overview.refetch()}>Try again</button>
        </div>
      ) : !data?.lists.length ? (
        <EmptyArchive />
      ) : (
        <>
          <section className="archive-grid page-width" aria-label="Your archive at a glance">
            <div className="archive-feature">
              {data.highlight ? (
                <Link to={`/lists/${data.highlight.listId}`} className="feature-photo">
                  <img src={`/api/items/${data.highlight.id}/photo`} alt={data.highlight.title} />
                  <span className="feature-caption">
                    <small>FROM YOUR ARCHIVE</small>
                    <strong>{data.highlight.title}</strong>
                    <em>
                      {data.highlight.startedOn
                        ? `Since ${dateLabel(data.highlight.startedOn)}`
                        : 'From your collection'}
                    </em>
                  </span>
                </Link>
              ) : (
                <div className="archive-still">
                  <span className="overline">PRIVATE ARCHIVE</span>
                  <p>
                    Keep the good
                    <br />
                    parts close.
                  </p>
                  <span className="still-mark">w.</span>
                </div>
              )}
            </div>
            <div className="archive-column">
              <h2>Recent</h2>
              {data.recent.length ? (
                data.recent.slice(0, 4).map((entry) => (
                  <Link className="archive-row" key={entry.id} to={`/lists/${entry.listId}`}>
                    <span className="archive-date">{dateLabel(entry.happenedOn).toUpperCase()}</span>
                    <span className="archive-row-title">
                      {entry.amount !== null ? `${entry.amount} ${entry.unit} ` : ''}
                      {entry.title}
                    </span>
                    <ArrowRight size={18} />
                  </Link>
                ))
              ) : (
                <div className="archive-empty-copy">
                  Nothing logged yet. Your lists are ready when you are.
                </div>
              )}
            </div>
            <div className="archive-column">
              <h2>Last time</h2>
              {data.lastTimes.length ? (
                data.lastTimes.map((entry) => (
                  <Link
                    className="archive-row"
                    key={entry.title}
                    to={`/search?q=${encodeURIComponent(entry.title)}`}
                  >
                    <span className="archive-row-title">{entry.title}</span>
                    <span className="archive-date">{dateLabel(entry.happenedOn).toUpperCase()}</span>
                    <ArrowRight size={18} />
                  </Link>
                ))
              ) : (
                <div className="archive-empty-copy">
                  Log a recurring activity, like a haircut or a run, to see it here.
                </div>
              )}
            </div>
          </section>
          <section className="archive-shortcuts page-width" aria-label="Your lists">
            {data.lists.slice(0, 4).map((list) => (
              <Link key={list.id} to={`/lists/${list.id}`}>
                <strong>{list.name}</strong>
                <span>{list.kind === 'collection' ? list.itemCount : list.logCount}</span>
                <ArrowRight size={17} />
              </Link>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function EmptyArchive() {
  return (
    <section className="empty-archive page-width">
      <div className="empty-index">NO. 001</div>
      <div>
        <h2>
          Start with what
          <br />
          comes to mind.
        </h2>
        <p>
          A drink you would order again. The last film you loved. A run you want to remember. Make a list,
          then add the first thing.
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
