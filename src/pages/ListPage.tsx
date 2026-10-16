import { ArrowLeft, GearSix, Plus, PresentationChart, ShareNetwork } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, RequestError } from '../api';
import { ActivityView } from '../components/ActivityView';
import { CollectionView } from '../components/CollectionView';
import { CollectionWorkbench } from '../components/CollectionWorkbench';
import { ItemEditor } from '../components/ItemEditor';
import { ListSettings } from '../components/ListSettings';
import { ShareDialog } from '../components/ShareDialog';
import { usePageTitle } from '../hooks/usePageTitle';

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
  const [showWorkbench, setShowWorkbench] = useState(false);
  const creating = params.get('new') === '1';
  const focus = params.get('focus');
  const focusLogComposer = params.get('log') === '1';
  const focusNoteComposer = params.get('note') === '1';
  const focusCapture = params.get('capture') === '1';
  const focusLogId = focus?.startsWith('log:') ? focus.slice('log:'.length) : null;

  useEffect(() => {
    setSelectedId(focus?.startsWith('item:') ? focus.slice('item:'.length) : null);
    setShowSettings(false);
    setShowShare(false);
    setShowWorkbench(false);
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
    (focusedLog?.itemId
      ? (items.find(
          (item) => item.id === focusedLog.itemId || item.mergedIds?.includes(focusedLog.itemId ?? ''),
        ) ?? null)
      : null);
  const coverError =
    location.state && typeof location.state === 'object' && 'coverError' in location.state
      ? String(location.state.coverError)
      : '';

  return (
    <main className={`light-page list-page page-width ${list.kind}-list-page`}>
      <Link className="back-link" to={`/lists?kind=${list.kind}${list.archived ? '&archived=1' : ''}`}>
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
            <button
              className="button button-outline"
              disabled={
                itemsQuery.isPending || itemsQuery.isError || logsQuery.isPending || logsQuery.isError
              }
              onClick={() => setShowWorkbench(true)}
            >
              Workbench
            </button>
          )}
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
      {list.archived && (
        <div className="collection-archive-notice" role="status">
          <span>Archived collection. You can still open and edit its records.</span>
          <button className="button button-outline" onClick={() => setShowSettings(true)}>
            Open settings to unarchive
          </button>
        </div>
      )}
      {coverError && (
        <p className="collection-cover-notice" role="status">
          Collection saved. {coverError}
        </p>
      )}

      {showSettings && (
        <ListSettings
          listId={listId}
          archived={list.archived ?? false}
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
      {showWorkbench && (
        <CollectionWorkbench
          key={list.id}
          list={list}
          items={items}
          logs={logs}
          onClose={() => setShowWorkbench(false)}
          onOpenItem={setSelectedId}
          onRevisit={(id) => {
            setSelectedId(id);
            setParams({ focus: `item:${id}`, log: '1' });
          }}
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
          {showShare && (
            <ShareDialog key={list.id} list={list} items={items} onClose={() => setShowShare(false)} />
          )}
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
