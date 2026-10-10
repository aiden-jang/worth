import { CallBadge, CallFace } from '../components/PersonalCall';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { api } from '../api';
import { formatElapsedDays, formatRelativeTimestamp } from '../format';
import { starterCollectionCover } from '../shared/starter-covers';
import { CollectionArtwork } from '../components/CollectionArtwork';

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));

function activityDetail(entry: {
  listName: string;
  recordKind: 'item' | 'log';
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
}) {
  if (entry.recordKind === 'item') return entry.listName;
  const metrics = [];
  if (entry.amount !== null) metrics.push(`${entry.amount}${entry.unit ? ` ${entry.unit}` : ''}`);
  if (entry.sets !== null && entry.reps !== null) metrics.push(`${entry.sets} × ${entry.reps}`);
  return metrics.length ? `${entry.listName} · ${metrics.join(' · ')}` : entry.listName;
}

export function ArchivePage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview });
  const data = overview.data;
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date())
    .toUpperCase();
  if (overview.isPending)
    return (
      <main className="page-width loading-line" role="status">
        Opening your archive…
      </main>
    );
  if (overview.isError)
    return (
      <main className="page-width error-banner" role="alert">
        Couldn't load your archive. <button onClick={() => void overview.refetch()}>Try again</button>
      </main>
    );
  if (!data?.lists.length)
    return (
      <main className="archive-page">
        <EmptyArchive />
      </main>
    );
  const collections = data.lists.filter((list) => list.kind === 'collection');
  const shelves = collections.length ? collections : data.lists;
  const pick = data.ranked[0];
  const last = data.lastTimes[0];
  return (
    <main className="cabinet-home page-width">
      <header className="cabinet-heading">
        <div>
          <p className="overline">{date}</p>
          <h1>The archive.</h1>
          <p>Good finds. Mixed feelings.</p>
        </div>
        <div className="cabinet-wink">
          <CallFace value="meh" />
          <span>
            Opinions may vary.
            <br />
            Yours, mostly.
          </span>
        </div>
      </header>
      <section aria-labelledby="cabinet-shelves-heading">
        <header className="cabinet-section-head">
          <h2 id="cabinet-shelves-heading">{collections.length ? 'Your collections' : 'Your activity'}</h2>
          <Link to={collections.length ? '/lists?kind=collection' : '/lists?kind=activity'}>
            View all <ArrowRight size={15} />
          </Link>
        </header>
        <ol className="cabinet-shelves">
          {shelves.slice(0, 6).map((list, index) => {
            const count = list.kind === 'collection' ? list.itemCount : list.logCount;
            const noun = list.kind === 'collection' ? 'item' : 'log';
            const cover = list.hasCoverPhoto
              ? `/api/lists/${list.id}/cover?v=${list.updatedAt}`
              : list.kind === 'collection'
                ? starterCollectionCover(list.name, list.artwork)
                : null;
            return (
              <li key={list.id}>
                <Link to={`/lists/${list.id}`} className="cabinet-folder">
                  <div className="cabinet-folder-picture">
                    <CollectionArtwork name={list.name} cover={cover} neutral={list.kind === 'activity'} />
                    <span className="cabinet-folder-number" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="cabinet-folder-copy">
                    <span>
                      <strong>{list.name}</strong>
                      <small>
                        {count} {count === 1 ? noun : `${noun}s`}
                        {list.kind === 'collection' && list.rankedCount
                          ? ` · ${list.rankedCount} ranked`
                          : ''}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="cabinet-home-lower">
        <section className="cabinet-recent" aria-labelledby="recent-heading">
          <header className="cabinet-section-head">
            <h2 id="recent-heading">Recently filed</h2>
            <Link to="/search">
              View all <ArrowRight size={15} />
            </Link>
          </header>
          {data.recent.length ? (
            <ol className="activity-rail">
              {data.recent.slice(0, 4).map((entry) => (
                <li key={entry.id}>
                  <time dateTime={entry.happenedOn ?? new Date(entry.recordedAt).toISOString()}>
                    {entry.happenedOn
                      ? dateLabel(entry.happenedOn).toUpperCase()
                      : formatRelativeTimestamp(entry.recordedAt)}
                  </time>
                  <Link
                    to={`/lists/${entry.listId}?focus=${entry.itemId ? `item:${entry.itemId}` : `log:${entry.id}`}`}
                  >
                    <strong>{entry.title}</strong>
                    <span>{activityDetail(entry)}</span>
                  </Link>
                  {entry.recordKind === 'item' && entry.decision && <CallBadge value={entry.decision} />}
                </li>
              ))}
            </ol>
          ) : (
            <p className="workspace-empty">Nothing filed yet. Add a name to get started.</p>
          )}
        </section>
        <aside>
          {pick ? (
            <Link className="cabinet-pick" to={`/lists/${pick.listId}?focus=item:${pick.itemId}`}>
              <p className="overline">TOP OF THE LIST</p>
              <div className="cabinet-pick-rank">
                <span>{String(pick.rank).padStart(2, '0')}</span>
                <small>Within {pick.listName} ↗</small>
              </div>
              <h3>{pick.title}</h3>
              <p>{pick.type ? `${pick.type} · ` : ''}Ranked by you</p>
            </Link>
          ) : (
            collections.length > 0 && (
              <Link className="cabinet-pick" to={`/lists/${collections[0].id}`}>
                <p className="overline">YOUR RANKING</p>
                <div className="cabinet-pick-rank">
                  <span>—</span>
                </div>
                <h3>Unranked. Unbothered.</h3>
                <p>Pick an item when something stands out.</p>
              </Link>
            )
          )}
          {last && (
            <Link className="cabinet-last-done" to={`/lists/${last.listId}?focus=log:${last.id}`}>
              <span>
                Last done · <strong>{last.title}</strong>
              </span>
              <span>
                {formatElapsedDays(last.happenedOn)} <ArrowRight size={12} />
              </span>
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}

function EmptyArchive() {
  return (
    <section className="cabinet-first-use page-width">
      <div className="cabinet-first-use-intro">
        <p className="overline">YOUR TASTE, ON RECORD</p>
        <h1>A clean slate. Suspicious.</h1>
        <p>Keep the things you try in a collection. A name is enough to get started.</p>
        <div className="empty-archive-actions">
          <Link className="button button-accent" to="/lists?create=1&kind=collection">
            Start a collection <ArrowRight size={18} />
          </Link>
          <Link className="button button-outline" to="/lists?create=1&kind=activity">
            Start an activity <ArrowRight size={18} />
          </Link>
        </div>
      </div>
      <div className="cabinet-first-look" aria-hidden="true">
        <p className="overline">ROOM FOR OPINIONS</p>
        <span>00</span>
        <CallFace value="meh" arms />
        <div className="cabinet-blank-rules" />
      </div>
      <div className="cabinet-first-use-footer">
        <p>Make room for your taste.</p>
        <span>Keep a name</span>
        <span>Make a call, if you want</span>
        <span>Find it again</span>
      </div>
    </section>
  );
}
