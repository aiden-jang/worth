import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { WidgetDevice } from '../shared/widgets';
import { api } from '../api';
import '../widgets.css';

export function WidgetConnections() {
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState('');
  const client = useQueryClient();
  const owner = client.getQueryData<{ user?: { id: string } }>(['me'])?.user?.id;
  const query = useQuery({
    queryKey: ['widget-devices', owner],
    queryFn: api.widgetDevices,
    enabled: open && !!owner,
    refetchInterval: open ? 60000 : false,
  });
  const revoke = useMutation({
    mutationFn: ({ id }: { id: string; pending: boolean }) => api.revokeWidget(id),
    onSuccess: (_, request) => {
      setStatus(request.pending ? 'Connection request canceled.' : 'Widget access revoked.');
      void client.invalidateQueries({ queryKey: ['widget-devices', owner] });
    },
  });
  const row = (device: WidgetDevice, pending: boolean) => (
    <li key={device.id} className="widget-device">
      <div>
        <h3>{device.name}</h3>
        <p>
          {device.platform === 'ios' ? 'iPhone / iPad' : 'Android'} ·{' '}
          {pending ? 'Pending request' : 'Connected'}
        </p>
        <p>{device.collections.map((c) => c.name).join(' · ') || 'No available collections'}</p>
        <small>Expires {new Date(device.expiresAt).toLocaleString()}</small>
      </div>
      <button
        className="button button-outline"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate({ id: device.id, pending })}
      >
        {pending ? 'Cancel request' : 'Revoke access'}
      </button>
    </li>
  );
  return (
    <details
      className="data-section widget-connections"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Widget connections</summary>
      <p>
        Start a connection in the Worth companion app and choose collections in your browser. Manage its
        read-only access here. Revoking access stops future refreshes; a widget may show its last saved copy
        until it refreshes.
      </p>
      {query.isPending ? (
        <p role="status">Loading connections…</p>
      ) : query.isError ? (
        <p role="alert">
          {query.error.message} <button onClick={() => void query.refetch()}>Try again</button>
        </p>
      ) : (
        <>
          <button
            className="button button-outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Refresh connections
          </button>
          {!query.data.devices.length && !query.data.requests.length && <p>No widget connections.</p>}
          <ul>
            {query.data.devices.map((d) => row(d, false))}
            {query.data.requests.map((d) => row(d, true))}
          </ul>
        </>
      )}
      {status && <p role="status">{status}</p>}
      {revoke.isError && (
        <p className="form-error" role="alert">
          {revoke.error.message}
        </p>
      )}
    </details>
  );
}
