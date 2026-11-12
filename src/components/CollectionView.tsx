import { useListWindow } from '../hooks/useListWindow';
import { ExperienceEditor } from './ExperienceEditor';
import '../memories.css';
import { ArrowRight, X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import type { Item, ItemDecision, ListDetail } from '../shared/models';
import { CallFace } from './PersonalCall';
import { personalCalls, decisionLabel } from '../shared/decisions';
import {
  moveRank,
  visibleItems,
  type DecisionFilter,
  type ItemSort,
  type RankFilter,
} from '../shared/ranking';
import { BlankSlips } from './BlankSlips';
import { IndexRows, ItemPreview } from './CollectionIndex';
import { CollectionTools } from './CollectionTools';
import { ItemSheet } from './ItemSheet';
import { SavedViews } from './SavedViews';
import { FilingMoment } from './FilingMoment';
import type { SavedViewFilters } from '../shared/workspace';
import { brandKey, itemBrand, itemDetailSuggestions, itemIdentity } from '../shared/item-details';
import { matchingSavedItems } from '../shared/capture-assist';
import { itemInput } from '../shared/validation';
import { ConfirmDialog } from './ConfirmDialog';
import { ItemEditor } from './ItemEditor';

type CaptureDraft = {
  title: string;
  batchTitles: string;
  batchMode: boolean;
  wantToTry?: boolean;
  decision?: ItemDecision | null;
  keepSeparate?: boolean;
  parkedDecision?: ItemDecision | null;
  pendingItem?: { title: string; decision: ItemDecision | null; wantToTry: boolean };
};

type BrowseMode = 'all' | 'kept' | 'tried' | 'revisited' | 'not-opened-lately' | 'queue' | 'want';

const browseModes: { id: BrowseMode; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kept', label: 'Favorites' },
  { id: 'tried', label: 'Tried' },
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
  const [experienceOpen, setExperienceOpen] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);
  const [captureDetailsOpen, setCaptureDetailsOpen] = useState(false);
  const [trashTarget, setTrashTarget] = useState<Item | null>(null);
  const entryMenu = useRef<HTMLDetailsElement>(null);
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
        (!('wantToTry' in value) || typeof value.wantToTry === 'boolean') &&
        (!('keepSeparate' in value) || typeof value.keepSeparate === 'boolean') &&
        (!('parkedDecision' in value) ||
          value.parkedDecision === undefined ||
          value.parkedDecision === null ||
          personalCalls.some((call) => call.value === value.parkedDecision)) &&
        (!('pendingItem' in value) ||
          value.pendingItem === undefined ||
          itemInput.safeParse(value.pendingItem).success) &&
        (!('decision' in value) ||
          value.decision === null ||
          personalCalls.some((call) => call.value === value.decision)),
      ),
  );
  const { title, batchTitles, batchMode } = captureDraft.form;
  const setTitle = (title: string) =>
    captureDraft.setForm((current) => ({ ...current, title, keepSeparate: false }));
  const captureMatches = matchingSavedItems(items, title);
  const captureDuplicate =
    !batchMode &&
    !captureDraft.form.pendingItem &&
    captureMatches.length > 0 &&
    !captureDraft.form.keepSeparate;
  const [discardCapture, setDiscardCapture] = useState(false);
  const setBatchTitles = (batchTitles: string) =>
    captureDraft.setForm((current) => ({ ...current, batchTitles }));
  const setBatchMode = (next: boolean | ((current: boolean) => boolean)) =>
    captureDraft.setForm((current) => ({
      ...current,
      batchMode: typeof next === 'function' ? next(current.batchMode) : next,
    }));
  const online = useConnection();
  const [browse, setBrowse] = useViewPreference<BrowseMode>(`collection:${list.id}:browse`, 'all');
  const [showFilters, setShowFilters] = useViewPreference(`collection:${list.id}:showFilters`, false);
  const [search, setSearch] = useViewPreference(`collection:${list.id}:search`, '');
  const [addedSince, setAddedSince] = useViewPreference(`collection:${list.id}:addedSince`, '');
  const [addedBefore, setAddedBefore] = useViewPreference(`collection:${list.id}:addedBefore`, '');
  const [visits, setVisits] = useViewPreference<SavedViewFilters['visits']>(
    `collection:${list.id}:visits`,
    'all',
  );
  const [type, setType] = useViewPreference(`collection:${list.id}:type`, 'all');
  const [brand, setBrand] = useViewPreference(`collection:${list.id}:brand`, '');
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
  const [selecting, setSelecting] = useState(false);
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [filing, setFiling] = useState({ sequence: 0, count: 0, message: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewInSheet, setPreviewInSheet] = useState(() => matchMedia('(max-width: 960px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 960px)');
    const change = () => setPreviewInSheet(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);

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
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]'))
        setSelectedId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedId, setSelectedId]);

  function finishCapture(item: Item) {
    setCaptureDetailsOpen(false);
    captureDraft.clear({
      ...captureDraft.form,
      title: '',
      decision: null,
      parkedDecision: null,
      wantToTry: false,
      pendingItem: undefined,
    });
    captureDraft.operationId.current = crypto.randomUUID();
    setTitle('');
    captureDraft.setForm((current) => ({
      ...current,
      decision: null,
      parkedDecision: null,
      wantToTry: false,
      pendingItem: undefined,
    }));
    setBrowse('all');
    setSearch('');
    setAddedSince('');
    setAddedBefore('');
    setVisits('all');
    setType('all');
    setBrand('');
    setLabel('');
    setStamp('');
    setRankFilter('all');
    setDecisionFilter('all');
    setSort('rank');
    setSelectedId(null);
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
  }

  const create = useMutation({
    mutationFn: (nextTitle: string) =>
      api.createItem(
        list.id,
        {
          title: captureDraft.form.pendingItem?.title ?? nextTitle,
          type: '',
          note: '',
          decision: captureDraft.form.pendingItem ? captureDraft.form.pendingItem.decision : null,
          wantToTry: captureDraft.form.pendingItem?.wantToTry ?? false,
          startedOn: null,
          endedOn: null,
        },
        captureDraft.operationId.current,
      ),
    onSuccess: ({ item }) => finishCapture(item),
  });

  const batchCreate = useMutation({
    mutationFn: (nextTitles: string[]) =>
      api.createItems(list.id, nextTitles, captureDraft.operationId.current, false),
    onSuccess: ({ items: created }) => {
      captureDraft.clear({ ...captureDraft.form, batchTitles: '', wantToTry: false, decision: null });
      captureDraft.operationId.current = crypto.randomUUID();
      setBatchTitles('');
      setBrowse('all');
      setSearch('');
      setAddedSince('');
      setAddedBefore('');
      setVisits('all');
      setType('all');
      setBrand('');
      setLabel('');
      setStamp('');
      setRankFilter('all');
      setDecisionFilter('all');
      setSort('rank');
      setSelectedId(null);
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

  const [rankFocus, setRankFocus] = useState<{
    itemId: string;
    opener: HTMLElement;
    revision: number | null;
  } | null>(null);
  const rank = useMutation({
    mutationFn: ({ item, position }: { item: Item; position: number | null }) =>
      api.rank(list.id, moveRank(list.rankedIds, item.id, position), list.rankRevision),
    onMutate: () => ({
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    }),
    onSuccess: ({ list: next }) => {
      setStatus('Ranking saved.');
      client.setQueryData(['list', list.id], { list: next });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: async (error) => {
      if (error instanceof RequestError && error.status === 409) {
        setStatus('The ranking changed in another tab, so the latest order has been restored.');
        await client.invalidateQueries({ queryKey: ['list', list.id] });
      }
    },
    onSettled: (data, _error, { item }, context) => {
      if (context?.opener?.closest<HTMLElement>('.collection-index-row')?.dataset.itemId !== item.id) return;
      setRankFocus({ itemId: item.id, opener: context.opener, revision: data?.list.rankRevision ?? null });
    },
  });
  useLayoutEffect(() => {
    if (!rankFocus || (rankFocus.revision !== null && list.rankRevision !== rankFocus.revision)) return;
    setRankFocus(null);
    if (
      document.querySelector('dialog[open]') ||
      (document.activeElement !== document.body && document.activeElement !== rankFocus.opener)
    )
      return;
    const row = [...document.querySelectorAll<HTMLElement>('.collection-index-row')].find(
      (node) => node.dataset.itemId === rankFocus.itemId,
    );
    const target = row?.querySelector<HTMLElement>('.collection-row-options > summary');
    target?.focus({ preventScroll: true });
    // Follow the row after the saved ranking has reached the rendered list.
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [rankFocus, list.rankRevision]);

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
  const call = useMutation({
    mutationFn: ({ item, decision }: { item: Item; decision: ItemDecision | null }) =>
      api.updateItem(item.id, { decision }),
    onSuccess: ({ item }) => {
      client.setQueryData<{ items: Item[] }>(['items', list.id], (current) => ({
        items: (current?.items ?? []).map((value) => (value.id === item.id ? item : value)),
      }));
      setStatus(
        item.decision
          ? `${decisionLabel(item.decision)} saved for ${item.title}.`
          : `Call cleared for ${item.title}.`,
      );
      for (const key of ['items', 'item', 'list', 'lists', 'overview', 'patterns', 'search'])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const rankedIds = new Set(list.rankedIds);
  const types = Array.from(new Set(items.map((item) => item.type).filter(Boolean))).sort();
  const brands = itemDetailSuggestions(items, 'brand');
  const hasAdvancedFilters =
    Boolean(label || stamp || brand) ||
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
    if (brand && brandKey(itemBrand(item.context)) !== brandKey(brand)) return false;
    if (label && !item.context?.labels.includes(label)) return false;
    if (stamp && !item.context?.stamps.includes(stamp)) return false;
    if (addedSince || addedBefore) {
      const added = new Date(item.createdAt).toLocaleDateString('en-CA');
      if ((addedSince && added < addedSince) || (addedBefore && added > addedBefore)) return false;
    }
    if (
      (visits === 'never' && item.logCount !== 0) ||
      (visits === 'once' && item.logCount !== 1) ||
      (visits === 'again' && item.logCount <= 1)
    )
      return false;
    if (browse === 'want') return Boolean(item.wantToTry);
    if (browse === 'tried') return !item.wantToTry && (item.decision !== null || item.logCount > 0);
    if (browse === 'queue') return Boolean(item.revisitQueued);
    if (browse === 'kept') return item.decision === 'favorite';
    if (browse === 'revisited') return item.logCount > 1;
    if (browse === 'not-opened-lately') return wasOpenedLongAgo(item);
    return true;
  });
  const windowScope = JSON.stringify([
    list.id,
    browse,
    search,
    type,
    brand,
    label,
    stamp,
    rankFilter,
    decisionFilter,
    sort,
    addedSince,
    addedBefore,
    visits,
  ]);
  const ranked = visible.filter((item) => rankedIds.has(item.id));
  const unranked = visible.filter((item) => !rankedIds.has(item.id));
  const rankedWindow = useListWindow(
    windowScope,
    Math.max(
      ranked.findIndex((item) => item.id === selectedId),
      ranked.findIndex((item) => item.id === rank.variables?.item.id),
    ),
  );
  const unrankedWindow = useListWindow(
    windowScope,
    Math.max(
      unranked.findIndex((item) => item.id === selectedId),
      unranked.findIndex((item) => item.id === rank.variables?.item.id),
    ),
  );
  const shownRanked = ranked.slice(0, rankedWindow.count);
  const shownUnranked = unranked.slice(0, unrankedWindow.count);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || capturePending || captureDuplicate) return;
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
      if (!captureDraft.form.pendingItem)
        captureDraft.checkpoint({
          ...captureDraft.form,
          pendingItem: {
            title: cleanTitle,
            decision: null,
            wantToTry: false,
          },
        });
      create.mutate(cleanTitle);
    }
  }

  const batchEntries = batchCaptureTitles(batchTitles);
  const batchOverLimit = batchEntries.length > batchCaptureLimit;
  const batchHasLongTitle = batchTitles
    .split(/\r?\n/)
    .some((entry) => entry.trim().length > collectionItemTitleLimit);
  const capturePending = create.isPending || batchCreate.isPending;
  const captureLocked = capturePending || !!captureDraft.form.pendingItem;
  useEffect(() => {
    if (capturePending || captureDetailsOpen || !restoreCaptureFocus.current) return;
    const field = restoreCaptureFocus.current === 'batch' ? batchCaptureRef.current : captureRef.current;
    restoreCaptureFocus.current = null;
    field?.focus();
  }, [capturePending, captureDetailsOpen]);
  const selectedItem = items.find((item) => item.id === selectedId);
  const remove = useMutation({
    mutationFn: (item: Item) => api.deleteItem(item.id),
    onSuccess: (_, item) => {
      setTrashTarget(null);
      if (selectedId === item.id) setSelectedId(null);
      void client.invalidateQueries();
      requestAnimationFrame(() => captureRef.current?.focus());
    },
  });
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
    onTrash: (item: Item) => {
      remove.reset();
      setTrashTarget(item);
    },
    queuePending: queue.isPending,
    rankSlots: items.length,
    onOpenDetails: (id: string) => {
      if (previewInSheet) setSelectedId(null);
      onOpenDetails(id);
    },
    onAddNote: (id: string) => {
      setSelectedId(null);
      onAddNote(id);
    },
    onLogRevisit: (id: string) => {
      setSelectedId(null);
      onLogRevisit(id);
    },
    onRank: (item: Item, position: number | null) => {
      setStatus('');
      rank.mutate({ item, position });
    },
    rankPending: rank.isPending,
    onCall: (item: Item, decision: ItemDecision | null) => call.mutate({ item, decision }),
    callPending: call.isPending,
    callError: call.isError && call.variables.item.id === selectedId ? call.error.message : '',
  };

  function closeEntryOptions() {
    const menu = entryMenu.current;
    if (!menu) return;
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }

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
              <span className="sr-only">{batchMode ? 'One name per line' : 'Add a name'}</span>
              {batchMode ? (
                <textarea
                  ref={batchCaptureRef}
                  value={batchTitles}
                  maxLength={3660}
                  onChange={(event) => setBatchTitles(event.target.value)}
                  placeholder={'One name per line\nYou can rank them later'}
                  disabled={captureLocked}
                />
              ) : (
                <input
                  ref={captureRef}
                  value={title}
                  maxLength={collectionItemTitleLimit}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Add a name"
                  disabled={captureLocked}
                />
              )}
            </label>
            <button
              className="collection-capture-submit"
              disabled={
                !online ||
                capturePending ||
                captureDuplicate ||
                (batchMode ? !batchEntries.length || batchOverLimit || batchHasLongTitle : !title.trim())
              }
            >
              {capturePending
                ? 'Saving…'
                : captureDraft.form.pendingItem
                  ? 'Retry save'
                  : batchMode
                    ? `Save ${batchEntries.length || ''}`
                    : 'Quick save'}{' '}
              <ArrowRight size={17} />
            </button>
            {!batchMode && (
              <button
                type="button"
                className="collection-capture-details button button-outline"
                disabled={!online || captureLocked || captureDuplicate || !title.trim()}
                onClick={() => setCaptureDetailsOpen(true)}
              >
                Save with details
              </button>
            )}
            {batchMode && (
              <p className="collection-capture-note">
                {batchHasLongTitle
                  ? `Each name can be up to ${collectionItemTitleLimit} characters.`
                  : `${batchEntries.length}/${batchCaptureLimit} names ready. Blank or duplicate lines are ignored.`}
              </p>
            )}
          </form>
          {captureDraft.form.pendingItem && !create.isPending && (
            <p className="quick-entry-helper">
              This capture is waiting for confirmation. Retry to check the same item.{' '}
              <button type="button" onClick={() => setDiscardCapture(true)}>
                Clear pending capture
              </button>
            </p>
          )}
          {!batchMode && !captureDraft.form.pendingItem && captureMatches.length > 0 && (
            <div className="collection-existing-capture">
              <p>Already saved here.</p>
              {captureMatches.slice(0, 3).map((item) => (
                <div className="data-actions" key={item.id}>
                  <span>
                    {item.title}
                    {itemIdentity(item) ? ` · ${itemIdentity(item)}` : ''}
                  </span>
                  <button type="button" disabled={capturePending} onClick={() => setSelectedId(item.id)}>
                    View saved item
                  </button>
                  <button type="button" disabled={capturePending} onClick={() => onLogRevisit(item.id)}>
                    Add another experience
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-pressed={!!captureDraft.form.keepSeparate}
                disabled={capturePending}
                onClick={() =>
                  captureDraft.setForm((current) => ({ ...current, keepSeparate: !current.keepSeparate }))
                }
              >
                {captureDraft.form.keepSeparate ? 'Saving as a separate item ✓' : 'Save as a separate item'}
              </button>
            </div>
          )}
          {experienceOpen && (
            <ExperienceEditor listId={list.id} items={items} onClose={() => setExperienceOpen(false)} />
          )}
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
          {(call.isError ||
            want.isError ||
            queue.isError ||
            (rank.isError && !(rank.error instanceof RequestError && rank.error.status === 409))) && (
            <p className="form-error collection-capture-error" role="alert">
              {call.error?.message ?? want.error?.message ?? queue.error?.message ?? rank.error?.message}
            </p>
          )}
          {status && (
            <p className="collection-capture-status" role="status">
              {filing.message === status && <FilingMoment key={filing.sequence} count={filing.count} />}
              {status}
            </p>
          )}

          {showFilters && (
            <div className="collection-advanced-filters" id="collection-filters">
              <label className="collection-browse-select">
                <span>More views</span>
                <select
                  aria-label="Browse collection"
                  value={browse}
                  onChange={(event) => selectBrowse(event.target.value as BrowseMode)}
                >
                  {browseModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.label} (
                      {mode.id === 'want'
                        ? items.filter((item) => item.wantToTry).length
                        : collectionBrowseCount(mode.id, items)}
                      )
                    </option>
                  ))}
                </select>
              </label>

              {(brands.length > 0 || brand) && (
                <label>
                  <span>Brand or maker</span>
                  <select value={brand} onChange={(event) => setBrand(event.target.value)}>
                    <option value="">Any brand</option>
                    {brand && !brands.includes(brand) && <option>{brand}</option>}
                    {brands.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              )}
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
                    setBrand('');
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

          {selecting && (
            <CollectionTools
              list={list}
              items={items}
              selectedIds={selectionIds}
              visibleIds={[...shownRanked, ...shownUnranked].map((i) => i.id)}
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
            <div className="collection-state-tabs" role="group" aria-label="Collection views">
              {(
                [
                  { id: 'all', label: 'All items' },
                  { id: 'want', label: 'Want to try' },
                  { id: 'tried', label: 'Tried' },
                ] as const
              ).map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  aria-pressed={browse === mode.id}
                  onClick={() => {
                    setBrowse(mode.id);
                    setDecisionFilter('all');
                  }}
                >
                  {mode.label}{' '}
                  <small>
                    {mode.id === 'want'
                      ? items.filter((item) => item.wantToTry).length
                      : collectionBrowseCount(mode.id, items)}
                  </small>
                </button>
              ))}
              {!['all', 'want', 'tried'].includes(browse) && (
                <button type="button" className="collection-extra-view" onClick={() => setBrowse('all')}>
                  {browseModes.find((mode) => mode.id === browse)?.label} <X size={14} />
                </button>
              )}
            </div>
            <div className="collection-call-filters" role="group" aria-label="Filter by personal call">
              {(
                [
                  { value: 'all', label: 'All calls' },
                  ...personalCalls,
                  { value: 'none', label: 'No call' },
                ] as const
              ).map((filter) => {
                const count = items.filter(
                  (item) =>
                    filter.value === 'all' ||
                    (filter.value === 'none' ? item.decision === null : item.decision === filter.value),
                ).length;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={decisionFilter === filter.value && browse !== 'kept'}
                    onClick={() => {
                      setDecisionFilter(filter.value);
                      if (browse === 'kept') setBrowse('all');
                    }}
                  >
                    {filter.value !== 'all' && filter.value !== 'none' && <CallFace value={filter.value} />}
                    {filter.label} <small>{count}</small>
                  </button>
                );
              })}
            </div>
            {
              <div className="cabinet-index-toolbar">
                <div className="collection-search" id="collection-search">
                  <label>
                    <span className="sr-only">Search {list.name}</span>
                    <input
                      value={search}
                      placeholder="Search"
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  {search && (
                    <button type="button" onClick={() => setSearch('')}>
                      <X size={15} /> Clear
                    </button>
                  )}
                </div>
                <div className="collection-utilities">
                  <button
                    className={`collection-search-toggle ${showFilters || hasAdvancedFilters ? 'active' : ''}`}
                    type="button"
                    aria-expanded={showFilters}
                    aria-controls="collection-filters"
                    onClick={() => setShowFilters((current) => !current)}
                  >
                    More filters{hasAdvancedFilters ? ' ·' : ''}
                  </button>
                  <details ref={entryMenu} data-menu className="entry-options">
                    <summary aria-label="Entry options">•••</summary>
                    <div className="entry-options-panel">
                      <button
                        type="button"
                        onClick={() => {
                          closeEntryOptions();
                          setBatchMode((current) => !current);
                          requestAnimationFrame(() =>
                            (batchMode ? captureRef.current : batchCaptureRef.current)?.focus(),
                          );
                        }}
                        disabled={captureLocked}
                      >
                        {batchMode ? 'Add one name' : 'Add several'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeEntryOptions();
                          setExperienceOpen(true);
                        }}
                      >
                        Add experience
                      </button>
                      <button
                        type="button"
                        aria-pressed={selecting}
                        onClick={() => {
                          closeEntryOptions();
                          setSelecting((value) => !value);
                          setSelectionIds(new Set());
                          setSelectedId(null);
                        }}
                      >
                        {selecting ? 'Cancel selection' : 'Select items'}
                      </button>
                      <SavedViews
                        listId={list.id}
                        current={{
                          label,
                          stamp,
                          browse,
                          search,
                          type,
                          brand,
                          rankFilter,
                          decisionFilter,
                          sort,
                          addedSince,
                          addedBefore,
                          visits,
                        }}
                        onApply={(filters) => {
                          closeEntryOptions();
                          setLabel(filters.label);
                          setStamp(filters.stamp);
                          setBrowse(filters.browse);
                          setSearch(filters.search);
                          setType(filters.type);
                          setBrand(filters.brand ?? '');
                          setRankFilter(filters.rankFilter);
                          setDecisionFilter(filters.decisionFilter);
                          setSort(filters.sort);
                          setAddedSince(filters.addedSince);
                          setAddedBefore(filters.addedBefore);
                          setVisits(filters.visits);
                          setSelectedId(null);
                        }}
                      />
                    </div>
                  </details>
                </div>
              </div>
            }
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
                    {items.length > 0 && (browse !== 'all' || search || hasAdvancedFilters) && (
                      <button
                        type="button"
                        onClick={() => {
                          setBrowse('all');
                          setSearch('');
                          setDecisionFilter('all');
                          setType('all');
                          setBrand('');
                          setLabel('');
                          setStamp('');
                          setRankFilter('all');
                          setAddedSince('');
                          setAddedBefore('');
                          setVisits('all');
                          setSort('rank');
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
                      scope={windowScope}
                      items={shownRanked}
                      total={ranked.length}
                      onMore={rankedWindow.showMore}
                      ranks={ranks}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      sheet={previewInSheet}
                      {...rowActions}
                    />
                  )}
                  {unranked.length > 0 && (
                    <section className="collection-unranked" aria-labelledby="unranked-heading">
                      {ranked.length > 0 && <p id="unranked-heading">Unranked · {unranked.length}</p>}
                      <IndexRows
                        scope={windowScope}
                        items={shownUnranked}
                        total={unranked.length}
                        onMore={unrankedWindow.showMore}
                        ranks={ranks}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        sheet={previewInSheet}
                        {...rowActions}
                      />
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        {previewInSheet ? (
          selectedItem && (
            <ItemSheet title={selectedItem.title} onClose={() => setSelectedId(null)}>
              <ItemPreview item={selectedItem} rank={ranks.get(selectedItem.id)} sheet {...rowActions} />
            </ItemSheet>
          )
        ) : selectedItem ? (
          <ItemPreview item={selectedItem} rank={ranks.get(selectedItem.id)} {...rowActions} />
        ) : (
          <aside className="opinion-slip opinion-slip-placeholder" aria-label="Item preview">
            <p className="overline">YOUR CALL</p>
            <BlankSlips />
            <h2>The opinion goes here.</h2>
            <p>Pick an item to see the details or make your call. Very official.</p>
          </aside>
        )}
      </div>
      {captureDetailsOpen && (
        <ItemEditor
          listId={list.id}
          collectionName={list.name}
          item={null}
          items={items}
          logs={[]}
          initialTitle={title}
          draftName={`item:${list.id}:capture:${captureDraft.operationId.current}`}
          onNameChange={setTitle}
          focusLogId={null}
          focusLogComposer={false}
          focusNoteComposer={false}
          onClose={() => setCaptureDetailsOpen(false)}
          onCreated={(id) => {
            const saved = client
              .getQueryData<{ items: Item[] }>(['items', list.id])
              ?.items.find((item) => item.id === id);
            if (saved) finishCapture(saved);
          }}
        />
      )}
      {trashTarget && (
        <ConfirmDialog
          title={`Move ${trashTarget.title} to Trash?`}
          description="The item, attached experiences and private photos stay recoverable in Trash for 30 days. Restored items return unranked."
          confirmLabel="Move to Trash"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onClose={() => setTrashTarget(null)}
          onConfirm={() => remove.mutate(trashTarget)}
        />
      )}
      {discardCapture && (
        <ConfirmDialog
          title="Clear this pending capture?"
          description="The item may already have saved. Check the collection before starting a new copy. This clears only the capture draft on this device."
          confirmLabel="Clear capture draft"
          onClose={() => setDiscardCapture(false)}
          onConfirm={() => {
            const next = { ...captureDraft.form, pendingItem: undefined };
            captureDraft.clear(next);
            captureDraft.setForm(next);
            captureDraft.operationId.current = crypto.randomUUID();
            create.reset();
            setDiscardCapture(false);
          }}
        />
      )}
    </section>
  );
}
