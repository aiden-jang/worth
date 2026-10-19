import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { boardReferenceKey, type BoardView } from '../shared/memory-boards';
export function BoardReplay({ board }: { board: BoardView }) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [failed, setFailed] = useState(''),
    [retry, setRetry] = useState(0);
  const count = board.entries.length,
    position = Math.max(0, Math.min(index, count - 1)),
    entry = board.entries[position];
  const sources = new Map(board.sources.map((source) => [boardReferenceKey(source), source]));
  const source = entry?.reference ? sources.get(boardReferenceKey(entry.reference)) : undefined;
  const imageBase =
    entry?.photo && source?.hasPhoto
      ? `/api/${source.kind === 'item' ? 'items' : 'logs'}/${source.id}/photo?v=${source.updatedAt}`
      : '';
  const image = imageBase ? `${imageBase}&retry=${retry}` : '';
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (position + 1 >= count) setPlaying(false);
      else {
        setIndex(position + 1);
        if (position + 2 >= count) setPlaying(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [playing, position, count]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  if (!entry)
    return (
      <section className="board-replay" aria-label="Trip replay">
        <h2>Your stop order</h2>
        <p>Add stops to this trip board before replaying it.</p>
      </section>
    );
  return (
    <section className="board-replay" aria-labelledby="board-replay-heading">
      <div className="board-section-heading">
        <div>
          <p className="overline">YOUR SAVED STOP ORDER</p>
          <h2 id="board-replay-heading">Trip replay</h2>
        </div>
        <p role="status">
          Stop {position + 1} of {count}: {entry.name}
        </p>
      </div>
      <p>
        Follow the stops you entered. Their order and dates do not log visits or infer geography, travel time
        or completion.
      </p>
      <div className="board-replay-controls">
        <button
          className="button button-outline"
          disabled={position === 0}
          onClick={() => {
            setPlaying(false);
            setIndex(position - 1);
          }}
        >
          Previous stop
        </button>
        <button
          className="button button-outline"
          disabled={position >= count - 1}
          onClick={() => {
            setPlaying(false);
            setIndex(position + 1);
          }}
        >
          Next stop
        </button>
        <button
          className="button button-outline"
          disabled={count < 2}
          aria-pressed={playing}
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              if (position >= count - 1) setIndex(0);
              setPlaying(true);
            }
          }}
        >
          {playing ? 'Stop replay' : 'Play stops'}
        </button>
      </div>
      <p className="muted">
        Play advances once through the saved order, five seconds per stop. Stop, Previous and Next remain
        available.
      </p>
      <article
        className="board-replay-ticket"
        key={entry.id}
        aria-label={`Stop ${position + 1}: ${entry.name}`}
      >
        <p className="overline">
          STOP {position + 1} / {count}
        </p>
        <h3>{entry.name}</h3>
        <dl>
          <div>
            <dt>Date</dt>
            <dd>
              {entry.day || 'Not entered'}
              {entry.time ? ` · ${entry.time}` : ''}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{entry.location || 'Not entered'}</dd>
          </div>
        </dl>
        {image && failed !== image && (
          <img
            src={image}
            alt={`Current saved cover for ${source!.title}`}
            onError={() => setFailed(image)}
          />
        )}
        {image && failed === image && (
          <p role="alert">
            The cover could not be displayed. The stop’s text remains available.
            <button
              className="button button-outline"
              onClick={() => {
                setRetry((value) => value + 1);
                setFailed('');
              }}
            >
              Retry stop cover
            </button>
          </p>
        )}
        {entry.photo && !image && (
          <p className="board-stop-unavailable">No saved cover is available for this stop.</p>
        )}
        {entry.note && <p className="board-stop-note">{entry.note}</p>}
        {source ? (
          <Link to={`/lists/${source.listId}?focus=${source.kind}:${source.currentId}`}>
            Open linked {source.kind === 'log' ? 'visit' : 'record'}: {source.title}
            {source.archived ? ' · Archived' : ''} →
          </Link>
        ) : (
          (entry.reference || entry.referenceMissing) && (
            <p>Linked record unavailable. Your entered name, date, location and note are kept.</p>
          )
        )}
      </article>
      <details className="board-replay-index">
        <summary>All {count} stops in saved order</summary>
        <ol>
          {board.entries.map((stop, i) => (
            <li key={stop.id}>
              <button
                className="button button-outline"
                aria-current={i === position ? 'step' : undefined}
                onClick={() => {
                  setPlaying(false);
                  setIndex(i);
                }}
              >
                Stop {i + 1} · {stop.name}
                {stop.day ? ` · ${stop.day}` : ''}
                {stop.location ? ` · ${stop.location}` : ''}
              </button>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
