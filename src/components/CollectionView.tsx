import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react';
import type { Item, ListDetail } from '../shared/models';
import {
  moveRank,
  visibleItems,
  type DecisionFilter,
  type ItemSort,
  type RankFilter,
} from '../shared/ranking';
import { api, RequestError } from '../api';
import { formatDate } from '../format';

type BrowseMode = 'all' | 'kept' | 'revisited' | 'not-opened-lately';

const browseModes: { id: BrowseMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kept', label: 'Kept' },
  { id: 'revisited', label: 'Revisited' },
  { id: 'not-opened-lately', label: 'Not opened lately' },
];

function decisionLabel(item: Item): string | null {
  if (item.decision === 'favorite') return 'Favorite';
  if (item.decision === 'would_not_again') return 'Would not again';
  return null;
}

function wasOpenedLongAgo(item: Item): boolean {
  if (!item.lastLoggedOn) return true;
  const lastOpened = new Date(`${item.lastLoggedOn}T12:00:00`).getTime();
  return Number.isNaN(lastOpened) || lastOpened < Date.now() - 1000 * 60 * 60 * 24 * 120;
}

export function CollectionView({
  list,
  items,
  focusCapture,
  onOpenDetails,
  onAddNote,
  onLogRevisit,
}: {
  list: ListDetail;
  items: Item[];
  focusCapture: boolean;
  onOpenDetails: (id: string) => void;
  onAddNote: (id: string) => void;
  onLogRevisit: (id: string) => void;
}) {
  const client = useQueryClient();
  const captureRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [browse, setBrowse] = useState<BrowseMode>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [rankFilter, setRankFilter] = useState<RankFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [sort, setSort] = useState<ItemSort>('rank');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setTitle('');
    setBrowse('all');
    setShowSearch(false);
    setShowFilters(false);
    setSearch('');
    setType('all');
    setRankFilter('all');
    setDecisionFilter('all');
    setSort('rank');
    setStatus('');
    setSelectedId(null);
  }, [list.id]);
  useEffect(() => {
    if (!focusCapture) return;
    requestAnimationFrame(() => captureRef.current?.focus());
  }, [focusCapture, list.id]);

  const create = useMutation({
    mutationFn: (nextTitle: string) =>
      api.createItem(list.id, {
        title: nextTitle,
        type: '',
        note: '',
        decision: null,
        startedOn: null,
        endedOn: null,
      }),
    onSuccess: ({ item }) => {
      setTitle('');
      setBrowse('all');
      setSelectedId(item.id);
      setStatus(`${item.title} was kept in ${list.name}.`);
      void client.invalidateQueries({ queryKey: ['items', list.id] });
      void client.invalidateQueries({ queryKey: ['list', list.id] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      captureRef.current?.focus();
    },
  });

  const decide = useMutation({
    mutationFn: ({ item, decision }: { item: Item; decision: Item['decision'] }) =>
      api.updateItem(item.id, { decision }),
    onSuccess: ({ item }) => {
      setStatus(item.decision ? `${item.title}: ${decisionLabel(item)}.` : `${item.title}: no call yet.`);
      void client.invalidateQueries({ queryKey: ['items', list.id] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
  });

  const rank = useMutation({
    mutationFn: ({ item, position }: { item: Item; position: number | null }) =>
      api.rank(list.id, moveRank(list.rankedIds, item.id, position), list.rankRevision),
    onSuccess: ({ list: next }) => {
      setStatus('Ranking saved.');
      client.setQueryData(['list', list.id], { list: next });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      if (error instanceof RequestError && error.status === 409) {
        setStatus('The ranking changed in another tab, so the latest order has been restored.');
        void client.invalidateQueries({ queryKey: ['list', list.id] });
      }
    },
  });

  const rankedIds = new Set(list.rankedIds);
  const types = Array.from(new Set(items.map((item) => item.type).filter(Boolean))).sort();
  const hasAdvancedFilters =
    type !== 'all' || rankFilter !== 'all' || decisionFilter !== 'all' || sort !== 'rank';
  const ranks = useMemo(() => new Map(list.rankedIds.map((id, index) => [id, index + 1])), [list.rankedIds]);
  const ordered = visibleItems(items, list.rankedIds, {
    search,
    type,
    rankFilter,
    decisionFilter,
    sort,
  });
  const visible = ordered.filter((item) => {
    if (browse === 'kept') return item.decision === 'favorite';
    if (browse === 'revisited') return item.logCount > 1;
    if (browse === 'not-opened-lately') return wasOpenedLongAgo(item);
    return true;
  });
  const ranked = visible.filter((item) => rankedIds.has(item.id));
  const unranked = visible.filter((item) => !rankedIds.has(item.id));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (cleanTitle) {
      setStatus('');
      create.mutate(cleanTitle);
    }
  }

  function selectBrowse(next: BrowseMode) {
    setBrowse(next);
    setStatus('');
  }

  return (
    <section className="collection-workspace" aria-label={`${list.name} collection`}>
      <header className="collection-index-head">
        <div>
          <p className="overline">YOUR INDEX</p>
          <p className="collection-index-summary">
            {items.length
              ? `${items.length} ${items.length === 1 ? 'thing' : 'things'} kept here.`
              : 'Start with one thing worth remembering.'}
          </p>
        </div>
        <div className="collection-utilities">
          <button
            className={`collection-search-toggle ${showSearch ? 'active' : ''}`}
            type="button"
            aria-expanded={showSearch}
            aria-controls="collection-search"
            onClick={() => setShowSearch((current) => !current)}
          >
            <MagnifyingGlass size={16} /> Search
          </button>
          <button
            className={`collection-search-toggle ${showFilters || hasAdvancedFilters ? 'active' : ''}`}
            type="button"
            aria-expanded={showFilters}
            aria-controls="collection-filters"
            onClick={() => setShowFilters((current) => !current)}
          >
            Filter{hasAdvancedFilters ? ' ·' : ''}
          </button>
        </div>
      </header>

      <form className="collection-capture" onSubmit={submit}>
        <label>
          <span className="sr-only">What did you try?</span>
          <input
            ref={captureRef}
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What did you try?"
            disabled={create.isPending}
          />
        </label>
        <button className="collection-capture-submit" disabled={!title.trim() || create.isPending}>
          {create.isPending ? 'Keeping…' : 'Keep it'} <ArrowRight size={17} />
        </button>
        <p>Rank it later if you want.</p>
      </form>
      {create.isError && <p className="form-error collection-capture-error">{create.error.message}</p>}
      {status && (
        <p className="collection-capture-status" role="status">
          {status}
        </p>
      )}

      {showSearch && (
        <div className="collection-search" id="collection-search">
          <label>
            <span className="sr-only">Search {list.name}</span>
            <input
              autoFocus
              value={search}
              placeholder={`Search ${list.name.toLowerCase()}`}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {search && (
            <button type="button" onClick={() => setSearch('')}>
              <X size={15} /> Clear
            </button>
          )}
        </div>
      )}
      {showFilters && (
        <div className="collection-advanced-filters" id="collection-filters">
          {types.length > 0 && (
            <label>
              <span>Type</span>
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="all">Everything</option>
                {types.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Rank</span>
            <select value={rankFilter} onChange={(event) => setRankFilter(event.target.value as RankFilter)}>
              <option value="all">Any position</option>
              <option value="top5">Top 5</option>
              <option value="top10">Top 10</option>
              <option value="unranked">Not ranked</option>
            </select>
          </label>
          <label>
            <span>Your call</span>
            <select
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)}
            >
              <option value="all">Any call</option>
              <option value="favorite">Favorite</option>
              <option value="would_not_again">Would not again</option>
            </select>
          </label>
          <label>
            <span>Order</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as ItemSort)}>
              <option value="rank">My rank</option>
              <option value="recent">Last opened</option>
              <option value="name">Name</option>
              <option value="times">Most visits</option>
            </select>
          </label>
          {hasAdvancedFilters && (
            <button
              type="button"
              onClick={() => {
                setType('all');
                setRankFilter('all');
                setDecisionFilter('all');
                setSort('rank');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="collection-index-layout">
        <nav className="collection-browse" aria-label="Browse collection">
          <span>Show</span>
          {browseModes.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={browse === mode.id ? 'active' : ''}
              aria-pressed={browse === mode.id}
              onClick={() => selectBrowse(mode.id)}
            >
              {mode.label}
              <small>{browseCount(mode.id, items)}</small>
            </button>
          ))}
        </nav>

        <div className="collection-index">
          {!visible.length ? (
            <div className="collection-index-empty">
              <h2>{items.length ? 'Nothing here yet.' : 'Keep the first one.'}</h2>
              <p>
                {items.length
                  ? 'Try another view or search for a different name.'
                  : 'A name is enough. Add context whenever it becomes useful.'}
              </p>
              {items.length > 0 && (browse !== 'all' || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setBrowse('all');
                    setSearch('');
                  }}
                >
                  Show everything
                </button>
              )}
            </div>
          ) : (
            <>
              {ranked.length > 0 && (
                <IndexRows
                  items={ranked}
                  ranks={ranks}
                  rankSlots={items.length}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onOpenDetails={onOpenDetails}
                  onAddNote={onAddNote}
                  onLogRevisit={onLogRevisit}
                  onDecide={(item, decision) => {
                    setStatus('');
                    decide.mutate({ item, decision: item.decision === decision ? null : decision });
                  }}
                  decisionPending={decide.isPending}
                  onRank={(item, position) => {
                    setStatus('');
                    rank.mutate({ item, position });
                  }}
                  rankPending={rank.isPending}
                />
              )}
              {unranked.length > 0 && (
                <section className="collection-unranked" aria-labelledby="unranked-heading">
                  {ranked.length > 0 && <p id="unranked-heading">Not ranked yet</p>}
                  <IndexRows
                    items={unranked}
                    ranks={ranks}
                    rankSlots={items.length}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onOpenDetails={onOpenDetails}
                    onAddNote={onAddNote}
                    onLogRevisit={onLogRevisit}
                    onDecide={(item, decision) => {
                      setStatus('');
                      decide.mutate({ item, decision: item.decision === decision ? null : decision });
                    }}
                    decisionPending={decide.isPending}
                    onRank={(item, position) => {
                      setStatus('');
                      rank.mutate({ item, position });
                    }}
                    rankPending={rank.isPending}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function browseCount(mode: BrowseMode, items: Item[]): number {
  if (mode === 'kept') return items.filter((item) => item.decision === 'favorite').length;
  if (mode === 'revisited') return items.filter((item) => item.logCount > 1).length;
  if (mode === 'not-opened-lately') return items.filter(wasOpenedLongAgo).length;
  return items.length;
}

function IndexRows({
  items,
  ranks,
  rankSlots,
  selectedId,
  onSelect,
  onOpenDetails,
  onAddNote,
  onLogRevisit,
  onDecide,
  decisionPending,
  onRank,
  rankPending,
}: {
  items: Item[];
  ranks: Map<string, number>;
  rankSlots: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDetails: (id: string) => void;
  onAddNote: (id: string) => void;
  onLogRevisit: (id: string) => void;
  onDecide: (item: Item, decision: Item['decision']) => void;
  decisionPending: boolean;
  onRank: (item: Item, position: number | null) => void;
  rankPending: boolean;
}) {
  return (
    <ol className="collection-index-rows">
      {items.map((item) => {
        const rank = ranks.get(item.id);
        const call = decisionLabel(item);
        const selected = selectedId === item.id;
        return (
          <li className={selected ? 'selected' : ''} key={item.id}>
            <div className="collection-index-row">
              <span className="collection-row-rank">{rank ? String(rank).padStart(2, '0') : '—'}</span>
              <button
                type="button"
                aria-expanded={selected}
                onClick={() => onSelect(selected ? null : item.id)}
              >
                <strong>{item.title}</strong>
                <span>
                  {call ||
                    (item.lastLoggedOn ? `Last opened ${formatDate(item.lastLoggedOn)}` : 'No details yet')}
                </span>
              </button>
              <span className="collection-row-context">
                {item.note || (item.logCount > 1 ? `${item.logCount} visits` : '')}
              </span>
            </div>
            {selected && (
              <div className="collection-action-tray" aria-label={`Actions for ${item.title}`}>
                <button
                  type="button"
                  className={item.decision === 'favorite' ? 'active' : ''}
                  aria-pressed={item.decision === 'favorite'}
                  disabled={decisionPending}
                  onClick={() => onDecide(item, 'favorite')}
                >
                  Favorite
                </button>
                <button
                  type="button"
                  className={item.decision === 'would_not_again' ? 'active' : ''}
                  aria-pressed={item.decision === 'would_not_again'}
                  disabled={decisionPending}
                  onClick={() => onDecide(item, 'would_not_again')}
                >
                  Would not again
                </button>
                <label className="collection-rank-placement">
                  <span>Place</span>
                  <select
                    aria-label={`Place ${item.title} in your ranking`}
                    value={rank ?? 'none'}
                    disabled={rankPending}
                    onChange={(event) =>
                      onRank(item, event.target.value === 'none' ? null : Number(event.target.value))
                    }
                  >
                    <option value="none">Unranked</option>
                    {Array.from({ length: rankSlots }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        #{String(index + 1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => onAddNote(item.id)}>
                  Add a note
                </button>
                <button type="button" onClick={() => onLogRevisit(item.id)}>
                  Log revisit
                </button>
                <button
                  type="button"
                  className="collection-open-details"
                  onClick={() => onOpenDetails(item.id)}
                >
                  Details <ArrowRight size={15} />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
