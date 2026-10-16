import { ArrowRight, ImageSquare, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { formatRelativeTimestamp } from '../format';
import type { ListSummary } from '../shared/models';
import { preparePhoto } from '../shared/photos';
import { starterCollectionCover } from '../shared/starter-covers';
import { CollectionArtwork } from './CollectionArtwork';

export type CollectionOrder = 'recent' | 'name' | 'items' | 'ranked' | 'favorites';

export function ListDirectory({
  heading,
  detail,
  lists,
  isCollectionDirectory = false,
  workoutShortcut = false,
  collectionOrder,
  onCollectionOrderChange,
  collectionQuery,
  onCollectionQueryChange,
}: {
  heading: string;
  detail: string;
  lists: ListSummary[];
  isCollectionDirectory?: boolean;
  workoutShortcut?: boolean;
  collectionOrder?: CollectionOrder;
  onCollectionOrderChange?: (order: CollectionOrder) => void;
  collectionQuery?: string;
  onCollectionQueryChange?: (query: string) => void;
}) {
  return (
    <section className="list-directory" aria-labelledby={`${heading.toLowerCase()}-heading`}>
      <header className="list-directory-head">
        <div>
          <p className="overline" id={`${heading.toLowerCase()}-heading`}>
            {heading}
          </p>
          <span>{detail}</span>
        </div>
        <div className="list-directory-summary">
          {isCollectionDirectory && collectionOrder && onCollectionOrderChange && onCollectionQueryChange && (
            <div className="collection-directory-controls">
              <div className="collection-directory-search">
                <MagnifyingGlass size={15} aria-hidden="true" />
                <label className="sr-only" htmlFor="collection-directory-search">
                  Find a collection
                </label>
                <input
                  id="collection-directory-search"
                  value={collectionQuery}
                  onChange={(event) => onCollectionQueryChange(event.target.value)}
                  placeholder="Find a collection"
                />
                {collectionQuery && (
                  <button
                    type="button"
                    aria-label="Clear collection search"
                    onClick={() => onCollectionQueryChange('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <label className="collection-directory-order">
                <span>Order</span>
                <select
                  aria-label="Order collections"
                  value={collectionOrder}
                  onChange={(event) => onCollectionOrderChange(event.target.value as CollectionOrder)}
                >
                  <option value="recent">Recently updated</option>
                  <option value="name">Name</option>
                  <option value="items">Most kept</option>
                  <option value="ranked">Most ranked</option>
                  <option value="favorites">Most favorites</option>
                </select>
              </label>
            </div>
          )}
          <strong>{lists.length}</strong>
        </div>
      </header>
      {isCollectionDirectory ? (
        lists.length ? (
          <div className="collection-directory-grid">
            {lists.map((list, index) => {
              const cover = list.hasCoverPhoto
                ? `/api/lists/${list.id}/cover?v=${list.updatedAt}`
                : starterCollectionCover(list.name, list.artwork);
              return (
                <div className="collection-directory-entry" key={list.id}>
                  <Link to={`/lists/${list.id}`} className="collection-directory-card cabinet-directory-card">
                    <div className="cabinet-directory-picture">
                      <CollectionArtwork name={list.name} cover={cover} />
                      <span className="collection-directory-index">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="collection-directory-copy">
                      <strong>{list.name}</strong>
                      <small>
                        <span>
                          {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                          {list.description ? ` · ${list.description}` : ''}
                        </span>
                        {(list.rankedCount > 0 || list.favoriteCount > 0) && (
                          <span className="collection-directory-signals">
                            {list.rankedCount > 0 && `${list.rankedCount} ranked`}
                            {list.rankedCount > 0 && list.favoriteCount > 0 && ' · '}
                            {list.favoriteCount > 0 &&
                              `${list.favoriteCount} ${list.favoriteCount === 1 ? 'favorite' : 'favorites'}`}
                          </span>
                        )}
                        <span className="collection-directory-updated">
                          Updated {formatRelativeTimestamp(list.updatedAt)}
                        </span>
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
              <button onClick={() => onCollectionQueryChange('')}>Clear search</button>
            )}
          </div>
        )
      ) : (
        <div>
          {lists.map((list, index) => {
            const count = list.logCount;
            return (
              <Link
                to={`/lists/${list.id}${workoutShortcut && list.kind === 'activity' ? '?newWorkout=1' : ''}`}
                className="directory-row"
                key={list.id}
              >
                <span className="directory-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="directory-name">
                  <strong>{list.name}</strong>
                  <small>{list.description || 'Activity'}</small>
                </span>
                <span className="directory-meta">
                  <small>
                    {list.kind} · updated {formatRelativeTimestamp(list.updatedAt)}
                  </small>
                  <strong>
                    {count} {count === 1 ? 'log' : 'logs'}
                  </strong>
                </span>
                <ArrowRight size={20} />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CollectionCoverAction({ list }: { list: ListSummary }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => api.uploadListCover(list.id, await preparePhoto(file)),
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
          if (file) upload.mutate(file);
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
      {upload.isError && <span role="alert">{upload.error.message}</span>}
    </div>
  );
}
