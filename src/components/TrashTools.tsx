import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api, type TrashReference } from '../api';

export function TrashPanel() {
  const query = useQuery({ queryKey: ['trash'], queryFn: api.trash });
  const client = useQueryClient();
  const [status, setStatus] = useState('');
  const restore = useMutation({
    mutationFn: (entry: TrashReference) => api.restoreTrash([entry]),
    onSuccess: () => {
      setStatus(
        'Restored. Items return unranked and Inbox finds return unfiled; list rankings are preserved.',
      );
      void client.invalidateQueries();
    },
  });
  return (
    <section className="data-section" id="trash" aria-labelledby="trash-title">
      <h2 id="trash-title">Trash.</h2>
      <p>
        Restore deleted lists, items, logs and Inbox finds for 30 days. Notes, history and photos stay with
        them. Restore a deleted list or item first to see any records deleted separately inside it.
      </p>
      <p className="data-hint">
        Expired records are permanently removed when Trash is opened. Downloads exclude Trash. Deleting all
        Worth data also permanently clears Trash.
      </p>
      {query.isPending && <p role="status">Opening Trash…</p>}
      {query.isError && (
        <p role="alert" className="form-error">
          {query.error.message}{' '}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {query.data?.entries.length === 0 && <p>Trash is empty.</p>}
      {status && <p role="status">{status}</p>}
      {restore.isError && (
        <p role="alert" className="form-error">
          {restore.error.message}
        </p>
      )}
      <ul className="trash-list">
        {query.data?.entries.map((entry) => (
          <li key={`${entry.kind}:${entry.id}`}>
            <div>
              <strong>{entry.title}</strong>
              <span>
                {entry.kind} · {entry.listName} · recover until{' '}
                {new Date(entry.expiresAt).toLocaleDateString()}
              </span>
            </div>
            <button
              className="button button-outline"
              disabled={restore.isPending}
              onClick={() => restore.mutate({ kind: entry.kind, id: entry.id })}
            >
              Restore<span className="sr-only"> {entry.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrashNotice() {
  const [entries, setEntries] = useState<TrashReference[]>([]);
  const client = useQueryClient();
  const undo = useMutation({
    mutationFn: (refs: TrashReference[]) => api.restoreTrash(refs),
    onSuccess: (_, restored) => {
      setEntries((current) => (JSON.stringify(current) === JSON.stringify(restored) ? [] : current));
      void client.invalidateQueries();
    },
  });
  const { reset: resetUndo } = undo;
  useEffect(() => {
    const listener = (event: Event) => {
      resetUndo();
      setEntries((event as CustomEvent<TrashReference[]>).detail);
      void client.invalidateQueries({ queryKey: ['trash'] });
    };
    const restored = (event: Event) => {
      const refs = (event as CustomEvent<TrashReference[]>).detail;
      setEntries((current) =>
        current.filter((entry) => !refs.some((ref) => ref.kind === entry.kind && ref.id === entry.id)),
      );
    };
    window.addEventListener('worth:trashed', listener);
    window.addEventListener('worth:restored', restored);
    return () => {
      window.removeEventListener('worth:trashed', listener);
      window.removeEventListener('worth:restored', restored);
    };
  }, [client, resetUndo]);
  if (!entries.length) return null;
  return (
    <aside className="trash-notice" aria-label="Deletion recovery">
      <span role="status">Moved to Trash.</span>
      <button
        className="button button-outline"
        disabled={undo.isPending}
        onClick={() => undo.mutate(entries)}
      >
        Undo
      </button>
      <Link to="/settings#trash" onClick={() => setEntries([])}>
        Open Trash
      </Link>
      <button
        className="icon-button"
        aria-label="Dismiss recovery notice"
        disabled={undo.isPending}
        onClick={() => setEntries([])}
      >
        ×
      </button>
      {undo.isError && <p role="alert">{undo.error.message}</p>}
    </aside>
  );
}
