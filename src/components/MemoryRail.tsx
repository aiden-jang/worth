import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ArchiveFrame, ListSummary } from '../shared/models';

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${value}T00:00:00Z`))
    .toUpperCase();

export function MemoryRail({ frames, lists }: { frames: ArchiveFrame[]; lists: ListSummary[] }) {
  const [listId, setListId] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleFrames = useMemo(
    () => frames.filter((frame) => listId === 'all' || frame.listId === listId),
    [frames, listId],
  );
  const selectedFrame = visibleFrames.find((frame) => frame.id === selectedId) ?? visibleFrames[0];

  return (
    <section className="memory-rail page-width" aria-label="Recent records">
      <header className="memory-rail-head">
        <p className="overline">RECENT</p>
        {lists.length > 1 && (
          <label className="memory-filter">
            <span className="sr-only">Filter recent records by list</span>
            <select value={listId} onChange={(event) => setListId(event.target.value)}>
              <option value="all">All lists</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {visibleFrames.length ? (
        <div className="memory-frames" data-count={visibleFrames.length}>
          {visibleFrames.map((frame) => {
            const selected = frame.id === selectedFrame?.id;
            return (
              <Link
                aria-current={selected ? 'true' : undefined}
                className={`memory-frame${selected ? ' selected' : ''}`}
                key={frame.id}
                onFocus={() => setSelectedId(frame.id)}
                onMouseEnter={() => setSelectedId(frame.id)}
                to={`/lists/${frame.listId}?focus=${frame.recordKind}:${frame.id}`}
              >
                <span className="memory-frame-media">
                  {frame.photo ? (
                    <img
                      alt={frame.title}
                      loading={selected ? 'eager' : 'lazy'}
                      src={`/api/${frame.photo.kind}/${frame.photo.id}/photo?v=${frame.photo.version}`}
                    />
                  ) : (
                    <span aria-hidden="true" className="memory-frame-blank">
                      {frame.title.slice(0, 1)}
                    </span>
                  )}
                </span>
                <span className="memory-frame-caption">
                  <span>{frame.listName}</span>
                  <strong>{frame.title}</strong>
                  <time dateTime={frame.happenedOn}>{dateLabel(frame.happenedOn)}</time>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="memory-rail-empty">
          <p>Nothing logged in this list yet.</p>
          <Link to={`/lists/${listId}`}>Add a record</Link>
        </div>
      )}
    </section>
  );
}
