import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, X } from '@phosphor-icons/react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../api';
import type { ListKind } from '../shared/models';

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
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ListKind>('collection');
  const [description, setDescription] = useState('');
  const create = useMutation({ mutationFn: api.createList, onSuccess: ({ list }) => {
    void client.invalidateQueries({ queryKey: ['lists'] });
    void client.invalidateQueries({ queryKey: ['overview'] });
    navigate(`/lists/${list.id}`);
  } });

  function chooseSuggestion(suggestion: typeof suggestions[number]) {
    setName(suggestion.name);
    setKind(suggestion.kind);
    setDescription(suggestion.description);
    setParams({ create: '1' });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), kind, description: description.trim() });
  }

  return <main className="light-page lists-page page-width">
    <div className="page-head"><div><p className="overline">YOUR ARCHIVE</p><h1>Lists<span>.</span></h1>
      <p>Keep similar things together. Rank a collection, or just log what happened.</p></div>
      <button className="button button-accent" onClick={() => setParams({ create: '1' })}><Plus size={18} /> New list</button></div>

    {creating && <section className="create-panel" aria-label="Create a list">
      <div className="panel-title"><div><p className="overline">A NEW CORNER OF YOUR ARCHIVE</p><h2>What are you keeping?</h2></div>
        <button className="icon-button" aria-label="Close" onClick={() => setParams({})}><X size={20} /></button></div>
      <form onSubmit={submit} className="create-form">
        <label>Name<input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Whiskey, movies, runs…" required /></label>
        <label>Type<select value={kind} onChange={(event) => setKind(event.target.value as ListKind)}>
          <option value="collection">Collection: things you can revisit and rank</option>
          <option value="activity">Activity: things you log over time</option>
        </select></label>
        <label className="form-wide">A short description <span className="optional">optional</span>
          <input value={description} maxLength={280} onChange={(event) => setDescription(event.target.value)} placeholder="A line to remind yourself what belongs here" /></label>
        {create.isError && <p className="form-error">{create.error.message}</p>}
        <button className="button button-dark" disabled={create.isPending}>Create list <ArrowRight size={18} /></button>
      </form>
    </section>}

    {lists.isPending ? <p className="loading-line">Loading your lists…</p> : lists.isError ?
      <p className="error-banner">Couldn't load your lists. <button onClick={() => void lists.refetch()}>Try again</button></p> :
      lists.data?.lists.length ? <section className="list-directory" aria-label="Your lists">
        {lists.data.lists.map((list, index) => <Link to={`/lists/${list.id}`} className="directory-row" key={list.id}>
          <span className="directory-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="directory-name">{list.name}<small>{list.description || (list.kind === 'collection' ? 'Collection' : 'Activity')}</small></span>
          <span className="directory-count">{list.kind === 'collection' ? list.itemCount : list.logCount} {list.kind === 'collection' ? 'items' : 'logs'}</span>
          <ArrowRight size={20} /></Link>)}
      </section> : <section className="list-suggestions"><p className="overline">A FEW PLACES TO START</p>
        <div>{suggestions.map((suggestion) => <button key={suggestion.name} onClick={() => chooseSuggestion(suggestion)}>
          <span>{suggestion.name}<small>{suggestion.kind}</small></span><Plus size={18} /></button>)}</div>
      </section>}
  </main>;
}

