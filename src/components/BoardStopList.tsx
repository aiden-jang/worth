import { useState } from 'react';
import { Link } from 'react-router';
import { boardReferenceKey, type BoardSource, type BoardStop } from '../shared/memory-boards';
export function BoardStopList({ entries, sources }: { entries: BoardStop[]; sources: BoardSource[] }) {
  const byId = new Map(sources.map((source) => [boardReferenceKey(source), source]));
  return (
    <ol className="board-stop-list" aria-label="Entries in saved order">
      {entries.map((entry, index) => (
        <BoardStopCard
          key={entry.id}
          entry={entry}
          number={index + 1}
          source={entry.reference ? byId.get(boardReferenceKey(entry.reference)) : undefined}
        />
      ))}
    </ol>
  );
}
function BoardStopCard({
  entry,
  number,
  source,
}: {
  entry: BoardStop;
  number: number;
  source?: BoardSource;
}) {
  const [failed, setFailed] = useState(''),
    [retry, setRetry] = useState(0);
  const image =
    entry.photo && source?.hasPhoto
      ? `/api/${source.kind === 'item' ? 'items' : 'logs'}/${source.id}/photo?v=${source.updatedAt}&retry=${retry}`
      : '';
  return (
    <li className="board-stop-card">
      <p className="overline">{String(number).padStart(2, '0')}</p>
      <h3>{entry.name}</h3>
      {(entry.day || entry.time || entry.location) && (
        <dl>
          {(entry.day || entry.time) && (
            <div>
              <dt>Date and time</dt>
              <dd>
                {entry.day || 'Date not entered'}
                {entry.time ? ` · ${entry.time}` : ''}
              </dd>
            </div>
          )}
          {entry.location && (
            <div>
              <dt>Location</dt>
              <dd>{entry.location}</dd>
            </div>
          )}
        </dl>
      )}
      {image && image !== failed && (
        <img
          loading="lazy"
          decoding="async"
          src={image}
          alt={`Current saved cover for ${source!.title}`}
          onError={() => setFailed(image)}
        />
      )}
      {image && image === failed && (
        <p role="alert">
          The cover could not be displayed. Your entry’s text is still here.
          <button
            className="button button-outline"
            onClick={() => {
              setRetry((value) => value + 1);
              setFailed('');
            }}
          >
            Retry cover for {entry.name}
          </button>
        </p>
      )}
      {entry.photo && !image && (
        <p className="board-stop-unavailable">No saved cover is available for this entry.</p>
      )}
      {entry.note && <p className="board-stop-note">{entry.note}</p>}
      {source ? (
        <p className="board-stop-source">
          <Link to={`/lists/${source.listId}?focus=${source.kind}:${source.currentId}`}>
            Open linked {source.kind === 'log' ? 'visit' : 'record'}: {source.title} →
          </Link>
          {source.archived && <span>Archived collection</span>}
        </p>
      ) : (
        (entry.reference || entry.referenceMissing) && (
          <p className="board-stop-unavailable">
            Linked record unavailable. Your entered name, date, location and note are kept.
          </p>
        )
      )}
    </li>
  );
}
