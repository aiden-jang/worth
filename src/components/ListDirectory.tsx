import { ArrowRight, ImageSquare, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { CoverCrop } from './CoverCrop';
import { Link } from 'react-router';
import { api } from '../api';
import { formatRelativeTimestamp } from '../format';
import type { ListSummary } from '../shared/models';
import { preparePhoto } from '../shared/photos';
import { starterCollectionCover } from '../shared/starter-covers';
import { CollectionArtwork } from './CollectionArtwork';

export type CollectionOrder = 'recent' | 'name' | 'items' | 'ranked' | 'favorites';

export function CollectionDirectoryControls({
  order,
  onOrderChange,
  query,
  onQueryChange,
}: {
  order: CollectionOrder;
  onOrderChange: (order: CollectionOrder) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const search = useRef<HTMLInputElement>(null);
  return (
    <div className="collection-directory-controls">
      <div className="collection-directory-search">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="collection-directory-search">
          Find a collection
        </label>
        <input
          ref={search}
          id="collection-directory-search"
          type="search"
          placeholder="Search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear collection search"
            onClick={() => {
              onQueryChange('');
              search.current?.focus();
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <label className="collection-directory-order">
        <span className="sr-only">Order collections</span>
        <select value={order} onChange={(event) => onOrderChange(event.target.value as CollectionOrder)}>
          <option value="recent">Latest updates</option>
          <option value="name">Name</option>
          <option value="items">Most kept</option>
          <option value="ranked">Most ranked</option>
          <option value="favorites">Most favorites</option>
        </select>
      </label>
    </div>
  );
}

export function ListDirectory({
  heading,
  lists,
  isCollectionDirectory = false,
  workoutShortcut = false,
  showHeading = true,
  onCollectionQueryChange,
}: {
  heading: string;
  lists: ListSummary[];
  isCollectionDirectory?: boolean;
  workoutShortcut?: boolean;
  showHeading?: boolean;
  onCollectionQueryChange?: (query: string) => void;
}) {
  const headingId = useId();
  return (
    <section
      className="list-directory"
      aria-labelledby={showHeading ? headingId : undefined}
      aria-label={showHeading ? undefined : heading}
    >
      {showHeading && (
        <header className="directory-section-head">
          <h2 id={headingId}>{heading}</h2>
          <span>{lists.length}</span>
        </header>
      )}
      {isCollectionDirectory ? (
        lists.length ? (
          <div className="collection-directory-grid">
            {lists.map((list) => {
              const cover = list.hasCoverPhoto
                ? `/api/lists/${list.id}/cover?v=${list.coverRevision ?? list.updatedAt}`
                : starterCollectionCover(list.name, list.artwork);
              return (
                <div className="collection-directory-entry" key={list.id}>
                  <Link to={`/lists/${list.id}`} className="collection-directory-card">
                    <div className="directory-artwork">
                      <CollectionArtwork name={list.name} cover={cover} />
                    </div>
                    <span className="collection-directory-copy">
                      <strong>{list.name}</strong>
                      {list.description && <span className="directory-description">{list.description}</span>}
                      <small className="collection-directory-signals">
                        {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                        {list.rankedCount > 0 && ` · ${list.rankedCount} ranked`}
                        {list.favoriteCount > 0 &&
                          ` · ${list.favoriteCount} ${list.favoriteCount === 1 ? 'favorite' : 'favorites'}`}
                      </small>
                      <small className="collection-directory-updated">
                        Updated {formatRelativeTimestamp(list.updatedAt)}
                      </small>
                    </span>
                    <ArrowRight size={20} aria-hidden="true" />
                  </Link>
                  {!cover && <CollectionCoverAction list={list} />}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="collection-directory-empty">
            <p>No collections match that name.</p>
            {onCollectionQueryChange && (
              <button className="button button-outline" onClick={() => onCollectionQueryChange('')}>
                Clear search
              </button>
            )}
          </div>
        )
      ) : (
        <div className="activity-directory-grid">
          {lists.map((list) => (
            <Link
              to={`/lists/${list.id}${workoutShortcut && list.kind === 'activity' ? '?newWorkout=1' : ''}`}
              className="directory-row"
              key={list.id}
            >
              <span className="directory-index" aria-hidden="true">
                {Array.from(list.name.trim())[0] || '·'}
              </span>
              <span className="directory-name">
                <strong>{list.name}</strong>
                {list.description && <span className="directory-description">{list.description}</span>}
                <small>
                  {list.logCount} {list.logCount === 1 ? 'entry' : 'entries'} · Updated{' '}
                  {formatRelativeTimestamp(list.updatedAt)}
                </small>
              </span>
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionCoverAction({ list }: { list: ListSummary }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: async (file: File) =>
      api.uploadListCover(list.id, await preparePhoto(file), list.coverRevision ?? 0),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['list', list.id] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  return (
    <div className="collection-directory-cover-action">
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) setCropFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={upload.isPending}
        aria-label={`Add a private cover photo to ${list.name}`}
      >
        <ImageSquare size={15} />
        {upload.isPending ? 'Adding…' : 'Add cover'}
      </button>
      {cropFile && (
        <CoverCrop
          file={cropFile}
          onSave={(file) => upload.mutateAsync(file)}
          onClose={() => setCropFile(null)}
        />
      )}
      {upload.isError && <span role="alert">{upload.error.message}</span>}
    </div>
  );
}
