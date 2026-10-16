import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { widgetCallback, widgetConnectRequest, type WidgetAuthorization } from '../shared/widgets';
import '../widgets.css';

export function WidgetConnectPage() {
  usePageTitle('Connect widgets');
  const [params] = useSearchParams();
  const parsed = widgetConnectRequest.safeParse({
    challenge: params.get('challenge'),
    state: params.get('state'),
    platform: params.get('platform'),
    name: params.get('name'),
  });
  return (
    <main className="data-page widget-connect-page">
      <header className="data-heading">
        <p className="overline">YOUR PHONE / YOUR CHOICE</p>
        <h1>Connect widgets.</h1>
      </header>
      {parsed.success ? (
        <ConnectionForm key={params.toString()} request={parsed.data} />
      ) : (
        <section className="data-section">
          <h2>Start from the companion.</h2>
          <p>
            This connection request is incomplete. Open the Worth companion app and start a fresh connection.
          </p>
          <Link to="/settings">Back to settings</Link>
        </section>
      )}
    </main>
  );
}
function ConnectionForm({ request }: { request: Omit<WidgetAuthorization, 'collectionIds'> }) {
  const current = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const archived = useQuery({ queryKey: ['lists', 'archived'], queryFn: api.archivedLists });
  const [selected, setSelected] = useState<string[]>([]);
  const lists = [...(current.data?.lists ?? []), ...(archived.data?.lists ?? [])]
    .filter((l) => l.kind === 'collection')
    .sort((a, b) => a.name.localeCompare(b.name));
  const busy = current.isFetching || archived.isFetching;
  const failed = current.isError || archived.isError;
  const valid = selected.length > 0 && selected.every((id) => lists.some((l) => l.id === id));
  const authorize = useMutation({
    mutationFn: async () => {
      const result = await api.authorizeWidget({ ...request, collectionIds: selected });
      const callback = new URL(result.callback),
        target = new URL(widgetCallback);
      if (
        callback.protocol !== target.protocol ||
        callback.host ||
        callback.pathname !== target.pathname ||
        callback.hash ||
        callback.searchParams.get('state') !== request.state ||
        !/^[A-Za-z0-9_-]{43}$/.test(callback.searchParams.get('code') ?? '') ||
        callback.searchParams.size !== 2
      )
        throw new Error('Could not confirm this connection. Start again from the companion.');
      return result;
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.revokeWidget(authorize.data!.requestId),
    onSuccess: () => authorize.reset(),
  });
  return (
    <section className="data-section widget-approval" aria-label="Widget connection choices">
      <h2>{request.name}</h2>
      <p>
        {request.platform === 'ios' ? 'iPhone / iPad' : 'Android'} companion · access expires after 30 days.
      </p>
      <p>
        Connect only if you started this from the Worth companion app. Choose up to five collections for its
        widgets.
      </p>
      <p>
        Widgets can read the collection names, item names, types and saved order. Notes, visit details,
        sources and photos are not included. Saved finds can use Want to try, the revisit queue or Favorites.
        Names may be visible to anyone who can see your home screen.
      </p>
      {authorize.data ? (
        <div className="widget-approved" role="status">
          <h3>Ready to return.</h3>
          <p>Return to the companion within five minutes to finish. You can revoke its access in Settings.</p>
          <a className="button button-accent" href={authorize.data.callback}>
            Return to Worth companion
          </a>
          <button
            className="button button-outline"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Cancel connection request
          </button>
          {cancel.isError && <p role="alert">{cancel.error.message}</p>}
        </div>
      ) : (
        <>
          {current.isPending || archived.isPending ? (
            <p role="status">Loading your collections…</p>
          ) : failed ? (
            <p role="alert">
              Couldn’t load your collections.{' '}
              <button
                onClick={() => {
                  void current.refetch();
                  void archived.refetch();
                }}
              >
                Try again
              </button>
            </p>
          ) : (
            <fieldset disabled={authorize.isPending} className="widget-collection-choices">
              <legend>Collections this device can read</legend>
              {lists.map((list) => (
                <label key={list.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(list.id)}
                    disabled={!selected.includes(list.id) && selected.length >= 5}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked ? [...ids, list.id] : ids.filter((id) => id !== list.id),
                      )
                    }
                  />
                  <span>
                    {list.name}
                    <small>
                      {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                      {list.archived ? ' · Archived' : ''}
                    </small>
                  </span>
                </label>
              ))}
              {!lists.length && (
                <p>
                  Create a collection before connecting widgets.{' '}
                  <Link to="/lists?kind=collection&create=1">New collection</Link>
                </p>
              )}
            </fieldset>
          )}
          {selected.length > 0 && !valid && (
            <p role="alert">
              A selected collection is unavailable.{' '}
              <button onClick={() => setSelected([])}>Clear choices</button>
            </p>
          )}
          {authorize.isError && (
            <p className="form-error" role="alert">
              {authorize.error.message}{' '}
              <button
                onClick={() => {
                  void current.refetch();
                  void archived.refetch();
                }}
              >
                Refresh collections
              </button>
            </p>
          )}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!valid || busy || failed || authorize.isPending}
              onClick={() => authorize.mutate()}
            >
              {authorize.isPending ? 'Connecting…' : 'Connect widgets'}
            </button>
            <Link className="button button-outline" to="/settings">
              Cancel
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
