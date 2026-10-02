import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GearSix, Plus, PresentationChart, ShareNetwork, X } from '@phosphor-icons/react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api';
import { CollectionView } from '../components/CollectionView';
import { ActivityView } from '../components/ActivityView';
import { ItemEditor } from '../components/ItemEditor';
import { ShareDialog } from '../components/ShareDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function ListPage() {
  const { listId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const listQuery = useQuery({
    queryKey: ['list', listId],
    queryFn: () => api.list(listId),
    enabled: Boolean(listId),
  });
  const list = listQuery.data?.list;
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

  useEffect(() => {
    setSelectedId(focus?.startsWith('item:') ? focus.slice('item:'.length) : null);
    setShowSettings(false);
  }, [focus, listId]);

  function closeEditor() {
    setSelectedId(null);
    if (creating || focus) setParams({}, { replace: true });
  }

  if (listQuery.isPending) return <main className="light-page page-width loading-line">Opening list…</main>;
  if (listQuery.isError || !list)
    return (
      <main className="light-page page-width error-page">
        <h1>List not found.</h1>
        <Link to="/lists">Back to lists</Link>
      </main>
    );

  const items = itemsQuery.data?.items ?? [];
  const logs = logsQuery.data?.logs ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <main className={`light-page list-page page-width ${list.kind}-list-page`}>
      <Link className="back-link" to="/lists">
        <ArrowLeft size={16} /> All lists
      </Link>
      <section className="list-page-head">
        <div>
          <p className="overline">{list.kind === 'collection' ? 'YOUR COLLECTION' : 'YOUR ACTIVITY'}</p>
          <h1>{list.name}</h1>
          <p>
            {list.description ||
              (list.kind === 'collection' ? 'Things you want to remember.' : 'A record of when it happened.')}
          </p>
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
            onClick={() => setShowSettings((value) => !value)}
          >
            <GearSix size={20} />
          </button>
          <button className="button button-accent" onClick={() => setParams({ new: '1' })}>
            <Plus size={18} /> {list.kind === 'collection' ? 'Add item' : 'Add log'}
          </button>
        </div>
      </section>

      {showSettings && (
        <ListSettings
          listId={listId}
          name={list.name}
          description={list.description}
          onClose={() => setShowSettings(false)}
          onDeleted={() => navigate('/lists')}
        />
      )}

      {list.kind === 'collection' ? (
        <>
          {itemsQuery.isPending || logsQuery.isPending ? (
            <p className="loading-line">Loading collection…</p>
          ) : itemsQuery.isError || logsQuery.isError ? (
            <p className="error-banner">
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
              list={list}
              items={items}
              onSelect={setSelectedId}
              onAdd={() => setParams({ new: '1' })}
            />
          )}
          {(creating || selected) && (
            <ItemEditor
              listId={listId}
              item={creating ? null : selected}
              logs={logs}
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
          onNew={() => setParams({ new: '1' })}
        />
      )}
    </main>
  );
}

function ListSettings({
  listId,
  name,
  description,
  onClose,
  onDeleted,
}: {
  listId: string;
  name: string;
  description: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const client = useQueryClient();
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cleanName = nextName.trim();
  const cleanDescription = nextDescription.trim();
  const hasChanges = cleanName !== name || cleanDescription !== description;
  const update = useMutation({
    mutationFn: () => api.updateList(listId, { name: cleanName, description: cleanDescription }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteList(listId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      onDeleted();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (cleanName && hasChanges) update.mutate();
  }

  return (
    <section className="settings-panel">
      <div className="panel-title">
        <div>
          <p className="overline">LIST SETTINGS</p>
          <h2>{name}</h2>
        </div>
        <button className="icon-button" aria-label="Close settings" onClick={onClose}>
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
        <button className="button button-dark" disabled={!cleanName || !hasChanges || update.isPending}>
          Save changes
        </button>
        {update.isError && (
          <p className="form-error" id="list-settings-error" role="alert">
            {update.error.message}
          </p>
        )}
      </form>
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
    </section>
  );
}
