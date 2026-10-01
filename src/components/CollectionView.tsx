import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SquaresFour, ListBullets, Rows, Plus } from '@phosphor-icons/react';
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

type View = 'gallery' | 'list' | 'compact';

function decisionLabel(item: Item): string | null {
  if (item.decision === 'favorite') return 'Favorite';
  if (item.decision === 'would_not_again') return 'Would not again';
  return null;
}

export function CollectionView({
  list,
  items,
  onSelect,
  onAdd,
}: {
  list: ListDetail;
  items: Item[];
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const client = useQueryClient();
  const [view, setView] = useState<View>(() => {
    const saved = window.localStorage.getItem(`worth:view:${list.id}`);
    return saved === 'gallery' || saved === 'list' || saved === 'compact' ? saved : 'compact';
  });
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [rankFilter, setRankFilter] = useState<RankFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [sort, setSort] = useState<ItemSort>('rank');
  const types = Array.from(new Set(items.map((item) => item.type).filter(Boolean))).sort();
  const visible = visibleItems(items, list.rankedIds, {
    search,
    type,
    rankFilter,
    decisionFilter,
    sort,
  });
  const ranks = new Map(list.rankedIds.map((id, index) => [id, index + 1]));
  const rankedItems = list.rankedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is Item => Boolean(item));
  const favorite = items.find((item) => item.decision === 'favorite');
  const wouldNotAgain = items.find((item) => item.decision === 'would_not_again');
  const primarySignal = favorite ?? rankedItems[0];

  const rank = useMutation({
    mutationFn: ({ itemId, position }: { itemId: string; position: number | null }) =>
      api.rank(list.id, moveRank(list.rankedIds, itemId, position), list.rankRevision),
    onSuccess: ({ list: next }) => {
      client.setQueryData(['list', list.id], { list: next });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (error) => {
      if (error instanceof RequestError && error.status === 409)
        void client.invalidateQueries({ queryKey: ['list', list.id] });
    },
  });

  function chooseView(next: View) {
    setView(next);
    window.localStorage.setItem(`worth:view:${list.id}`, next);
  }

  function rankControl(item: Item) {
    const current = ranks.get(item.id);
    return (
      <select
        className="rank-select"
        aria-label={`Rank ${item.title}`}
        value={current ?? 'none'}
        disabled={rank.isPending}
        onChange={(event) =>
          rank.mutate({
            itemId: item.id,
            position: event.target.value === 'none' ? null : Number(event.target.value),
          })
        }
      >
        <option value="none">—</option>
        {Array.from({ length: Math.min(items.length, 500) }, (_, index) => (
          <option value={index + 1} key={index + 1}>
            #{index + 1}
          </option>
        ))}
      </select>
    );
  }

  return (
    <section className="collection-view" aria-label={`${list.name} items`}>
      <div className="collection-toolbar">
        <div className="view-switch" role="group" aria-label="List view">
          <button
            className={view === 'gallery' ? 'active' : ''}
            aria-pressed={view === 'gallery'}
            onClick={() => chooseView('gallery')}
          >
            <SquaresFour size={18} /> Gallery
          </button>
          <button
            className={view === 'list' ? 'active' : ''}
            aria-pressed={view === 'list'}
            onClick={() => chooseView('list')}
          >
            <ListBullets size={18} /> List
          </button>
          <button
            className={view === 'compact' ? 'active' : ''}
            aria-pressed={view === 'compact'}
            onClick={() => chooseView('compact')}
          >
            <Rows size={18} /> Compact
          </button>
        </div>
        <span className="item-count">
          {visible.length} of {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {primarySignal || wouldNotAgain ? (
        <section className="collection-signal" aria-label="Ranking summary">
          {primarySignal && (
            <div className={favorite ? 'signal-favorite' : ''}>
              <span>{favorite ? 'Favorite' : 'Top ranked'}</span>
              <strong>{primarySignal.title}</strong>
            </div>
          )}
          {wouldNotAgain && (
            <div className="signal-negative">
              <span>Would not again</span>
              <strong>{wouldNotAgain.title}</strong>
            </div>
          )}
          <p>
            {rankedItems.length} ranked {rankedItems.length === 1 ? 'item' : 'items'}
          </p>
        </section>
      ) : items.length > 0 ? (
        <p className="collection-rank-hint">Rank a few things when you know where they stand.</p>
      ) : null}

      <div className="collection-filters">
        <label className="filter-search">
          <span className="sr-only">Search this list</span>
          <input
            placeholder={`Search ${list.name.toLowerCase()}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {types.length > 0 && (
          <label>
            <span className="sr-only">Type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">All types</option>
              {types.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="sr-only">Rank filter</span>
          <select value={rankFilter} onChange={(event) => setRankFilter(event.target.value as RankFilter)}>
            <option value="all">All ranks</option>
            <option value="top5">Top 5</option>
            <option value="top10">Top 10</option>
            <option value="unranked">Unranked</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Your call</span>
          <select
            value={decisionFilter}
            onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)}
          >
            <option value="all">All calls</option>
            <option value="favorite">Favorites</option>
            <option value="would_not_again">Would not again</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort items</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as ItemSort)}>
            <option value="rank">My rank</option>
            <option value="recent">Last logged</option>
            <option value="name">Name</option>
            <option value="times">Most times</option>
          </select>
        </label>
      </div>
      {rank.isError && <p className="form-error">{rank.error.message}</p>}

      {!visible.length ? (
        <div className="empty-list">
          <h2>{items.length ? 'Nothing matches.' : 'Start with one thing.'}</h2>
          <p>
            {items.length
              ? 'Try a different search or filter.'
              : `Add the first item to ${list.name}. You can rank it later.`}
          </p>
          {!items.length && (
            <button className="button button-dark" onClick={onAdd}>
              <Plus size={17} /> Add item
            </button>
          )}
        </div>
      ) : view === 'compact' ? (
        <div className="table-scroll">
          <table className="compact-table">
            <caption className="sr-only">All matching items in {list.name}</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Call</th>
                <th scope="col">Last logged</th>
                <th scope="col">Times</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id}>
                  <td>{rankControl(item)}</td>
                  <td>
                    <button className="table-name" onClick={() => onSelect(item.id)}>
                      {item.title}
                    </button>
                  </td>
                  <td>{item.type || '—'}</td>
                  <td>{decisionLabel(item) ?? '—'}</td>
                  <td>{formatDate(item.lastLoggedOn)}</td>
                  <td>{item.logCount || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'list' ? (
        <div className="expanded-list">
          {visible.map((item) => (
            <article className="expanded-row" key={item.id}>
              <div className="expanded-rank">{rankControl(item)}</div>
              {item.hasPhoto && <img src={`/api/items/${item.id}/photo`} alt="" loading="lazy" />}
              <button className="expanded-content" onClick={() => onSelect(item.id)}>
                <strong>{item.title}</strong>
                <span>
                  {item.type || 'Item'}
                  {item.lastLoggedOn ? ` · Last logged ${formatDate(item.lastLoggedOn)}` : ''}
                  {decisionLabel(item) ? ` · ${decisionLabel(item)}` : ''}
                </span>
                {item.note && <small>{item.note}</small>}
              </button>
              <span className="expanded-times">
                {item.logCount
                  ? `${item.logCount} ${item.logCount === 1 ? 'time' : 'times'}`
                  : 'Not logged yet'}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="gallery-grid">
          {visible.map((item) => (
            <article className="gallery-card" key={item.id}>
              <button onClick={() => onSelect(item.id)} className="gallery-open">
                {item.hasPhoto ? (
                  <img src={`/api/items/${item.id}/photo`} alt="" loading="lazy" />
                ) : (
                  <span className="gallery-blank">
                    <span>{item.title.slice(0, 1)}</span>
                  </span>
                )}
                <span className="gallery-title">
                  <strong>{item.title}</strong>
                  <small>{[item.type || 'Item', decisionLabel(item)].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
              <div className="gallery-rank">{rankControl(item)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
