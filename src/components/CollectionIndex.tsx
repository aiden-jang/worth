import { ArrowRight } from '@phosphor-icons/react';
import type { Item } from '../shared/models';
import { OpinionSlip } from './OpinionSlip';
import { CallBadge } from './PersonalCall';

type IndexProps = {
  onQueue: (item: Item) => void;
  queuePending: boolean;
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
};

export function IndexRows({ items, ranks, selectedId, onSelect, ...actions }: IndexProps) {
  return (
    <ol className="collection-index-rows">
      {items.map((item) => {
        const rank = ranks.get(item.id);
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
                {item.type && <span>{item.type}</span>}
              </button>
              {item.decision && <CallBadge value={item.decision} />}
            </div>
            {selected && (
              <ItemActions className="collection-action-tray" item={item} rank={rank} {...actions} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ItemActions({
  onQueue,
  queuePending,
  item,
  rank,
  rankSlots,
  onOpenDetails,
  onAddNote,
  onLogRevisit,
  onDecide,
  decisionPending,
  onRank,
  rankPending,
  className = '',
}: Omit<IndexProps, 'items' | 'ranks' | 'selectedId' | 'onSelect'> & {
  item: Item;
  rank?: number;
  className?: string;
}) {
  return (
    <OpinionSlip
      className={className}
      title={item.title}
      type={item.type}
      rank={rank}
      decision={item.decision}
      disabled={decisionPending}
      onChange={(value) => onDecide(item, value)}
    >
      <button
        type="button"
        aria-pressed={Boolean(item.revisitQueued)}
        className="collection-queue-action"
        disabled={queuePending}
        onClick={() => onQueue(item)}
      >
        {item.revisitQueued ? 'In revisit queue ✓' : 'Add to revisit queue'}
      </button>
      <div className="collection-tray-actions">
        <details className="collection-rank-disclosure">
          <summary aria-label={`Rank ${item.title}`}>Rank</summary>
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
        </details>
        <button type="button" aria-label={`Add a note to ${item.title}`} onClick={() => onAddNote(item.id)}>
          Note
        </button>
        <button
          type="button"
          aria-label={`Log a revisit to ${item.title}`}
          onClick={() => onLogRevisit(item.id)}
        >
          Revisit
        </button>
        <button type="button" className="collection-open-details" onClick={() => onOpenDetails(item.id)}>
          Details <ArrowRight size={15} />
        </button>
      </div>
    </OpinionSlip>
  );
}
