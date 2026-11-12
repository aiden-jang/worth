import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import type { Item, ItemDecision } from '../shared/models';
import { OpinionSlip } from './OpinionSlip';
import { CallBadge } from './PersonalCall';
import { itemIdentity } from '../shared/item-details';
import { ItemDetailsReadout } from './ItemDetailsReadout';
import { TryReview } from './TryReview';

type IndexProps = {
  sheet?: boolean;
  selection?: { ids: Set<string>; toggle: (id: string) => void };
  onWant: (item: Item) => void;
  wantPending: boolean;
  onQueue: (item: Item) => void;
  onTrash: (item: Item) => void;
  queuePending: boolean;
  items: Item[];
  ranks: Map<string, number>;
  rankSlots: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDetails: (id: string) => void;
  onAddNote: (id: string) => void;
  onLogRevisit: (id: string) => void;
  onRank: (item: Item, position: number | null) => void;
  rankPending: boolean;
  onCall: (item: Item, decision: ItemDecision | null) => void;
  callPending: boolean;
  callError: string;
};

export function IndexRows({
  items,
  ranks,
  selectedId,
  onSelect,
  selection,
  sheet,
  scope,
  total,
  onMore,
  ...actions
}: IndexProps & { scope: string; total: number; onMore: () => void }) {
  const rows = useRef<HTMLOListElement>(null);
  const count = items.length;
  const ranked = ranks.has(items[0]?.id ?? '');
  return (
    <>
      <ol className="collection-index-rows" ref={rows} data-window={scope}>
        {items.map((item) => {
          const rank = ranks.get(item.id);
          const selected = selectedId === item.id;
          return (
            <li className={selected ? 'selected' : ''} key={item.id}>
              <div className="collection-index-row" data-item-id={item.id}>
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
                  {itemIdentity(item) && <small className="item-brand">{itemIdentity(item)}</small>}
                  {item.wantToTry && <small className="want-label">Want to try</small>}
                </button>
                <div className="collection-row-actions">
                  {item.decision && <CallBadge value={item.decision} />}
                  {!selection && (
                    <>
                      <ItemRowOptions item={item} rank={rank} {...actions} />
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {total > count && (
        <div className="archive-paging">
          <p role="status">
            Showing {count} of {total} {ranked ? 'ranked' : 'unranked'} items
          </p>
          <button
            type="button"
            className="button button-outline"
            aria-label={`Show more ${ranked ? 'ranked' : 'unranked'} items`}
            onClick={() => {
              const firstNew = count;
              onMore();
              requestAnimationFrame(() => {
                if (rows.current?.dataset.window !== scope) return;
                const buttons = rows.current?.querySelectorAll<HTMLButtonElement>(
                  '.collection-index-row > button',
                );
                const target = buttons?.[firstNew];
                target?.focus({ preventScroll: true });
                target?.scrollIntoView({ block: 'center' });
              });
            }}
          >
            Show more items
          </button>
        </div>
      )}
    </>
  );
}

function ItemRowOptions({
  onWant,
  wantPending,
  onQueue,
  queuePending,
  item,
  rank,
  rankSlots,
  onAddNote,
  onLogRevisit,
  onRank,
  rankPending,
  onOpenDetails,
  onTrash,
}: Omit<IndexProps, 'items' | 'ranks' | 'selectedId' | 'onSelect'> & {
  item: Item;
  rank?: number;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const trigger = menu.current;
    const content = panel.current;
    if (!open || !trigger || !content) return;
    const position = () => {
      if (window.innerWidth <= 680) {
        for (const property of ['top', 'bottom', 'max-height']) content.style.removeProperty(property);
        return;
      }
      const box = trigger.getBoundingClientRect();
      const below = Math.max(0, window.innerHeight - box.bottom - 20);
      const above = Math.max(0, box.top - 20);
      const upward = below < Math.min(480, content.scrollHeight) && above > below;
      content.style.top = upward ? 'auto' : 'calc(100% + 8px)';
      content.style.bottom = upward ? 'calc(100% + 8px)' : 'auto';
      content.style.maxHeight = Math.min(480, upward ? above : below) + 'px';
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(content);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);
  function closeMenu() {
    if (!menu.current) return;
    menu.current.open = false;
    setOpen(false);
    menu.current.querySelector('summary')?.focus();
  }
  return (
    <details
      ref={menu}
      data-menu
      className="entry-options collection-row-options"
      onToggle={(event) => {
        if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
      }}
    >
      <summary aria-label={`More options for ${item.title}`}>•••</summary>
      {open && (
        <div className="entry-options-panel" ref={panel}>
          <button
            type="button"
            aria-label={`Edit ${item.title}`}
            onClick={() => {
              closeMenu();
              onOpenDetails(item.id);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            aria-label={`Add experience for ${item.title}`}
            onClick={() => {
              closeMenu();
              onLogRevisit(item.id);
            }}
          >
            Add experience
          </button>
          <details className="collection-rank-disclosure">
            <summary aria-label={`Rank ${item.title}`}>Rank</summary>
            <label className="collection-rank-placement">
              <span>Place</span>
              <select
                aria-label={`Place ${item.title} in your ranking`}
                value={rank ?? 'none'}
                disabled={rankPending}
                onChange={(event) => {
                  closeMenu();
                  onRank(item, event.target.value === 'none' ? null : Number(event.target.value));
                }}
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

          <button
            type="button"
            aria-label={`Add note to ${item.title}`}
            onClick={() => {
              closeMenu();
              onAddNote(item.id);
            }}
          >
            Add note
          </button>
          <button
            type="button"
            aria-pressed={Boolean(item.wantToTry)}
            disabled={wantPending}
            onClick={() => {
              closeMenu();
              onWant(item);
            }}
          >
            {item.wantToTry ? 'Want to try ✓' : 'Save to Want to try'}
          </button>
          <button
            type="button"
            aria-pressed={Boolean(item.revisitQueued)}
            disabled={queuePending}
            onClick={() => {
              closeMenu();
              onQueue(item);
            }}
          >
            {item.revisitQueued ? 'In revisit queue ✓' : 'Add to revisit queue'}
          </button>
          <button
            type="button"
            className="text-danger"
            aria-label={`Move to Trash: ${item.title}`}
            onClick={() => {
              closeMenu();
              onTrash(item);
            }}
          >
            Move to Trash
          </button>
        </div>
      )}
    </details>
  );
}

export function ItemPreview({
  item,
  rank,
  onOpenDetails,
  onLogRevisit,
  onCall,
  callPending,
  callError,
}: Pick<IndexProps, 'sheet' | 'onOpenDetails' | 'onLogRevisit' | 'onCall' | 'callPending' | 'callError'> & {
  item: Item;
  rank?: number;
}) {
  return (
    <OpinionSlip
      presentation="preview"
      headingLevel="h2"
      title={item.title}
      type={item.type}
      rank={rank}
      decision={item.decision}
      onChange={item.wantToTry ? undefined : (decision) => onCall(item, decision)}
      disabled={callPending}
    >
      {callError && (
        <p className="form-error" role="alert">
          {callError}
        </p>
      )}
      <ItemDetailsReadout item={item} />
      {item.wantToTry && (
        <TryReview key={item.id} target={{ kind: 'item', id: item.id, title: item.title, initial: item }} />
      )}
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
    </OpinionSlip>
  );
}
