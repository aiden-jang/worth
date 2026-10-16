import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, RequestError } from '../api';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { useViewPreference } from '../hooks/useViewPreference';
import {
  batchCaptureLimit,
  batchCaptureTitles,
  collectionItemTitleLimit,
} from '../shared/collection-capture';
import { collectionBrowseCount, wasOpenedLongAgo } from '../shared/collection-workspace';
import { decisionLabel } from '../shared/decisions';
import type { Item, ListDetail } from '../shared/models';
import {
  moveRank,
  visibleItems,
  type DecisionFilter,
  type ItemSort,
  type RankFilter,
} from '../shared/ranking';
import { BlankSlips } from './BlankSlips';
import { IndexRows, ItemActions } from './CollectionIndex';
import { CollectionTools } from './CollectionTools';
import { CallFace } from './PersonalCall';
import { SavedViews } from './SavedViews';
import { FilingMoment } from './FilingMoment';
import type { SavedViewFilters } from '../shared/workspace';

type CaptureDraft = { title: string; batchTitles: string; batchMode: boolean; wantToTry?: boolean };

type BrowseMode = 'all' | 'kept' | 'revisited' | 'not-opened-lately' | 'queue' | 'want';

const browseModes: { id: BrowseMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kept', label: 'Favorites' },
  { id: 'want', label: 'Want to try' },
  { id: 'queue', label: 'Revisit queue' },
  { id: 'revisited', label: 'Revisited' },
  { id: 'not-opened-lately', label: 'Not opened lately' },
];

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
  const batchCaptureRef = useRef<HTMLTextAreaElement>(null);
  const restoreCaptureFocus = useRef<'single' | 'batch' | null>(null);
  const captureDraft = useDraft<CaptureDraft>(
    `capture:${list.id}`,
    { title: '', batchTitles: '', batchMode: false, wantToTry: false },
    (value): value is CaptureDraft =>
      Boolean(
        value &&
        typeof value === 'object' &&
        'title' in value &&
        typeof value.title === 'string' &&
        'batchTitles' in value &&
        typeof value.batchTitles === 'string' &&
        'batchMode' in value &&
        typeof value.batchMode === 'boolean' &&
        (!('wantToTry' in value) || typeof value.wantToTry === 'boolean'),
      ),
  );
  const { title, batchTitles, batchMode } = captureDraft.form;
  const setTitle = (title: string) => captureDraft.setForm((current) => ({ ...current, title }));
  const setBatchTitles = (batchTitles: string) =>
    captureDraft.setForm((current) => ({ ...current, batchTitles }));
  const setBatchMode = (next: boolean | ((current: boolean) => boolean)) =>
    captureDraft.setForm((current) => ({
      ...current,
      batchMode: typeof next === 'function' ? next(current.batchMode) : next,
    }));
  const online = useConnection();
  const [browse, setBrowse] = useViewPreference<BrowseMode>(`collection:${list.id}:browse`, 'all');
  const [showSearch, setShowSearch] = useViewPreference(`collection:${list.id}:showSearch`, false);
  const [showFilters, setShowFilters] = useViewPreference(`collection:${list.id}:showFilters`, false);
  const [search, setSearch] = useViewPreference(`collection:${list.id}:search`, '');
  const [addedSince, setAddedSince] = useViewPreference(`collection:${list.id}:addedSince`, '');
  const [addedBefore, setAddedBefore] = useViewPreference(`collection:${list.id}:addedBefore`, '');
  const [visits, setVisits] = useViewPreference<SavedViewFilters['visits']>(
    `collection:${list.id}:visits`,
    'all',
  );
  const [type, setType] = useViewPreference(`collection:${list.id}:type`, 'all');
  const [label, setLabel] = useViewPreference(`collection:${list.id}:label`, '');
  const [stamp, setStamp] = useViewPreference(`collection:${list.id}:stamp`, '');
  const [rankFilter, setRankFilter] = useViewPreference<RankFilter>(
    `collection:${list.id}:rankFilter`,
    'all',
  );
  const [decisionFilter, setDecisionFilter] = useViewPreference<DecisionFilter>(
    `collection:${list.id}:decisionFilter`,
    'all',
  );
  const [sort, setSort] = useViewPreference<ItemSort>(`collection:${list.id}:sort`, 'rank');
  const captureWant = Boolean(captureDraft.form.wantToTry);
  const setCaptureWant = (wantToTry: boolean) =>
    captureDraft.setForm((current) => ({ ...current, wantToTry }));
  const [selecting, setSelecting] = useState(false);
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [filing, setFiling] = useState({ sequence: 0, count: 0, message: '' });
  const [selectedId, setSelectedId] = useViewPreference<string | null>(
    `collection:${list.id}:selectedId`,
    null,
  );

  useEffect(() => {
    restoreCaptureFocus.current = null;
    setStatus('');
    setSelecting(false);
    setSelectionIds(new Set());
  }, [list.id]);
  useEffect(() => {
    if (!focusCapture) return;
    requestAnimationFrame(() => (batchMode ? batchCaptureRef.current : captureRef.current)?.focus());
  }, [batchMode, focusCapture, list.id]);
  useEffect(() => {
    const focusCapture = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.toLocaleLowerCase() !== 'c'
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.closest('button, a, [role="button"]')
      )
        return;
      event.preventDefault();
      (batchMode ? batchCaptureRef.current : captureRef.current)?.focus();
    };
    window.addEventListener('keydown', focusCapture);
    return () => window.removeEventListener('keydown', focusCapture);
  }, [batchMode, list.id]);
  useEffect(() => {
    if (!selectedId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedId, setSelectedId]);

  const create = useMutation({
    mutationFn: (nextTitle: string) =>
      api.createItem(
        list.id,
        {
          title: nextTitle,
          type: '',
          note: '',
          decision: null,
          wantToTry: captureWant,
          startedOn: null,
          endedOn: null,
        },
        captureDraft.operationId.current,
      ),
    onSuccess: ({ item }) => {
      captureDraft.clear({ ...captureDraft.form, title: '' });
      captureDraft.operationId.current = crypto.randomUUID();
      setTitle('');
      setBrowse('all');
      setSearch('');
      setAddedSince('');
      setAddedBefore('');
      setVisits('all');
      setType('all');
      setLabel('');
      setStamp('');
      setRankFilter('all');
      setDecisionFilter('all');
      setSort('rank');
      setSelectedId(item.id);
      setStatus(`${item.title} added to ${list.name}.`);
      setFiling((previous) => ({
        sequence: previous.sequence + 1,
        count: 1,
        message: `${item.title} added to ${list.name}.`,
      }));
      void client.invalidateQueries({ queryKey: ['items', list.id] });
      void client.invalidateQueries({ queryKey: ['list', list.id] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      restoreCaptureFocus.current = 'single';
    },
  });

  const batchCreate = useMutation({
    mutationFn: (nextTitles: string[]) =>
      api.createItems(list.id, nextTitles, captureDraft.operationId.current, captureWant),
    onSuccess: ({ items: created }) => {
      captureDraft.clear({ ...captureDraft.form, batchTitles: '' });
      captureDraft.operationId.current = crypto.randomUUID();
      setBatchTitles('');
      setBrowse('all');
      setSearch('');
      setAddedSince('');
      setAddedBefore('');
      setVisits('all');
      setType('all');
      setLabel('');
      setStamp('');
      setRankFilter('all');
      setDecisionFilter('all');
      setSort('rank');
      setSelectedId(created.length === 1 ? (created[0]?.id ?? null) : null);
      setStatus(`${created.length} ${created.length === 1 ? 'item added' : 'items added'} to ${list.name}.`);
      setFiling((previous) => ({
        sequence: previous.sequence + 1,
        count: created.length,
        message: `${created.length} ${created.length === 1 ? 'item added' : 'items added'} to ${list.name}.`,
      }));
      void client.invalidateQueries({ queryKey: ['items', list.id] });
      void client.invalidateQueries({ queryKey: ['list', list.id] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      restoreCaptureFocus.current = 'batch';
    },
  });

  const decide = useMutation({
    mutationFn: ({ item, decision }: { item: Item; decision: Item['decision'] }) =>
      api.updateItem(item.id, { decision }),
    onSuccess: ({ item }) => {
      setStatus(
        item.decision ? `${item.title}: ${decisionLabel(item.decision)}.` : `${item.title}: no call yet.`,
      );
      void client.invalidateQueries({ queryKey: ['items', list.id] });
      void client.invalidateQueries({ queryKey: ['list', list.id] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
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

  const queue = useMutation({
    mutationFn: (item: Item) => api.updateItem(item.id, { revisitQueued: !item.revisitQueued }),
    onSuccess: ({ item }) => {
      client.setQueryData<{ items: Item[] }>(['items', list.id], (current) => ({
        items: (current?.items ?? []).map((value) => (value.id === item.id ? item : value)),
      }));
      setStatus(item.revisitQueued ? 'Added to revisit queue.' : 'Removed from revisit queue.');
      void client.invalidateQueries({ queryKey: ['items', list.id] });
    },
  });
  const want = useMutation({
    mutationFn: (item: Item) => api.updateItem(item.id, { wantToTry: !item.wantToTry }),
    onSuccess: ({ item }) => {
      setStatus(item.wantToTry ? 'Saved to Want to try.' : 'Removed from Want to try.');
      void client.invalidateQueries({ queryKey: ['items', list.id] });
    },
  });
  const rankedIds = new Set(list.rankedIds);
  const types = Array.from(new Set(items.map((item) => item.type).filter(Boolean))).sort();
  const hasAdvancedFilters =
    Boolean(label || stamp) ||
    Boolean(addedSince || addedBefore || visits !== 'all') ||
    type !== 'all' ||
    rankFilter !== 'all' ||
    decisionFilter !== 'all' ||
    sort !== 'rank';
  const ranks = useMemo(() => new Map(list.rankedIds.map((id, index) => [id, index + 1])), [list.rankedIds]);
  const ordered = visibleItems(items, list.rankedIds, {
    search,
    type,
    rankFilter,
    decisionFilter,
    sort,
  });
  const visible = ordered.filter((item) => {
    if (label && !item.context?.labels.includes(label)) return false;
    if (stamp && !item.context?.stamps.includes(stamp)) return false;
    const added = new Date(item.createdAt).toLocaleDateString('en-CA');
    if ((addedSince && added < addedSince) || (addedBefore && added > addedBefore)) return false;
    if (
      (visits === 'never' && item.logCount !== 0) ||
      (visits === 'once' && item.logCount !== 1) ||
      (visits === 'again' && item.logCount <= 1)
    )
      return false;
    if (browse === 'want') return Boolean(item.wantToTry);
    if (browse === 'queue') return Boolean(item.revisitQueued);
    if (browse === 'kept') return item.decision === 'favorite';
    if (browse === 'revisited') return item.logCount > 1;
    if (browse === 'not-opened-lately') return wasOpenedLongAgo(item);
    return true;
  });
  const ranked = visible.filter((item) => rankedIds.has(item.id));
  const unranked = visible.filter((item) => !rankedIds.has(item.id));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || capturePending) return;
    if (batchMode) {
      const titles = batchCaptureTitles(batchTitles);
      if (titles.length) {
        setStatus('');
        batchCreate.mutate(titles);
      }
      return;
    }
    const cleanTitle = title.trim();
    if (cleanTitle) {
      setStatus('');
      create.mutate(cleanTitle);
    }
  }

  const batchEntries = batchCaptureTitles(batchTitles);
  const batchOverLimit = batchEntries.length > batchCaptureLimit;
  const batchHasLongTitle = batchTitles
    .split(/\r?\n/)
    .some((entry) => entry.trim().length > collectionItemTitleLimit);
  const capturePending = create.isPending || batchCreate.isPending;
  useEffect(() => {
    if (capturePending || !restoreCaptureFocus.current) return;
    const field = restoreCaptureFocus.current === 'batch' ? batchCaptureRef.current : captureRef.current;
    restoreCaptureFocus.current = null;
    field?.focus();
  }, [capturePending]);
  const selectedItem = visible.find((item) => item.id === selectedId);
  const rowActions = {
    selection: selecting
      ? {
          ids: selectionIds,
          toggle: (id: string) =>
            setSelectionIds((old) => {
              const next = new Set(old);
              if (next.has(id)) next.delete(id);
              else if (next.size < 100) next.add(id);
              return next;
            }),
        }
      : undefined,
    onWant: (item: Item) => want.mutate(item),
    wantPending: want.isPending,
    onQueue: (item: Item) => queue.mutate(item),
    queuePending: queue.isPending,
    rankSlots: items.length,
    onOpenDetails,
    onAddNote,
    onLogRevisit,
    onDecide: (item: Item, decision: Item['decision']) => {
      setStatus('');
      decide.mutate({ item, decision });
    },
    decisionPending: decide.isPending,
    onRank: (item: Item, position: number | null) => {
      setStatus('');
      rank.mutate({ item, position });
    },
    rankPending: rank.isPending,
  };

  function selectBrowse(next: BrowseMode) {
    setBrowse(next);
    setStatus('');
  }

  return (
    <section className="collection-workspace" aria-label={`${list.name} collection`}>
      <div className={`cabinet-collection-body ${!items.length ? 'cabinet-collection-empty' : ''}`}>
        <div className="cabinet-collection-main">
          <form className="collection-capture" onSubmit={submit}>
            <label>
              <span className="sr-only">{batchMode ? 'One name per line' : 'What did you try?'}</span>
              {batchMode ? (
                <textarea
                  ref={batchCaptureRef}
                  value={batchTitles}
                  maxLength={3660}
                  onChange={(event) => setBatchTitles(event.target.value)}
                  placeholder={'One name per line\nYou can rank them later'}
                  disabled={capturePending}
                />
              ) : (
                <input
                  ref={captureRef}
                  value={title}
                  maxLength={collectionItemTitleLimit}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What did you try?"
                  disabled={capturePending}
                />
              )}
            </label>
            <button
              className="collection-capture-submit"
              disabled={
                !online ||
                capturePending ||
                (batchMode ? !batchEntries.length || batchOverLimit || batchHasLongTitle : !title.trim())
              }
            >
              {capturePending ? 'Keeping…' : batchMode ? `Keep ${batchEntries.length || ''}` : 'Keep it'}{' '}
              <ArrowRight size={17} />
            </button>
            <div className="collection-capture-note">
              <button
                type="button"
                onClick={() => setBatchMode((current) => !current)}
                disabled={capturePending}
              >
                {batchMode ? 'Add one' : 'Add several'}
              </button>
              <p>
                {batchMode
                  ? batchHasLongTitle
                    ? `Each name can be up to ${collectionItemTitleLimit} characters.`
                    : `${batchEntries.length}/${batchCaptureLimit} names ready. Blank or duplicate lines are ignored.`
                  : 'Rank later. No rush.'}
              </p>
            </div>
          </form>
          <label className="capture-want">
            <input
              type="checkbox"
              checked={captureWant}
              disabled={capturePending}
              onChange={(e) => setCaptureWant(e.target.checked)}
            />
            Want to try
          </label>
          {captureDraft.status && (title || batchTitles) && (
            <p className="draft-state" role="status">
              {captureDraft.status}
            </p>
          )}
          {(create.isError || batchCreate.isError) && (
            <p className="form-error collection-capture-error" role="alert">
              {create.error?.message ?? batchCreate.error?.message}
            </p>
          )}
          {batchCreate.error instanceof RequestError && batchCreate.error.status === 409 && (
            <button
              className="button button-outline"
              onClick={() => {
                captureDraft.operationId.current = crypto.randomUUID();
                batchCreate.reset();
                void client.invalidateQueries({ queryKey: ['items', list.id] });
              }}
            >
              Start a new batch
            </button>
          )}
          {(want.isError ||
            queue.isError ||
            decide.isError ||
            (rank.isError && !(rank.error instanceof RequestError && rank.error.status === 409))) && (
            <p className="form-error collection-capture-error" role="alert">
              {want.error?.message ?? queue.error?.message ?? decide.error?.message ?? rank.error?.message}
            </p>
          )}
          {status && (
            <p className="collection-capture-status" role="status">
              {filing.message === status && <FilingMoment key={filing.sequence} count={filing.count} />}
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
                <select
                  value={rankFilter}
                  onChange={(event) => setRankFilter(event.target.value as RankFilter)}
                >
                  <option value="all">Any position</option>
                  <option value="top5">Top 5</option>
                  <option value="top10">Top 10</option>
                  <option value="unranked">Not ranked</option>
                </select>
              </label>
              <label>
                <span>Your call</span>
                <select
                  aria-label="Filter by personal call"
                  value={decisionFilter}
                  onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)}
                >
                  <option value="all">Any call</option>
                  <option value="none">No call</option>
                  <option value="favorite">Favorite</option>
                  <option value="meh">Meh</option>
                  <option value="would_not_again">Not again</option>
                </select>
              </label>
              {(['label', 'stamp'] as const).map((kind) => {
                const choices = [
                  ...new Set(
                    items.flatMap((item) => item.context?.[kind === 'label' ? 'labels' : 'stamps'] ?? []),
                  ),
                ].sort();
                const selected = kind === 'label' ? label : stamp;
                if (!choices.length && !selected) return null;
                return (
                  <label key={kind}>
                    <span>{kind === 'label' ? 'Personal label' : 'Personal stamp'}</span>
                    <select
                      value={selected}
                      onChange={(event) => (kind === 'label' ? setLabel : setStamp)(event.target.value)}
                    >
                      <option value="">Any {kind}</option>
                      {selected && !choices.includes(selected) && <option>{selected}</option>}
                      {choices.map((choice) => (
                        <option key={choice}>{choice}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <label>
                <span>Order</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as ItemSort)}>
                  <option value="rank">My rank</option>
                  <option value="recent">Last opened</option>
                  <option value="name">Name</option>
                  <option value="times">Most visits</option>
                </select>
              </label>
              <label>
                <span>Added since</span>
                <input
                  type="date"
                  value={addedSince}
                  max={addedBefore || undefined}
                  onChange={(event) => setAddedSince(event.target.value)}
                />
              </label>
              <label>
                <span>Added before</span>
                <input
                  type="date"
                  value={addedBefore}
                  min={addedSince || undefined}
                  onChange={(event) => setAddedBefore(event.target.value)}
                />
              </label>
              <label>
                <span>Visits</span>
                <select
                  aria-label="Filter by visit count"
                  value={visits}
                  onChange={(event) => setVisits(event.target.value as SavedViewFilters['visits'])}
                >
                  <option value="all">Any number</option>
                  <option value="never">Never logged</option>
                  <option value="once">Once</option>
                  <option value="again">More than once</option>
                </select>
              </label>
              {hasAdvancedFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setAddedSince('');
                    setAddedBefore('');
                    setVisits('all');
                    setType('all');
                    setLabel('');
                    setStamp('');
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

          <SavedViews
            listId={list.id}
            current={{
              label,
              stamp,
              browse,
              search,
              type,
              rankFilter,
              decisionFilter,
              sort,
              addedSince,
              addedBefore,
              visits,
            }}
            onApply={(filters) => {
              setLabel(filters.label);
              setStamp(filters.stamp);
              setBrowse(filters.browse);
              setSearch(filters.search);
              setType(filters.type);
              setRankFilter(filters.rankFilter);
              setDecisionFilter(filters.decisionFilter);
              setSort(filters.sort);
              setAddedSince(filters.addedSince);
              setAddedBefore(filters.addedBefore);
              setVisits(filters.visits);
              setShowSearch(Boolean(filters.search));
              setSelectedId(null);
            }}
          />
          {selecting && (
            <CollectionTools
              list={list}
              items={items}
              selectedIds={selectionIds}
              visibleIds={visible.map((i) => i.id)}
              onSelection={setSelectionIds}
              onDone={(message) => {
                setStatus(message);
                setSelectionIds(new Set());
                setSelecting(false);
                setSelectedId(null);
              }}
              onClose={() => {
                setSelecting(false);
                setSelectionIds(new Set());
              }}
            />
          )}
          <div className="collection-index-layout">
            {items.length > 0 && (
              <div className="cabinet-index-toolbar">
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
                      <small>
                        {mode.id === 'want'
                          ? items.filter((i) => i.wantToTry).length
                          : collectionBrowseCount(mode.id, items)}
                      </small>
                    </button>
                  ))}
                </nav>

                <div className="collection-utilities">
                  <button
                    type="button"
                    className="collection-search-toggle"
                    aria-pressed={selecting}
                    onClick={() => {
                      setSelecting((v) => !v);
                      setSelectionIds(new Set());
                      setSelectedId(null);
                    }}
                  >
                    {selecting ? 'Cancel selection' : 'Select'}
                  </button>
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
              </div>
            )}
            <div className="collection-index">
              {!visible.length ? (
                <div className={items.length ? 'collection-index-empty' : 'collection-empty-composition'}>
                  {!items.length && <BlankSlips />}
                  <div>
                    <h2>{items.length ? 'No matching items.' : 'Nothing to judge. Yet.'}</h2>
                    <p>
                      {items.length
                        ? 'Try another view or search for a different name.'
                        : 'Add the first thing you tried. A name will do.'}
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
                    {!items.length && (
                      <button
                        className="button button-outline"
                        type="button"
                        onClick={() => (batchMode ? batchCaptureRef.current : captureRef.current)?.focus()}
                      >
                        Add a name <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {ranked.length > 0 && (
                    <IndexRows
                      items={ranked}
                      ranks={ranks}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      {...rowActions}
                    />
                  )}
                  {unranked.length > 0 && (
                    <section className="collection-unranked" aria-labelledby="unranked-heading">
                      {ranked.length > 0 && <p id="unranked-heading">Unranked · {unranked.length}</p>}
                      <IndexRows
                        items={unranked}
                        ranks={ranks}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        {...rowActions}
                      />
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {selectedItem ? (
          <ItemActions item={selectedItem} rank={ranks.get(selectedItem.id)} {...rowActions} />
        ) : items.length > 0 ? (
          <aside className="opinion-slip opinion-slip-empty">
            <CallFace value="meh" arms />
            <h3>Pick an item.</h3>
            <p>You have the floor.</p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
