import { useState } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import type { SavedViewFilters } from '../shared/workspace';
import { ConfirmDialog } from './ConfirmDialog';

export function SavedViews({
  listId,
  current,
  onApply,
}: {
  listId: string;
  current: SavedViewFilters;
  onApply: (filters: SavedViewFilters) => void;
}) {
  const { query, mutation } = useWorkspace(listId);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const workspace = query.data?.workspace;
  const duplicate = workspace?.views.some(
    (view) => view.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
  return (
    <details className="collection-saved-views">
      <summary>Saved views{workspace?.views.length ? ` · ${workspace.views.length}` : ''}</summary>
      <p>Keep a named set of filters across devices. Applying a view changes only what you see.</p>
      {query.isPending && <p role="status">Loading saved views…</p>}
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
              if (!name.trim() || duplicate || mutation.isPending || workspace.views.length >= 30) return;
              mutation.mutate(
                {
                  ...workspace,
                  views: [
                    ...workspace.views,
                    { id: crypto.randomUUID(), name: name.trim(), filters: current },
                  ],
                },
                {
                  onSuccess: () => {
                    setName('');
                    setStatus('View saved.');
                  },
                },
              );
            }}
          >
            <label>
              View name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="For next weekend"
              />
            </label>
            <button
              className="button button-outline"
              disabled={!name.trim() || duplicate || mutation.isPending || workspace.views.length >= 30}
            >
              Save current view
            </button>
          </form>
          {duplicate && <p>A view with that name already exists. Choose another name.</p>}
          {workspace.views.length >= 30 && <p>You can keep up to 30 views in a collection.</p>}
          <ul className="saved-view-list">
            {workspace.views.map((view) => (
              <li key={view.id}>
                <button
                  className="button button-outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    onApply(view.filters);
                    setStatus(`Applied ${view.name}.`);
                  }}
                >
                  {view.name}
                </button>
                <button
                  className="button button-outline"
                  aria-label={`Remove saved view ${view.name}`}
                  disabled={mutation.isPending}
                  onClick={() => setRemoveId(view.id)}
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
          title="Remove saved view?"
          description="This removes the saved filter preset. It does not delete any records."
          confirmLabel="Remove view"
          pending={mutation.isPending}
          error={mutation.error?.message}
          onClose={() => {
            if (!mutation.isPending) setRemoveId(null);
          }}
          onConfirm={() =>
            mutation.mutate(
              { ...workspace, views: workspace.views.filter((view) => view.id !== removeId) },
              {
                onSuccess: () => {
                  setRemoveId(null);
                  setStatus('View removed.');
                },
              },
            )
          }
        />
      )}
    </details>
  );
}
