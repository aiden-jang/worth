import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, DownloadSimple, Plus, X } from '@phosphor-icons/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import type { ListKind, ListSummary } from '../shared/models';

const suggestions: { name: string; kind: ListKind; description: string }[] = [
  { name: 'Drinks', kind: 'collection', description: 'Wines, whiskeys, and the occasional good idea.' },
  { name: 'Movies', kind: 'collection', description: 'The ones you would watch again.' },
  { name: 'Places', kind: 'collection', description: 'Restaurants and stops worth remembering.' },
  { name: 'Cars', kind: 'collection', description: 'The ones you owned, drove, or loved.' },
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
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ListKind>(requestedKind === 'activity' ? 'activity' : 'collection');
  const [description, setDescription] = useState('');
  const collectionLists = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const activityLists = lists.data?.lists.filter((list) => list.kind === 'activity') ?? [];
  const create = useMutation({
    mutationFn: api.createList,
    onSuccess: ({ list }) => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      navigate(`/lists/${list.id}`);
    },
  });

  useEffect(() => {
    if (requestedKind === 'collection' || requestedKind === 'activity') setKind(requestedKind);
  }, [requestedKind]);

  function chooseSuggestion(suggestion: (typeof suggestions)[number]) {
    setName(suggestion.name);
    setKind(suggestion.kind);
    setDescription(suggestion.description);
    setParams({ create: '1', kind: suggestion.kind });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), kind, description: description.trim() });
  }

  return (
    <main className="light-page lists-page page-width">
      <div className="page-head">
        <div>
          <p className="overline">YOUR ARCHIVE</p>
          <h1>Lists</h1>
          <p>Keep similar things together. Rank a collection, or just log what happened.</p>
        </div>
        <div className="list-page-actions">
          <a
            className="button button-outline"
            href="/api/export/records"
            title="Downloads lists, items, and logs as JSON. Photos are not included."
          >
            <DownloadSimple size={18} /> Download records
          </a>
          <button className="button button-accent" onClick={() => setParams({ create: '1' })}>
            <Plus size={18} /> New list
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
            <button className="icon-button" aria-label="Close" onClick={() => setParams({})}>
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
        </section>
      )}

      {lists.isPending ? (
        <p className="loading-line">Loading your lists…</p>
      ) : lists.isError ? (
        <p className="error-banner">
          Couldn't load your lists. <button onClick={() => void lists.refetch()}>Try again</button>
        </p>
      ) : lists.data?.lists.length ? (
        <div className="list-groups">
          {collectionLists.length > 0 && (
            <ListDirectory
              heading="Collections"
              detail="Things you can compare, rank, and revisit."
              lists={collectionLists}
            />
          )}
          {activityLists.length > 0 && (
            <ListDirectory
              heading="Activity"
              detail="Things you want to log over time."
              lists={activityLists}
            />
          )}
        </div>
      ) : (
        <section className="list-suggestions">
          <p className="overline">A FEW PLACES TO START</p>
          <div>
            {suggestions.map((suggestion) => (
              <button key={suggestion.name} onClick={() => chooseSuggestion(suggestion)}>
                <span>
                  {suggestion.name}
                  <small>{suggestion.kind}</small>
                </span>
                <Plus size={18} />
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ListDirectory({
  heading,
  detail,
  lists,
}: {
  heading: string;
  detail: string;
  lists: ListSummary[];
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
        <strong>{lists.length}</strong>
      </header>
      <div>
        {lists.map((list, index) => {
          const count = list.kind === 'collection' ? list.itemCount : list.logCount;
          const noun = list.kind === 'collection' ? 'item' : 'log';
          return (
            <Link to={`/lists/${list.id}`} className="directory-row" key={list.id}>
              <span className="directory-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="directory-name">
                <strong>{list.name}</strong>
                <small>{list.description || (list.kind === 'collection' ? 'Collection' : 'Activity')}</small>
              </span>
              <span className="directory-meta">
                <small>{list.kind}</small>
                <strong>
                  {count} {count === 1 ? noun : `${noun}s`}
                </strong>
              </span>
              <ArrowRight size={20} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
