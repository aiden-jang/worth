import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDate, formatRelativeTimestamp } from '../format';
import { requestAddEntry } from '../shared/quick-entry';
import { starterCollectionCover } from '../shared/starter-covers';
import { CollectionArtwork } from '../components/CollectionArtwork';
import { CallBadge } from '../components/PersonalCall';
import { BlankSlips } from '../components/BlankSlips';
import { MemoryShelf } from '../components/MemoryShelf';

export function ArchivePage() {
  usePageTitle('Home');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  if (overview.isPending)
    return (
      <main className="page-width loading-line" role="status">
        Opening Worth…
      </main>
    );
  if (overview.isError)
    return (
      <main className="page-width error-banner" role="alert">
        Couldn't load your saved entries. <button onClick={() => void overview.refetch()}>Try again</button>
      </main>
    );
  const data = overview.data;
  if (!data) return null;
  const collections = data.lists.filter((list) => list.kind === 'collection');
  const activities = data.lists.filter((list) => list.kind === 'activity');
  const recent = [
    ...data.recent.map((entry) => ({
      id: `${entry.recordKind}:${entry.id}`,
      title: entry.title,
      detail: entry.listName,
      date: entry.happenedOn
        ? formatDate(entry.happenedOn)
        : `Updated ${formatRelativeTimestamp(entry.recordedAt)}`,
      time: entry.recordedAt,
      decision: entry.recordKind === 'item' ? entry.decision : null,
      href: `/lists/${entry.listId}?focus=${entry.recordKind === 'log' ? `log:${entry.id}` : `item:${entry.itemId ?? entry.id}`}`,
    })),
    ...(inbox.data?.entries ?? []).map((entry) => ({
      id: `inbox:${entry.id}`,
      title: entry.title,
      detail: 'Unfiled',
      date: `Saved ${formatRelativeTimestamp(entry.createdAt)}`,
      time: entry.createdAt,
      decision: entry.decision,
      href: `/inbox?focus=${entry.id}`,
    })),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 6);
  const hasMemories =
    !!inbox.data?.entries.length || data.lists.some((list) => list.itemCount > 0 || list.logCount > 0);
  return (
    <main className="page-width everyday-home">
      <header className="everyday-heading">
        <div>
          <h1>Good to keep.</h1>
          <p>A name is enough. The rest can wait.</p>
        </div>
      </header>
      <form
        className="home-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(`/search${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`);
        }}
      >
        <MagnifyingGlass size={22} aria-hidden="true" />
        <label className="sr-only" htmlFor="home-search">
          Find a name, place or note
        </label>
        <input
          id="home-search"
          type="search"
          maxLength={40}
          placeholder="Find a name, place or note"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit" aria-label="Search saved entries">
          <ArrowRight size={21} />
        </button>
      </form>
      <div className="home-columns">
        <section aria-labelledby="home-recent-heading" className="home-recent">
          <header className="everyday-section-head">
            <h2 id="home-recent-heading">Recent</h2>
            <Link to="/search">
              View all <ArrowRight size={15} />
            </Link>
          </header>
          {inbox.isError && (
            <p className="form-error" role="alert">
              Unfiled entries couldn’t load. <button onClick={() => void inbox.refetch()}>Try again</button>
            </p>
          )}
          {recent.length ? (
            <ol className="home-recent-list">
              {recent.map((entry) => (
                <li key={entry.id}>
                  <Link to={entry.href}>
                    <div>
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.detail} · {entry.date}
                      </small>
                    </div>
                    {entry.decision ? (
                      <CallBadge value={entry.decision} />
                    ) : (
                      <ArrowRight size={17} aria-hidden="true" />
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="home-empty">
              <BlankSlips />
              <h2>Something to remember?</h2>
              <p>Save a name now. Pick a collection whenever you like.</p>
              <button className="button button-accent" onClick={() => requestAddEntry({ listId: 'inbox' })}>
                <Plus size={18} /> Save your first thing
              </button>
            </div>
          )}
          {activities.length > 0 && (
            <section className="home-activities" aria-label="Your activity">
              <h2>Keep going</h2>
              {activities.slice(0, 3).map((list) => (
                <Link key={list.id} to={`/lists/${list.id}`}>
                  <div>
                    <strong>{list.name}</strong>
                    <small>Open your activity and progress</small>
                  </div>
                  <ArrowRight size={19} aria-hidden="true" />
                </Link>
              ))}
            </section>
          )}
        </section>
        <div className="home-browse">
          <section aria-labelledby="home-collections-heading">
            <header className="everyday-section-head">
              <h2 id="home-collections-heading">Collections</h2>
              <Link to="/lists">
                View all <ArrowRight size={15} />
              </Link>
            </header>
            {collections.length ? (
              <ol className="home-collection-grid">
                {collections.slice(0, 4).map((list) => {
                  const cover = list.hasCoverPhoto
                    ? `/api/lists/${list.id}/cover?v=${list.coverRevision ?? list.updatedAt}`
                    : starterCollectionCover(list.name, list.artwork);
                  return (
                    <li key={list.id}>
                      <Link to={`/lists/${list.id}`}>
                        <CollectionArtwork name={list.name} cover={cover} />
                        <strong>{list.name}</strong>
                        <small>{list.itemCount} saved</small>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="home-collection-invitation">
                Collections can wait.{' '}
                <Link to="/lists?create=1&kind=collection">Make one when you’re ready →</Link>
              </p>
            )}
            {(inbox.data?.entries.length ?? 0) > 0 && (
              <Link className="home-unfiled" to="/inbox">
                <span>
                  Unfiled <small>{inbox.data?.entries.length} saved</small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
            {!activities.length && (
              <Link className="home-activity-invitation" to="/lists?create=1&kind=activity">
                Track workouts or activity →
              </Link>
            )}
          </section>
          {hasMemories && <MemoryShelf />}
        </div>
      </div>
    </main>
  );
}
