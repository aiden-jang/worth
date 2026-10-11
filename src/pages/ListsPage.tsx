import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ImageSquare, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import type { ListKind, ListSummary } from '../shared/models';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CollectionArtworkPicker } from '../components/CollectionArtworkPicker';
import type { CollectionArt } from '../shared/models';
import { starterCollectionCover } from '../shared/starter-covers';
import { preparePhoto } from '../shared/photos';
import { formatRelativeTimestamp } from '../format';
import { CollectionArtwork } from '../components/CollectionArtwork';

type CollectionOrder = 'recent' | 'name' | 'items' | 'ranked' | 'favorites';

const collectionOrderStorageKey = 'worth:collection-order';

function savedCollectionOrder(): CollectionOrder {
  if (typeof window === 'undefined') return 'recent';
  const value = window.localStorage.getItem(collectionOrderStorageKey);
  return value === 'name' ||
    value === 'items' ||
    value === 'ranked' ||
    value === 'favorites' ||
    value === 'recent'
    ? value
    : 'recent';
}

const suggestions: { name: string; kind: ListKind; description: string; cover?: string }[] = [
  {
    name: 'Drinks',
    kind: 'collection',
    description: 'Wines, whiskeys, and the occasional good idea.',
    cover: '/art/starter-covers/drinks-v2.svg',
  },
  {
    name: 'Movies',
    kind: 'collection',
    description: 'The ones you would watch again.',
    cover: '/art/starter-covers/movies-v2.svg',
  },
  {
    name: 'Places',
    kind: 'collection',
    description: 'Restaurants and stops worth remembering.',
    cover: '/art/starter-covers/places-v2.svg',
  },
  {
    name: 'Cars',
    kind: 'collection',
    description: 'The ones you owned, drove, or loved.',
    cover: '/art/starter-covers/cars-v2.svg',
  },
  { name: 'Books', kind: 'collection', description: 'The ones worth lending out.' },
  { name: 'Music', kind: 'collection', description: 'Albums and songs you keep returning to.' },
  { name: 'Games', kind: 'collection', description: 'The ones that stayed with you.' },
  { name: 'Gym', kind: 'activity', description: 'Exercises, sets, reps, and weight.' },
  { name: 'Runs', kind: 'activity', description: 'Distance, pace, and when you went.' },
  { name: 'Upkeep', kind: 'activity', description: 'Haircuts, nails, and other little resets.' },
];

export function ListsPage() {
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const creating = params.get('create') === '1';
  const requestedKind = params.get('kind');
  const listScope: ListKind | null =
    requestedKind === 'collection' || requestedKind === 'activity' ? requestedKind : null;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ListKind>(requestedKind === 'activity' ? 'activity' : 'collection');
  const [description, setDescription] = useState('');
  const [artwork, setArtwork] = useState<CollectionArt | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const coverInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [collectionOrder, setCollectionOrder] = useState<CollectionOrder>(savedCollectionOrder);
  const [collectionQuery, setCollectionQuery] = useState('');
  const collectionLists = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const activityLists = lists.data?.lists.filter((list) => list.kind === 'activity') ?? [];
  const visibleCollectionLists = listScope === 'activity' ? [] : collectionLists;
  const visibleActivityLists = listScope === 'collection' ? [] : activityLists;
  const matchingCollectionLists = visibleCollectionLists.filter((list) => {
    const query = collectionQuery.trim().toLocaleLowerCase();
    return !query || `${list.name} ${list.description}`.toLocaleLowerCase().includes(query);
  });
  const orderedCollectionLists = [...matchingCollectionLists].sort((left, right) => {
    if (collectionOrder === 'name') return left.name.localeCompare(right.name);
    if (collectionOrder === 'items')
      return right.itemCount - left.itemCount || right.updatedAt - left.updatedAt;
    if (collectionOrder === 'ranked')
      return (
        right.rankedCount - left.rankedCount ||
        right.favoriteCount - left.favoriteCount ||
        right.updatedAt - left.updatedAt
      );
    if (collectionOrder === 'favorites')
      return (
        right.favoriteCount - left.favoriteCount ||
        right.rankedCount - left.rankedCount ||
        right.updatedAt - left.updatedAt
      );
    return right.updatedAt - left.updatedAt;
  });
  const pageTitle =
    listScope === 'collection' ? 'Collections' : listScope === 'activity' ? 'Activity' : 'Lists';
  const pageDescription =
    listScope === 'collection'
      ? 'The good, the meh, and the “not again.”'
      : listScope === 'activity'
        ? 'Record what happened and when.'
        : 'Your collections and activity logs.';
  const create = useMutation({
    mutationFn: async (input: {
      name: string;
      kind: ListKind;
      description: string;
      coverFile: File | null;
      artwork: CollectionArt | null;
    }) => {
      const created = await api.createList(input);
      if (!input.coverFile || input.kind !== 'collection') return { ...created, coverError: '' };
      try {
        await api.uploadListCover(created.list.id, await preparePhoto(input.coverFile));
        return { ...created, coverError: '' };
      } catch (error) {
        return {
          ...created,
          coverError:
            error instanceof Error
              ? error.message
              : 'The collection was saved, but its cover could not upload.',
        };
      }
    },
    onSuccess: ({ list, coverError }) => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      navigate(`/lists/${list.id}${list.kind === 'collection' ? '?capture=1' : ''}`, {
        state: coverError ? { coverError } : undefined,
      });
    },
  });

  useEffect(() => {
    if (requestedKind === 'collection' || requestedKind === 'activity') setKind(requestedKind);
  }, [requestedKind]);

  useEffect(() => {
    window.localStorage.setItem(collectionOrderStorageKey, collectionOrder);
  }, [collectionOrder]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview('');
      return;
    }
    const preview = URL.createObjectURL(coverFile);
    setCoverPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [coverFile]);

  function chooseSuggestion(suggestion: (typeof suggestions)[number]) {
    setName(suggestion.name);
    setKind(suggestion.kind);
    setDescription('');
    setCoverFile(null);
    setParams({ create: '1', kind: suggestion.kind });
  }

  function openCreate() {
    setParams(listScope ? { create: '1', kind: listScope } : { create: '1' });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      kind,
      description: description.trim(),
      coverFile,
      artwork: kind === 'collection' ? artwork : null,
    });
  }

  function requestCloseCreate() {
    if (name.trim() || description.trim() || coverFile || artwork) {
      setConfirmingDiscard(true);
      return;
    }
    setParams(listScope ? { kind: listScope } : {});
  }

  function discardDraft() {
    setName('');
    setArtwork(null);
    setDescription('');
    setCoverFile(null);
    setKind(requestedKind === 'activity' ? 'activity' : 'collection');
    setConfirmingDiscard(false);
    setParams(listScope ? { kind: listScope } : {});
  }

  return (
    <main className="light-page lists-page page-width">
      <div className="page-head">
        <div>
          <p className="overline">YOUR ARCHIVE</p>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
        {!creating && (
          <div className="list-page-actions">
            <button className="button button-accent" onClick={openCreate}>
              <Plus size={18} />{' '}
              {listScope === 'activity'
                ? 'New activity'
                : listScope === 'collection'
                  ? 'New collection'
                  : 'New list'}
            </button>
          </div>
        )}
      </div>

      {creating && (
        <section className="create-panel cabinet-create" aria-label="Create a list">
          <div className="panel-title">
            <div>
              <p className="overline">NEW {kind.toUpperCase()}</p>
              <h2>{kind === 'collection' ? 'What are you collecting?' : 'What are you keeping track of?'}</h2>
            </div>
            <button className="icon-button" aria-label="Close" onClick={requestCloseCreate}>
              <X size={20} />
            </button>
          </div>
          <div
            className={
              kind === 'collection'
                ? 'cabinet-create-layout'
                : 'cabinet-create-layout cabinet-create-activity'
            }
          >
            <form onSubmit={submit} className="create-form">
              <label>
                Name
                <input
                  ref={nameInput}
                  autoFocus
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Whiskey, movies, runs…"
                  required
                />
              </label>
              <div className="cabinet-name-ideas" role="group" aria-label="Name suggestions">
                <span>A few ideas</span>
                {(kind === 'collection' ? ['Drinks', 'Movies', 'Books'] : ['Gym', 'Runs', 'Upkeep']).map(
                  (idea) => (
                    <button
                      key={idea}
                      type="button"
                      disabled={create.isPending}
                      onClick={() => {
                        setName(idea);
                        nameInput.current?.focus();
                      }}
                    >
                      {idea}
                    </button>
                  ),
                )}
              </div>
              {!listScope && (
                <label>
                  Type
                  <select
                    value={kind}
                    onChange={(event) => {
                      const nextKind = event.target.value as ListKind;
                      setKind(nextKind);
                      if (nextKind === 'activity') setCoverFile(null);
                    }}
                  >
                    <option value="collection">Collection: things you can revisit and rank</option>
                    <option value="activity">Activity: things you log over time</option>
                  </select>
                </label>
              )}
              {kind === 'collection' && (
                <details className="create-artwork">
                  <summary>
                    Artwork <span className="optional">optional</span>
                  </summary>
                  <CollectionArtworkPicker name={name} value={artwork} onChange={setArtwork} />
                </details>
              )}
              <details className="create-extras form-wide">
                <summary>
                  {kind === 'collection' ? 'Description & cover' : 'Description'}{' '}
                  <span className="optional">optional</span>
                </summary>
                <label className="form-wide">
                  A short description <span className="optional">optional</span>
                  <input
                    value={description}
                    maxLength={280}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What belongs in this list?"
                  />
                </label>
                {kind === 'collection' && (
                  <div className="form-wide collection-cover-picker">
                    <label htmlFor="collection-cover-file">
                      Cover photo <span className="optional">optional · private</span>
                    </label>
                    <input
                      id="collection-cover-file"
                      ref={coverInput}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                    />
                    {coverPreview && (
                      <div className="collection-cover-preview">
                        <img src={coverPreview} alt="Selected collection cover preview" />
                        <div>
                          <strong>{coverFile?.name}</strong>
                          <button
                            type="button"
                            onClick={() => {
                              setCoverFile(null);
                              if (coverInput.current) coverInput.current.value = '';
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                    <small>
                      {coverFile ? coverFile.name : 'JPEG, PNG, or WebP. You can add one later, too.'}
                    </small>
                  </div>
                )}
              </details>
              {create.isError && <p className="form-error">{create.error.message}</p>}
              <button className="button button-accent" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : `Create ${kind}`} <ArrowRight size={18} />
              </button>
            </form>
            {kind === 'collection' && (
              <aside className="cabinet-create-preview" aria-label="Collection preview">
                <p className="overline">YOUR COLLECTION</p>
                <CollectionArtwork
                  name={name}
                  cover={coverPreview || starterCollectionCover(name, artwork)}
                />
                <h3>{name.trim() || 'Your collection'}</h3>
                <p>A name is enough. The rest can wait.</p>
              </aside>
            )}
          </div>
          {confirmingDiscard && (
            <ConfirmDialog
              eyebrow="DISCARD DRAFT"
              title="Leave this list draft?"
              description="The name, description, and cover you entered will be lost."
              cancelLabel="Keep editing"
              confirmLabel="Discard draft"
              onConfirm={discardDraft}
              onClose={() => setConfirmingDiscard(false)}
            />
          )}
        </section>
      )}

      {!creating &&
        (lists.isPending ? (
          <p className="loading-line" role="status">
            Loading your lists…
          </p>
        ) : lists.isError ? (
          <p className="error-banner" role="alert">
            Couldn't load your lists. <button onClick={() => void lists.refetch()}>Try again</button>
          </p>
        ) : lists.data?.lists.length && (visibleCollectionLists.length || visibleActivityLists.length) ? (
          <div className="list-groups">
            {visibleCollectionLists.length > 0 && (
              <ListDirectory
                heading="Collections"
                detail={listScope === 'collection' ? '' : 'Things you can compare, rank, and revisit.'}
                lists={orderedCollectionLists}
                isCollectionDirectory
                collectionOrder={collectionOrder}
                onCollectionOrderChange={setCollectionOrder}
                collectionQuery={collectionQuery}
                onCollectionQueryChange={setCollectionQuery}
              />
            )}
            {visibleActivityLists.length > 0 && (
              <ListDirectory
                heading="Activity"
                detail={listScope === 'activity' ? '' : 'Things you want to log over time.'}
                lists={visibleActivityLists}
              />
            )}
          </div>
        ) : (
          <EmptyListScope scope={listScope} onChoose={chooseSuggestion} />
        ))}
    </main>
  );
}

function EmptyListScope({
  scope,
  onChoose,
}: {
  scope: ListKind | null;
  onChoose: (suggestion: (typeof suggestions)[number]) => void;
}) {
  const scopedSuggestions = scope
    ? suggestions.filter((suggestion) => suggestion.kind === scope)
    : suggestions;
  return (
    <section className="list-suggestions">
      <p className="overline">
        {scope ? `NO ${scope === 'collection' ? 'COLLECTIONS' : 'ACTIVITIES'} YET` : 'A FEW PLACES TO START'}
      </p>
      <p className="starter-intro">
        {scope === 'activity' ? 'Pick a place to keep track.' : 'An empty archive. Enjoy it while it lasts.'}
      </p>
      <div>
        {scopedSuggestions.map((suggestion) => (
          <button
            className="starter-card cabinet-starter-card"
            key={suggestion.name}
            onClick={() => onChoose(suggestion)}
          >
            <div className="cabinet-directory-picture">
              <CollectionArtwork
                name={suggestion.name}
                cover={suggestion.cover}
                neutral={suggestion.kind === 'activity'}
              />
            </div>
            <span className="starter-card-copy">
              <strong>{suggestion.name}</strong>
              <small>{suggestion.kind}</small>
            </span>
            <Plus size={18} />
          </button>
        ))}
      </div>
    </section>
  );
}

function ListDirectory({
  heading,
  detail,
  lists,
  isCollectionDirectory = false,
  collectionOrder,
  onCollectionOrderChange,
  collectionQuery,
  onCollectionQueryChange,
}: {
  heading: string;
  detail: string;
  lists: ListSummary[];
  isCollectionDirectory?: boolean;
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
              <Link to={`/lists/${list.id}`} className="directory-row" key={list.id}>
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
