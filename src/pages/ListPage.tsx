import { usePageTitle } from '../hooks/usePageTitle';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GearSix, Plus, PresentationChart, ShareNetwork, X } from '@phosphor-icons/react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, RequestError } from '../api';
import { CollectionView } from '../components/CollectionView';
import { ActivityView } from '../components/ActivityView';
import { ItemEditor } from '../components/ItemEditor';
import { ShareDialog } from '../components/ShareDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { CollectionArt } from '../shared/models';
import { CollectionArtworkPicker } from '../components/CollectionArtworkPicker';
import { CollectionCoverControl } from '../components/PhotoControl';

export function ListPage() {
  const { listId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const listQuery = useQuery({
    queryKey: ['list', listId],
    queryFn: () => api.list(listId),
    enabled: Boolean(listId),
  });
  const list = listQuery.data?.list;
  usePageTitle(list?.name ?? 'Opening list');
  const itemsQuery = useQuery({
    queryKey: ['items', listId],
    queryFn: () => api.items(listId),
    enabled: list?.kind === 'collection',
  });
  const logsQuery = useQuery({
    queryKey: ['logs', listId],
    queryFn: () => api.logs(listId),
    enabled: Boolean(listId),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const creating = params.get('new') === '1';
  const focus = params.get('focus');
  const focusLogComposer = params.get('log') === '1';
  const focusNoteComposer = params.get('note') === '1';
  const focusCapture = params.get('capture') === '1';
  const focusLogId = focus?.startsWith('log:') ? focus.slice('log:'.length) : null;

  useEffect(() => {
    setSelectedId(focus?.startsWith('item:') ? focus.slice('item:'.length) : null);
    setShowSettings(false);
  }, [focus, listId]);

  function closeEditor() {
    setSelectedId(null);
    if (creating || focus) setParams({}, { replace: true });
  }

  if (listQuery.isPending) return <main className="light-page page-width loading-line">Opening list…</main>;
  if (listQuery.isError) {
    const missing = listQuery.error instanceof RequestError && listQuery.error.status === 404;
    return (
      <main className="light-page page-width error-page">
        <h1>{missing ? 'List not found.' : "Couldn't open this list."}</h1>
        {!missing && (
          <button className="button button-outline" onClick={() => void listQuery.refetch()}>
            Try again
          </button>
        )}
        <Link to="/lists">Back to lists</Link>
      </main>
    );
  }
  if (!list)
    return (
      <main className="light-page page-width error-page">
        <h1>List not found.</h1>
        <Link to="/lists">Back to lists</Link>
      </main>
    );

  const items = itemsQuery.data?.items ?? [];
  const logs = logsQuery.data?.logs ?? [];
  const focusedLog = focusLogId ? (logs.find((log) => log.id === focusLogId) ?? null) : null;
  const selected =
    items.find((item) => item.id === selectedId) ??
    (focusedLog?.itemId ? (items.find((item) => item.id === focusedLog.itemId) ?? null) : null);
  const coverError =
    location.state && typeof location.state === 'object' && 'coverError' in location.state
      ? String(location.state.coverError)
      : '';

  return (
    <main className={`light-page list-page page-width ${list.kind}-list-page`}>
      <Link className="back-link" to={`/lists?kind=${list.kind}`}>
        <ArrowLeft size={16} /> {list.kind === 'collection' ? 'Collections' : 'Activity'}
      </Link>
      <section className="list-page-head">
        <div>
          {list.kind === 'collection' && list.hasCoverPhoto && (
            <img
              className="cabinet-personal-cover"
              src={`/api/lists/${list.id}/cover?v=${list.updatedAt}`}
              alt=""
            />
          )}
          <p className="overline">{list.kind === 'collection' ? 'YOUR COLLECTION' : 'YOUR ACTIVITY'}</p>
          <h1>{list.name}</h1>
          <p className="list-record-count">
            {list.kind === 'collection'
              ? `${list.itemCount} ${list.itemCount === 1 ? 'item' : 'items'}${list.rankedCount ? ` · ${list.rankedCount} ranked` : ''}`
              : `${list.logCount} ${list.logCount === 1 ? 'log' : 'logs'}`}
          </p>
          {list.description && <p className="list-user-description">{list.description}</p>}
        </div>
        <div className="list-head-actions">
          {list.kind === 'collection' && (
            <Link className="button button-outline" to={`/lists/${list.id}/show`}>
              <PresentationChart size={18} /> Show list
            </Link>
          )}
          {list.kind === 'collection' && (
            <button className="button button-outline" onClick={() => setShowShare(true)}>
              <ShareNetwork size={18} /> Share
            </button>
          )}
          <button
            className="icon-button settings-button"
            aria-label="List settings"
            onClick={() => setShowSettings(true)}
          >
            <GearSix size={20} />
          </button>
          {list.kind === 'activity' && (
            <button className="button button-accent" onClick={() => setParams({ new: '1' })}>
              <Plus size={18} /> Add log
            </button>
          )}
        </div>
      </section>
      {coverError && (
        <p className="collection-cover-notice" role="status">
          Collection saved. {coverError}
        </p>
      )}

      {showSettings && (
        <ListSettings
          listId={listId}
          name={list.name}
          description={list.description}
          isCollection={list.kind === 'collection'}
          artwork={list.artwork ?? null}
          hasCoverPhoto={list.hasCoverPhoto}
          updatedAt={list.updatedAt}
          onClose={() => setShowSettings(false)}
          onDeleted={() => navigate('/lists')}
        />
      )}

      {list.kind === 'collection' ? (
        <>
          {itemsQuery.isPending || logsQuery.isPending ? (
            <p className="loading-line">Loading collection…</p>
          ) : itemsQuery.isError || logsQuery.isError ? (
            <p className="error-banner" role="alert">
              Couldn't load this collection.{' '}
              <button
                onClick={() => {
                  void itemsQuery.refetch();
                  void logsQuery.refetch();
                }}
              >
                Try again
              </button>
            </p>
          ) : (
            <CollectionView
              key={listId}
              list={list}
              items={items}
              focusCapture={focusCapture}
              onOpenDetails={setSelectedId}
              onAddNote={(id) => {
                setSelectedId(id);
                setParams({ focus: `item:${id}`, note: '1' });
              }}
              onLogRevisit={(id) => {
                setSelectedId(id);
                setParams({ focus: `item:${id}`, log: '1' });
              }}
            />
          )}
          {(creating || selected) && (
            <ItemEditor
              key={`${listId}:${creating ? 'new' : selected?.id}`}
              listId={listId}
              item={creating ? null : selected}
              rank={selected ? list.rankedIds.indexOf(selected.id) + 1 || undefined : undefined}
              items={items}
              logs={logs}
              focusLogId={focusLogId}
              focusLogComposer={focusLogComposer}
              focusNoteComposer={focusNoteComposer}
              onClose={closeEditor}
              onCreated={(id) => {
                setParams({}, { replace: true });
                setSelectedId(id);
              }}
            />
          )}
          {showShare && <ShareDialog list={list} items={items} onClose={() => setShowShare(false)} />}
        </>
      ) : (
        <ActivityView
          listId={listId}
          logs={logs}
          loading={logsQuery.isPending}
          error={logsQuery.isError}
          onRetry={() => void logsQuery.refetch()}
          newOpen={creating}
          focusLogId={focus?.startsWith('log:') ? focus.slice('log:'.length) : null}
          onCloseNew={closeEditor}
          onNew={(workoutId, exercise = '') =>
            setParams({ new: '1', ...(workoutId ? { workout: workoutId, exercise } : {}) })
          }
        />
      )}
    </main>
  );
}

function ListSettings({
  listId,
  name,
  description,
  isCollection,
  artwork,
  hasCoverPhoto,
  updatedAt,
  onClose,
  onDeleted,
}: {
  listId: string;
  name: string;
  description: string;
  isCollection: boolean;
  artwork: CollectionArt | null;
  hasCoverPhoto: boolean;
  updatedAt: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const client = useQueryClient();
  const [nextArtwork, setNextArtwork] = useState(artwork);
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const cleanName = nextName.trim();
  const cleanDescription = nextDescription.trim();
  const hasChanges =
    cleanName !== name ||
    cleanDescription !== description ||
    JSON.stringify(nextArtwork) !== JSON.stringify(artwork);
  const update = useMutation({
    mutationFn: () =>
      api.updateList(listId, { name: cleanName, description: cleanDescription, artwork: nextArtwork }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteList(listId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      onDeleted();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (cleanName && hasChanges) update.mutate();
  }

  function requestClose() {
    if (hasChanges) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  return (
    <section className="settings-panel">
      <div className="panel-title">
        <div>
          <p className="overline">LIST SETTINGS</p>
          <h2>{name}</h2>
        </div>
        <button className="icon-button" aria-label="Close settings" onClick={requestClose}>
          <X size={19} />
        </button>
      </div>
      <form onSubmit={submit} className="settings-form">
        <label>
          Name
          <input
            required
            maxLength={80}
            value={nextName}
            onChange={(event) => setNextName(event.target.value)}
            aria-describedby={update.isError ? 'list-settings-error' : undefined}
          />
        </label>
        <label>
          Description
          <input
            maxLength={280}
            value={nextDescription}
            onChange={(event) => setNextDescription(event.target.value)}
          />
        </label>
        {isCollection && (
          <CollectionArtworkPicker name={nextName} value={nextArtwork} onChange={setNextArtwork} />
        )}
        {isCollection && hasCoverPhoto && (
          <p className="muted">Your uploaded cover shows first. Artwork appears when you remove it.</p>
        )}
        <button className="button button-accent" disabled={!cleanName || !hasChanges || update.isPending}>
          Save changes
        </button>
        {update.isError && (
          <p className="form-error" id="list-settings-error" role="alert">
            {update.error.message}
          </p>
        )}
      </form>
      {isCollection && (
        <CollectionCoverControl
          listId={listId}
          listName={name}
          artwork={artwork}
          hasCoverPhoto={hasCoverPhoto}
          version={updatedAt}
        />
      )}
      <div className="settings-danger">
        <span>This removes every item and log in this list.</span>
        <button className="text-danger" disabled={remove.isPending} onClick={() => setConfirmingDelete(true)}>
          Delete this list
        </button>
      </div>
      {remove.isError && <p className="form-error">{remove.error.message}</p>}
      {confirmingDelete && (
        <ConfirmDialog
          eyebrow="DELETE LIST"
          title={`Delete ${name}?`}
          description="This permanently removes every item, log, rank, note, and private photo in this list."
          confirmLabel="Delete list"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
      {confirmingDiscard && (
        <ConfirmDialog
          eyebrow="DISCARD CHANGES"
          title="Leave list settings?"
          description="Your changes to this list's name and description will be lost."
          cancelLabel="Keep editing"
          confirmLabel="Discard changes"
          onConfirm={() => {
            setConfirmingDiscard(false);
            onClose();
          }}
          onClose={() => setConfirmingDiscard(false)}
        />
      )}
    </section>
  );
}
