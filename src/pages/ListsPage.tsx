import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, DownloadSimple, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import type { ListKind, ListSummary } from '../shared/models';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { starterCollectionCover } from '../shared/starter-covers';

type CollectionOrder = 'recent' | 'name' | 'items';

const collectionOrderStorageKey = 'worth:collection-order';

function savedCollectionOrder(): CollectionOrder {
  if (typeof window === 'undefined') return 'recent';
  const value = window.localStorage.getItem(collectionOrderStorageKey);
  return value === 'name' || value === 'items' || value === 'recent' ? value : 'recent';
}

const suggestions: { name: string; kind: ListKind; description: string; cover?: string }[] = [
  {
    name: 'Drinks',
    kind: 'collection',
    description: 'Wines, whiskeys, and the occasional good idea.',
    cover: '/art/starter-covers/drinks-v1.webp',
  },
  {
    name: 'Movies',
    kind: 'collection',
    description: 'The ones you would watch again.',
    cover: '/art/starter-covers/movies-v1.webp',
  },
  {
    name: 'Places',
    kind: 'collection',
    description: 'Restaurants and stops worth remembering.',
    cover: '/art/starter-covers/places-v1.webp',
  },
  {
    name: 'Cars',
    kind: 'collection',
    description: 'The ones you owned, drove, or loved.',
    cover: '/art/starter-covers/cars-v1.webp',
  },
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
    return right.updatedAt - left.updatedAt;
  });
  const pageTitle =
    listScope === 'collection' ? 'Collections' : listScope === 'activity' ? 'Activity' : 'Lists';
  const pageDescription =
    listScope === 'collection'
      ? 'Things you want to remember, compare, and keep close.'
      : listScope === 'activity'
        ? 'A quiet record of what happened and when.'
        : 'Keep similar things together. Rank a collection, or just log what happened.';
  const create = useMutation({
    mutationFn: api.createList,
    onSuccess: ({ list }) => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      navigate(`/lists/${list.id}`);
    },
  });

  useEffect(() => {
    if (requestedKind === 'collection' || requestedKind === 'activity') setKind(requestedKind);
  }, [requestedKind]);

  useEffect(() => {
    window.localStorage.setItem(collectionOrderStorageKey, collectionOrder);
  }, [collectionOrder]);

  function chooseSuggestion(suggestion: (typeof suggestions)[number]) {
    setName(suggestion.name);
    setKind(suggestion.kind);
    setDescription(suggestion.description);
    setParams({ create: '1', kind: suggestion.kind });
  }

  function openCreate() {
    setParams(listScope ? { create: '1', kind: listScope } : { create: '1' });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), kind, description: description.trim() });
  }

  function requestCloseCreate() {
    if (name.trim() || description.trim()) {
      setConfirmingDiscard(true);
      return;
    }
    setParams(listScope ? { kind: listScope } : {});
  }

  function discardDraft() {
    setName('');
    setDescription('');
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
        <div className="list-page-actions">
          <a
            className="button button-outline"
            href="/api/export/records"
            title="Downloads lists, items, and logs as JSON. Photos are not included."
          >
            <DownloadSimple size={18} /> Download records
          </a>
          <button className="button button-accent" onClick={openCreate}>
            <Plus size={18} />{' '}
            {listScope === 'activity'
              ? 'New activity'
              : listScope === 'collection'
                ? 'New collection'
                : 'New list'}
          </button>
          <small>JSON only. Photos stay in Worth.</small>
        </div>
      </div>

      {creating && (
        <section className="create-panel" aria-label="Create a list">
          <div className="panel-title">
            <div>
              <p className="overline">NEW LIST</p>
              <h2>Name the list.</h2>
            </div>
            <button className="icon-button" aria-label="Close" onClick={requestCloseCreate}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={submit} className="create-form">
            <label>
              Name
              <input
                autoFocus
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="Whiskey, movies, runs…"
                required
              />
            </label>
            <label>
              Type
              <select value={kind} onChange={(event) => setKind(event.target.value as ListKind)}>
                <option value="collection">Collection: things you can revisit and rank</option>
                <option value="activity">Activity: things you log over time</option>
              </select>
            </label>
            <label className="form-wide">
              A short description <span className="optional">optional</span>
              <input
                value={description}
                maxLength={280}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A line to remind yourself what belongs here"
              />
            </label>
            {create.isError && <p className="form-error">{create.error.message}</p>}
            <button className="button button-dark" disabled={create.isPending}>
              Create list <ArrowRight size={18} />
            </button>
          </form>
          {confirmingDiscard && (
            <ConfirmDialog
              eyebrow="DISCARD DRAFT"
              title="Leave this list draft?"
              description="The name and description you entered will be lost."
              cancelLabel="Keep editing"
              confirmLabel="Discard draft"
              onConfirm={discardDraft}
              onClose={() => setConfirmingDiscard(false)}
            />
          )}
        </section>
      )}

      {lists.isPending ? (
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
              detail="Things you can compare, rank, and revisit."
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
              detail="Things you want to log over time."
              lists={visibleActivityLists}
            />
          )}
        </div>
      ) : (
        <EmptyListScope scope={listScope} onChoose={chooseSuggestion} />
      )}
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
      <div>
        {scopedSuggestions.map((suggestion) => (
          <button
            className={suggestion.cover ? 'starter-card has-cover' : 'starter-card'}
            key={suggestion.name}
            onClick={() => onChoose(suggestion)}
          >
            {suggestion.cover && <img src={suggestion.cover} alt="" />}
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
                : starterCollectionCover(list.name);
              return (
                <Link
                  to={`/lists/${list.id}`}
                  className={cover ? 'collection-directory-card has-cover' : 'collection-directory-card'}
                  key={list.id}
                >
                  {cover && <img src={cover} alt="" />}
                  <span className="collection-directory-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="collection-directory-copy">
                    <strong>{list.name}</strong>
                    <small>
                      {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                      {list.description ? ` · ${list.description}` : ''}
                    </small>
                  </span>
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
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
                  <small>{list.kind}</small>
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
