import { ArrowRight } from '@phosphor-icons/react';
import type { Item } from '../shared/models';
import { OpinionSlip } from './OpinionSlip';
import { CallBadge } from './PersonalCall';

type IndexProps = {
  sheet?: boolean;
  selection?: { ids: Set<string>; toggle: (id: string) => void };
  onWant: (item: Item) => void;
  wantPending: boolean;
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

export function IndexRows({ items, ranks, selectedId, onSelect, selection, sheet }: IndexProps) {
  return (
    <ol className="collection-index-rows">
      {items.map((item) => {
        const rank = ranks.get(item.id);
        const selected = selectedId === item.id;
        return (
          <li className={selected ? 'selected' : ''} key={item.id}>
            <div className="collection-index-row">
              {selection && (
                <label className="collection-select">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.title}`}
                    checked={selection.ids.has(item.id)}
                    onChange={() => selection.toggle(item.id)}
                  />
                </label>
              )}
              <span className="collection-row-rank">{rank ? String(rank).padStart(2, '0') : '—'}</span>
              <button
                type="button"
                aria-expanded={selected}
                aria-haspopup={sheet ? 'dialog' : undefined}
                onClick={(event) => {
                  event.currentTarget.focus();
                  onSelect(selected ? null : item.id);
                }}
              >
                <strong>{item.title}</strong>
                {item.type && <span>{item.type}</span>}
                {item.wantToTry && <small className="want-label">Want to try</small>}
              </button>
              {item.decision && <CallBadge value={item.decision} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ItemActions({
  onWant,
  wantPending,
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
      headingLevel="h2"
      title={item.title}
      type={item.type}
      rank={rank}
      decision={item.decision}
      disabled={decisionPending}
      onChange={(value) => onDecide(item, value)}
    >
      <div className="collection-tray-actions">
        <button
          type="button"
          aria-label={`Add experience for ${item.title}`}
          onClick={() => onLogRevisit(item.id)}
        >
          Add experience
        </button>
        <button type="button" className="collection-open-details" onClick={() => onOpenDetails(item.id)}>
          Edit <ArrowRight size={15} />
        </button>
      </div>
      <details className="item-more">
        <summary>More options</summary>
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
          Add note
        </button>
        <button
          type="button"
          className="collection-queue-action"
          aria-pressed={Boolean(item.wantToTry)}
          disabled={wantPending}
          onClick={() => onWant(item)}
        >
          {item.wantToTry ? 'Want to try ✓' : 'Save to Want to try'}
        </button>
        <button
          type="button"
          aria-pressed={Boolean(item.revisitQueued)}
          className="collection-queue-action"
          disabled={queuePending}
          onClick={() => onQueue(item)}
        >
          {item.revisitQueued ? 'In revisit queue ✓' : 'Add to revisit queue'}
        </button>
      </details>
    </OpinionSlip>
  );
}
