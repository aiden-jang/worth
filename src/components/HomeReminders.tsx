import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Shuffle } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { api } from '../api';
import { memorySourceHref, memoryPhotoHref } from '../shared/memories';
import { loadHomeReminder, type HomeReminder } from '../shared/home-reminders';
import { formatDate, today } from '../format';
import { decisionLabel } from '../shared/decisions';
import { CallFace } from './PersonalCall';
import { BlankSlips } from './BlankSlips';
import { TryReview } from './TryReview';

export function HomeReminders() {
  const [draw, setDraw] = useState(() => ({ seed: Math.random(), category: Math.random(), sequence: 0 }));
  const selected = useRef<{ sequence: number; reminder: HomeReminder | null } | null>(null);
  const query = useQuery({
    queryKey: ['patterns', 'home-reminders', draw],
    queryFn: async ({ signal }) => {
      const reminder = await loadHomeReminder(
        (filter) => api.memories(filter, signal),
        today(),
        draw.seed,
        selected.current?.reminder ?? null,
        selected.current?.sequence === draw.sequence,
        draw.category,
      );
      signal.throwIfAborted();
      selected.current = { sequence: draw.sequence, reminder };
      return reminder;
    },
    placeholderData: (previous) => previous,
    retry: false,
  });
  const reminder = query.data;
  if (!reminder || query.isError)
    return (
      <section className="home-favorites" aria-label="Your reminders">
        <div className="home-favorites-copy">
          <p className="overline">A LITTLE LOOK BACK</p>
          <h2>
            {query.isPending
              ? 'A little rummage…'
              : query.isError
                ? 'Reminders couldn’t load.'
                : 'Something to come back to.'}
          </h2>
          {query.isPending ? (
            <p role="status">Looking through your saved items…</p>
          ) : query.isError ? (
            <button type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          ) : (
            <>
              <p>Favorites, things to try, and recent experiences will turn up here.</p>
              <Link to="/lists">
                Browse collections <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>
        <BlankSlips />
      </section>
    );
  const { kind, record } = reminder;
  const title =
    kind === 'favorite'
      ? 'REMEMBER THIS ONE?'
      : kind === 'want'
        ? 'STILL ON YOUR LIST'
        : 'FRESH IN THE ARCHIVE';
  return (
    <section className="home-favorites" aria-label="Your reminders" aria-busy={query.isFetching}>
      <div className="home-favorites-copy">
        <p className="overline">{title}</p>
        <Link to={memorySourceHref(record)} className="home-favorite-name">
          {record.title} <ArrowRight size={19} />
        </Link>
        <p>
          {kind === 'favorite'
            ? 'You liked it. Still on record.'
            : kind === 'want'
              ? 'Still awaiting its big moment.'
              : record.reaction
                ? `Your call this time: ${decisionLabel(record.reaction)}.`
                : 'You tried it. The verdict is still yours.'}
        </p>
        <small>
          {record.listName} ·{' '}
          {kind === 'favorite' ? 'Favorite' : kind === 'want' ? 'Want to try' : formatDate(record.date)}
        </small>
        {kind === 'want' && (
          <TryReview
            key={`${record.kind}:${record.id}`}
            target={{
              kind: record.kind === 'unfiled' ? 'inbox' : 'item',
              id: record.itemId ?? record.id,
              title: record.title,
            }}
            disabled={query.isFetching}
          />
        )}
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() =>
            setDraw((previous) => ({
              seed: Math.random(),
              category: Math.random(),
              sequence: previous.sequence + 1,
            }))
          }
        >
          <Shuffle size={17} />
          {query.isFetching ? 'Looking…' : 'Show another'}
        </button>
      </div>
      {record.hasPhoto ? (
        <img src={memoryPhotoHref(record)} alt={`Saved photo for ${record.title}`} />
      ) : kind !== 'want' && record.reaction ? (
        <CallFace value={record.reaction} arms />
      ) : (
        <BlankSlips />
      )}
    </section>
  );
}
