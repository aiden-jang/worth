import { useState } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { cleanOrder } from '../shared/workbench';
import type { Item } from '../shared/models';
import { ConfirmDialog } from './ConfirmDialog';

export function SavedRankings({
  listId,
  itemIds,
  items,
  onLoad,
}: {
  listId: string;
  itemIds: string[];
  items: Item[];
  onLoad: (ids: string[]) => void;
}) {
  const { query, mutation } = useWorkspace(listId);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [loadId, setLoadId] = useState<string | null>(null);
  const workspace = query.data?.workspace;
  const duplicate = workspace?.rankings.some(
    (ranking) => ranking.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
  return (
    <details className="saved-rankings">
      <summary>Context rankings{workspace?.rankings.length ? ` · ${workspace.rankings.length}` : ''}</summary>
      <p>
        Save a separate order for best value, special occasions, or any context. Loading one puts it in the
        sandbox; it never replaces your main ranking automatically.
      </p>
      {query.isPending && <p role="status">Loading context rankings…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message} <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      )}
      {workspace && (
        <>
          <form
            className="saved-view-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim() || duplicate || mutation.isPending || workspace.rankings.length >= 20) return;
              mutation.mutate(
                {
                  ...workspace,
                  rankings: [...workspace.rankings, { id: crypto.randomUUID(), name: name.trim(), itemIds }],
                },
                {
                  onSuccess: () => {
                    setName('');
                    setStatus('Context ranking saved.');
                  },
                },
              );
            }}
          >
            <label>
              Context name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Best value"
              />
            </label>
            <button
              className="button button-outline"
              disabled={!name.trim() || duplicate || mutation.isPending || workspace.rankings.length >= 20}
            >
              Save this draft as context ranking
            </button>
          </form>
          {duplicate && <p>A context ranking with that name already exists.</p>}
          {workspace.rankings.length >= 20 && <p>You can keep up to 20 context rankings in a collection.</p>}
          <ul className="saved-view-list">
            {workspace.rankings.map((ranking) => (
              <li key={ranking.id}>
                <button
                  className="button button-outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setLoadId(ranking.id);
                  }}
                >
                  {ranking.name} · {cleanOrder(ranking.itemIds, items).length}
                </button>
                <button
                  className="button button-outline"
                  aria-label={`Remove context ranking ${ranking.name}`}
                  disabled={mutation.isPending}
                  onClick={() => setRemoveId(ranking.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {status && <p role="status">{status}</p>}
      {mutation.isError && (
        <p role="alert">
          {mutation.error.message}{' '}
          <button
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
              mutation.reset();
            }}
          >
            Refresh saved tools
          </button>
        </p>
      )}
      {removeId && workspace && (
        <ConfirmDialog
          title="Remove context ranking?"
          description="This removes this saved alternative order. Your main ranking and records stay unchanged."
          confirmLabel="Remove context ranking"
          pending={mutation.isPending}
          error={mutation.error?.message}
          onClose={() => {
            if (!mutation.isPending) setRemoveId(null);
          }}
          onConfirm={() =>
            mutation.mutate(
              { ...workspace, rankings: workspace.rankings.filter((ranking) => ranking.id !== removeId) },
              {
                onSuccess: () => {
                  setRemoveId(null);
                  setStatus('Context ranking removed.');
                },
              },
            )
          }
        />
      )}
      {loadId && workspace && (
        <ConfirmDialog
          title="Load this context ranking?"
          description="This replaces the sandbox draft order. Your main ranking stays unchanged until you separately preview and apply it."
          confirmLabel="Load into sandbox"
          onClose={() => setLoadId(null)}
          onConfirm={() => {
            const ranking = workspace.rankings.find((entry) => entry.id === loadId);
            if (ranking) {
              onLoad(cleanOrder(ranking.itemIds, items));
              setStatus(`Loaded ${ranking.name} into the sandbox.`);
            }
            setLoadId(null);
          }}
        />
      )}
    </details>
  );
}
