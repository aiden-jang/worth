import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { decisionLabel } from '../shared/decisions';
import type { Item, ListDetail, Log } from '../shared/models';
import { moveRank } from '../shared/ranking';
import {
  answerComparison,
  cleanOrder,
  comparisonPair,
  drawCandidates,
  shuffled,
  startComparison,
  type Comparison,
} from '../shared/workbench';
import { ConfirmDialog } from './ConfirmDialog';
import { SavedRankings } from './SavedRankings';
import { ItemContextReadout } from './ItemContextReadout';
import { CollectionPublishing } from './CollectionPublishing';
import { CollectionShelf } from './CollectionShelf';
import '../workbench.css';

type Mode = 'rank' | 'compare' | 'draw' | 'publish' | 'shelf';
type RankingDraft = { ids: string[]; revision: number };
const validDraft = (value: unknown): value is RankingDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as RankingDraft;
  return (
    Array.isArray(draft.ids) &&
    draft.ids.length <= 500 &&
    draft.ids.every((id) => typeof id === 'string') &&
    Number.isInteger(draft.revision)
  );
};

export function CollectionWorkbench({
  list,
  items,
  logs,
  onClose,
  onOpenItem,
}: {
  list: ListDetail;
  items: Item[];
  logs: Log[];
  onClose: () => void;
  onOpenItem: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>('rank');
  const draft = useDraft<RankingDraft>(
    `workbench:${list.id}`,
    { ids: list.rankedIds, revision: list.rankRevision },
    validDraft,
  );
  const order = cleanOrder(draft.form.ids, items);
  const changed = JSON.stringify(order) !== JSON.stringify(list.rankedIds);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [history, setHistory] = useState<Comparison[]>([]);
  const [blind, setBlind] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState('');
  const client = useQueryClient();
  const apply = useMutation({
    mutationFn: () => api.rank(list.id, order, draft.form.revision),
    onError: () => {
      void client.invalidateQueries({ queryKey: ['list', list.id] });
      void client.invalidateQueries({ queryKey: ['items', list.id] });
    },
    onSuccess: ({ list: saved }) => {
      draft.clear({ ids: saved.rankedIds, revision: saved.rankRevision });
      draft.setForm({ ids: saved.rankedIds, revision: saved.rankRevision });
      client.setQueryData(['list', list.id], { list: saved });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      setConfirmApply(false);
      setStatus('Ranking applied. Calls and revisit plans are unchanged.');
    },
  });
  const requestClose = () => {
    if (apply.isPending) return;
    if (changed || comparison) setConfirmClose(true);
    else onClose();
  };
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const byId = new Map(items.map((item) => [item.id, item]));
  const pair = comparison ? comparisonPair(comparison) : null;
  const comparisonIds = items.length > 500 ? order : items.map((item) => item.id);
  const comparisonStale = comparison
    ? [...comparison.ordered, ...comparison.pending].some((id) => !byId.has(id))
    : false;
  const setOrder = (ids: string[]) => {
    draft.setForm((current) => ({ ...current, ids }));
    setStatus('');
    apply.reset();
  };
  const answer = (choice: 'first' | 'second' | 'skip') => {
    if (!comparison) return;
    setHistory((previous) => [...previous, comparison]);
    setComparison(answerComparison(comparison, choice));
  };
  return (
    <>
      <dialog
        ref={dialog}
        className="editor-dialog workbench-dialog"
        aria-labelledby="workbench-title"
        onCancel={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onClose={() => {
          if (!dialog.current?.open) onClose();
        }}
      >
        <div className="workbench-head">
          <div>
            <p className="overline">{list.name}</p>
            <h2 id="workbench-title">A little perspective.</h2>
          </div>
          <button className="button button-outline" onClick={requestClose} disabled={apply.isPending}>
            Close workbench
          </button>
        </div>
        <p>Try a different order, compare records, or make something to keep.</p>
        <nav className="workbench-tabs" aria-label="Workbench tools">
          {(
            [
              ['rank', 'Ranking sandbox'],
              ['compare', 'Comparison table'],
              ['draw', 'Decision draw'],
              ['publish', 'Booklets & cards'],
              ['shelf', 'Your shelf'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
              {label}
            </button>
          ))}
        </nav>
        {mode === 'publish' && <CollectionPublishing list={list} items={items} />}
        {mode === 'shelf' && (
          <CollectionShelf
            list={list}
            items={items}
            onOpen={(id) => {
              if (changed) {
                setStatus('Keep or discard your ranking draft before opening a record.');
                setMode('rank');
              } else {
                onClose();
                onOpenItem(id);
              }
            }}
          />
        )}
        {mode === 'rank' && (
          <section aria-label="Ranking sandbox" className="workbench-section">
            <p>
              Your saved ranking changes only when you preview and apply this order. Unlisted items stay
              unranked.
            </p>
            {draft.status && (
              <p className="draft-status" role="status">
                {draft.status}
              </p>
            )}
            {draft.form.revision !== list.rankRevision && (
              <p className="error-banner" role="alert">
                The saved ranking changed elsewhere. Reset to the current ranking before applying a new order.
              </p>
            )}
            <div className="data-actions">
              <button
                className="button button-outline"
                onClick={() => {
                  setOrder(list.rankedIds);
                  draft.clear({ ids: list.rankedIds, revision: list.rankRevision });
                  draft.setForm({ ids: list.rankedIds, revision: list.rankRevision });
                  setComparison(null);
                  setHistory([]);
                  setRevealed(false);
                }}
              >
                Reset to saved ranking
              </button>
              <button
                className="button button-outline"
                disabled={comparisonIds.length < 2}
                onClick={() => {
                  setComparison(startComparison(shuffled(comparisonIds)));
                  setHistory([]);
                  setRevealed(false);
                }}
              >
                Start head-to-head
              </button>
              <label className="workbench-check">
                <input type="checkbox" checked={blind} onChange={(event) => setBlind(event.target.checked)} />
                Hide existing ranks and calls during comparisons
              </label>
            </div>
            {items.length > 500 && (
              <p>
                Rankings hold up to 500 items. For this larger collection, head-to-head uses the items you add
                to the draft.
              </p>
            )}
            {comparisonStale && (
              <div role="alert">
                <p>
                  A record left the collection during this comparison. Start again with the current records.
                </p>
                <button
                  className="button button-outline"
                  onClick={() => {
                    setComparison(null);
                    setHistory([]);
                    setRevealed(false);
                  }}
                >
                  End comparisons
                </button>
              </div>
            )}
            {comparison && !comparisonStale && (
              <section className="comparison-round" aria-label="Head-to-head ranking">
                <h3>{pair ? 'Which would you choose?' : 'Your new order is ready.'}</h3>
                <p>
                  {comparison.ordered.length} placed · {comparison.pending.length} to place ·{' '}
                  {comparison.skipped.length} skipped
                </p>
                {pair && (
                  <div className="workbench-pair">
                    {pair.map((id, index) => {
                      const item = byId.get(id);
                      return item ? (
                        <button
                          className="comparison-choice"
                          key={id}
                          onClick={() => answer(index === 0 ? 'first' : 'second')}
                        >
                          {item.hasPhoto && <img src={`/api/items/${id}/photo?v=${item.updatedAt}`} alt="" />}
                          <strong>{item.title}</strong>
                          {item.type && <span>{item.type}</span>}
                          {!blind && (
                            <span>
                              {decisionLabel(item.decision) || 'No call'} ·{' '}
                              {list.rankedIds.includes(id)
                                ? `Saved rank ${list.rankedIds.indexOf(id) + 1}`
                                : 'Unranked'}
                            </span>
                          )}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
                <div className="data-actions">
                  {pair && (
                    <button className="button button-outline" onClick={() => answer('skip')}>
                      Skip this item
                    </button>
                  )}
                  <button
                    className="button button-outline"
                    disabled={!history.length}
                    onClick={() => {
                      setComparison(history[history.length - 1]);
                      setHistory((past) => past.slice(0, -1));
                      setRevealed(false);
                    }}
                  >
                    Undo comparison
                  </button>
                  {!pair && !revealed && (
                    <button className="button button-accent" onClick={() => setRevealed(true)}>
                      Reveal comparison with saved order
                    </button>
                  )}
                  {!pair && revealed && (
                    <button
                      className="button button-accent"
                      onClick={() => {
                        setOrder(comparison.ordered);
                        setComparison(null);
                      }}
                    >
                      Use this order in sandbox
                    </button>
                  )}
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setComparison(null);
                      setHistory([]);
                    }}
                  >
                    End comparisons
                  </button>
                </div>
                {!pair && revealed && (
                  <ol className="workbench-ranking">
                    {comparison.ordered.map((id) => (
                      <li key={id}>
                        <strong>{byId.get(id)?.title}</strong>
                        <span>
                          {list.rankedIds.includes(id)
                            ? `Previously #${list.rankedIds.indexOf(id) + 1}`
                            : 'Previously unranked'}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
            {!(comparison && blind && !revealed) && (
              <>
                <SavedRankings listId={list.id} itemIds={order} items={items} onLoad={setOrder} />
                <ol className="workbench-ranking" aria-label="Draft order">
                  {order.map((id, index) => (
                    <li key={id}>
                      <div>
                        <strong>{byId.get(id)?.title}</strong>
                        <span>
                          {list.rankedIds.includes(id)
                            ? `Saved #${list.rankedIds.indexOf(id) + 1}`
                            : 'Saved as unranked'}
                        </span>
                      </div>
                      <div className="workbench-row-actions">
                        <button
                          aria-label={`Move ${byId.get(id)?.title} up`}
                          disabled={index === 0}
                          onClick={() => setOrder(moveRank(order, id, index))}
                        >
                          ↑
                        </button>
                        <button
                          aria-label={`Move ${byId.get(id)?.title} down`}
                          disabled={index === order.length - 1}
                          onClick={() => setOrder(moveRank(order, id, index + 2))}
                        >
                          ↓
                        </button>
                        <button
                          aria-label={`Leave ${byId.get(id)?.title} unranked`}
                          onClick={() => setOrder(order.filter((value) => value !== id))}
                        >
                          Unrank
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                {!order.length && <p>No items in this draft order. Add one below or start a comparison.</p>}
                <details>
                  <summary>Add unranked items to the draft</summary>
                  <div className="workbench-add">
                    {items
                      .filter((item) => !order.includes(item.id))
                      .map((item) => (
                        <button
                          key={item.id}
                          className="button button-outline"
                          disabled={order.length >= 500}
                          onClick={() => setOrder([...order, item.id])}
                        >
                          Add {item.title}
                        </button>
                      ))}
                  </div>
                </details>
                <div className="data-actions">
                  <button
                    className="button button-accent"
                    disabled={!changed || apply.isPending || draft.form.revision !== list.rankRevision}
                    onClick={() => setConfirmApply(true)}
                  >
                    Preview ranking change
                  </button>
                </div>
              </>
            )}
            {status && <p role="status">{status}</p>}
            {apply.isError && (
              <p className="form-error" role="alert">
                {apply.error.message}
              </p>
            )}
          </section>
        )}
        {mode === 'compare' && <ComparisonTable items={items} logs={logs} />}
        {mode === 'draw' && (
          <DecisionDraw
            items={items}
            onOpen={(id) => {
              if (changed) {
                setStatus('Keep or discard your ranking draft before opening a record.');
                setMode('rank');
              } else {
                onClose();
                onOpenItem(id);
              }
            }}
          />
        )}
      </dialog>
      {confirmApply && (
        <ConfirmDialog
          title="Apply this ranking?"
          description="This replaces the collection’s saved ranking. Calls, Want to try and revisit plans stay unchanged."
          confirmLabel="Apply ranking"
          pending={apply.isPending}
          error={apply.error?.message}
          onConfirm={() => apply.mutate()}
          onClose={() => {
            if (!apply.isPending) setConfirmApply(false);
          }}
        >
          <p>
            Current:{' '}
            {list.rankedIds
              .map((id) => byId.get(id)?.title)
              .filter(Boolean)
              .join(' → ') || 'No ranked items'}
          </p>
          <p>Proposed: {order.map((id) => byId.get(id)?.title).join(' → ') || 'All items unranked'}</p>
        </ConfirmDialog>
      )}
      {confirmClose && (
        <ConfirmDialog
          title="Keep this ranking draft?"
          description="The sandbox order can be kept on this device for seven days. Comparisons in progress are not saved. Your collection’s saved ranking is unchanged."
          confirmLabel="Keep draft and close"
          onConfirm={onClose}
          onClose={() => setConfirmClose(false)}
        >
          <button
            className="button button-outline"
            onClick={() => {
              draft.clear({ ids: list.rankedIds, revision: list.rankRevision });
              onClose();
            }}
          >
            Discard draft and close
          </button>
        </ConfirmDialog>
      )}
    </>
  );
}

function ComparisonTable({ items, logs }: { items: Item[]; logs: Log[] }) {
  const [ids, setIds] = useState<string[]>([]);
  const selected = ids.flatMap((id) => items.find((item) => item.id === id) ?? []);
  return (
    <section className="workbench-section" aria-label="Comparison table">
      <p>Choose up to four records. Their notes and photos stay private.</p>
      <fieldset className="workbench-selection">
        <legend>Records to compare · {ids.length}/4</legend>
        {items.map((item) => (
          <label key={item.id} className="workbench-check">
            <input
              type="checkbox"
              checked={ids.includes(item.id)}
              disabled={ids.length === 4 && !ids.includes(item.id)}
              onChange={(event) =>
                setIds(event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))
              }
            />
            {item.title}
          </label>
        ))}
      </fieldset>
      <div className="workbench-cards">
        {selected.map((item) => (
          <article key={item.id} className="workbench-record">
            {item.hasPhoto && (
              <img src={`/api/items/${item.id}/photo?v=${item.updatedAt}`} alt={`${item.title} photo`} />
            )}
            <h3>{item.title}</h3>
            <p>
              {item.type || 'No type'} · {decisionLabel(item.decision) || 'No call'}
            </p>
            <dl>
              <dt>Want to try</dt>
              <dd>{item.wantToTry ? 'Yes' : 'No'}</dd>
              <dt>Revisit queue</dt>
              <dd>{item.revisitQueued ? 'Yes' : 'No'}</dd>
              <dt>Visits</dt>
              <dd>{item.logCount}</dd>
              <dt>Last visit</dt>
              <dd>{item.lastLoggedOn ?? 'Not logged'}</dd>
            </dl>
            {item.note && <p className="workbench-note">{item.note}</p>}
            <ItemContextReadout value={item.context} />
            <details>
              <summary>Visit notes</summary>
              {logs
                .filter((log) => log.itemId === item.id || item.mergedIds?.includes(log.itemId ?? ''))
                .map((log) => (
                  <div key={log.id}>
                    <p>{log.happenedOn}</p>
                    <p className="workbench-note">{log.note || 'No note'}</p>
                  </div>
                ))}
            </details>
          </article>
        ))}
      </div>
      {!selected.length && <p>Select records above to put them on the table.</p>}
    </section>
  );
}

function DecisionDraw({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const result = useRef<HTMLDivElement>(null);
  const revealOnPhone = useRef(false);
  const [mode, setMode] = useState<'want' | 'queue' | 'favorite'>('want');
  const [type, setType] = useState('');
  const [remaining, setRemaining] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const candidates = drawCandidates(items, mode, type);
  const item = candidates.find((record) => record.id === picked);
  const reset = () => {
    setPicked(null);
    setRemaining([]);
  };
  useEffect(() => {
    if (!picked || !revealOnPhone.current || !window.matchMedia('(max-width: 680px)').matches) return;
    revealOnPhone.current = false;
    const frame = requestAnimationFrame(() =>
      result.current?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [picked]);
  function draw(pointer: boolean) {
    revealOnPhone.current = pointer;
    const available = remaining.filter((id) => candidates.some((candidate) => candidate.id === id));
    const deck = available.length ? available : shuffled(candidates.map((candidate) => candidate.id));
    setPicked(deck[0] ?? null);
    setRemaining(deck.slice(1));
  }
  return (
    <section className="workbench-section" aria-label="Decision draw">
      <p>A draw from your own records. No calls or rankings change.</p>
      <div className="workbench-filters">
        <label>
          Choose from
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as typeof mode);
              reset();
            }}
          >
            <option value="want">Want to try</option>
            <option value="queue">Revisit queue</option>
            <option value="favorite">Favorites</option>
          </select>
        </label>
        <label>
          Type
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              reset();
            }}
          >
            <option value="">Any type</option>
            {[...new Set(items.map((record) => record.type).filter(Boolean))].sort().map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <p>
        {candidates.length} eligible {candidates.length === 1 ? 'record' : 'records'}. Every record is drawn
        once before the deck starts again.
      </p>
      <button
        className="button button-accent"
        disabled={!candidates.length}
        onClick={(event) => draw(event.detail > 0)}
      >
        {item ? 'Draw another' : 'Draw a record'}
      </button>
      <div ref={result} className="workbench-draw-result" role="status" aria-live="polite">
        {item && (
          <article className="workbench-record" key={item.id}>
            {item.hasPhoto && <img src={`/api/items/${item.id}/photo?v=${item.updatedAt}`} alt="" />}
            <p className="overline">
              {mode === 'want'
                ? 'Something new'
                : mode === 'queue'
                  ? 'On your revisit list'
                  : 'An old favorite'}
            </p>
            <h3>{item.title}</h3>
            <p>{item.type}</p>
            <button className="button button-outline" onClick={() => onOpen(item.id)}>
              Open record
            </button>
          </article>
        )}
      </div>
      {!candidates.length && <p>Add a record to this group, or choose another group or type.</p>}
    </section>
  );
}
