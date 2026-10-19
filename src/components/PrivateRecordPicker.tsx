import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useConnection } from '../hooks/useConnection';
import type { ListSummary } from '../shared/models';
type RecordPick = { id: string; kind: 'item' | 'log'; name: string; detail: string };
export function PrivateRecordPicker({
  disabled,
  onPick,
  helper = 'Choose an existing record or visit. It keeps its own call, rank and content. You can also add an unlinked stop yourself.',
  scopeLabel = 'Add a linked record',
  actionLabel = 'Add to board',
  accessibleVerb = 'Add',
}: {
  disabled: boolean;
  onPick: (row: RecordPick) => void;
  helper?: string;
  scopeLabel?: string;
  actionLabel?: string;
  accessibleVerb?: string;
}) {
  const online = useConnection();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [archived, setArchived] = useState(false),
    [choice, setChoice] = useState(''),
    [loaded, setLoaded] = useState<ListSummary | null>(null),
    [filter, setFilter] = useState(''),
    [limit, setLimit] = useState(50);
  const old = useQuery({ queryKey: ['archived-lists'], queryFn: api.archivedLists, enabled: archived });
  const choices = [...(lists.data?.lists ?? []), ...(archived ? (old.data?.lists ?? []) : [])];
  const sources = useQuery({
    queryKey: ['board-source-picker', loaded?.id],
    enabled: !!loaded,
    queryFn: async () => {
      const [items, logs] = await Promise.all([
        loaded!.kind === 'collection' ? api.items(loaded!.id) : Promise.resolve({ items: [] }),
        api.logs(loaded!.id),
      ]);
      const itemNames = new Map(items.items.map((item) => [item.id, item.title]));
      return [
        ...items.items.map((item) => ({
          id: item.id,
          kind: 'item' as const,
          name: item.title,
          detail: item.type,
        })),
        ...logs.logs.map((log) => ({
          id: log.id,
          kind: 'log' as const,
          name: log.title || itemNames.get(log.itemId ?? '') || 'Visit',
          detail: log.happenedOn,
        })),
      ];
    },
  });
  const matching = (sources.data ?? []).filter((row) =>
    `${row.name} ${row.detail}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );
  return (
    <section className="board-source-picker" aria-label={scopeLabel}>
      <h3>Add from your archive</h3>
      <p>{helper}</p>
      <label className="board-check">
        <input
          type="checkbox"
          checked={archived}
          disabled={disabled}
          onChange={(event) => {
            setArchived(event.target.checked);
            if (!event.target.checked && loaded?.archived) {
              setChoice('');
              setLoaded(null);
            }
          }}
        />
        Include archived collections in these choices
      </label>
      {lists.isError && (
        <p role="alert">
          {lists.error.message}
          <button className="button button-outline" onClick={() => void lists.refetch()}>
            Retry collections
          </button>
        </p>
      )}
      {archived && old.isError && (
        <p role="alert">
          {old.error.message}
          <button className="button button-outline" onClick={() => void old.refetch()}>
            Retry archived collections
          </button>
        </p>
      )}
      <div className="board-source-controls">
        <label>
          Collection or activity
          <select
            value={choice}
            disabled={disabled}
            onChange={(event) => {
              setChoice(event.target.value);
              setLoaded(null);
              setFilter('');
              setLimit(50);
            }}
          >
            <option value="">Choose a collection or activity</option>
            {choices.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
                {list.archived ? ' · Archived' : ''}
                {list.kind === 'activity' ? ' · Activity' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-outline"
          disabled={disabled || !choice || !online}
          onClick={() => {
            if (loaded?.id === choice) void sources.refetch();
            else {
              setLoaded(choices.find((list) => list.id === choice) ?? null);
              setFilter('');
              setLimit(50);
            }
          }}
        >
          Load records and visits
        </button>
      </div>
      {sources.isFetching && <p role="status">Opening saved records and visits…</p>}
      {sources.isError && (
        <p role="alert">
          {sources.error.message}
          <button
            className="button button-outline"
            disabled={disabled || !online}
            onClick={() => void sources.refetch()}
          >
            Retry records and visits
          </button>
        </p>
      )}
      {sources.data && (
        <>
          <p>
            {loaded?.name}
            {loaded?.archived ? ' · Archived' : ''}
          </p>
          <label>
            Find a record or visit
            <input
              value={filter}
              maxLength={120}
              disabled={disabled}
              onChange={(event) => {
                setFilter(event.target.value);
                setLimit(50);
              }}
            />
          </label>
          {!matching.length && <p>No records or visits match these choices.</p>}
          <ul className="board-source-results">
            {matching.slice(0, limit).map((row) => (
              <li key={`${row.kind}:${row.id}`}>
                <div>
                  <strong>{row.name}</strong>
                  <span>
                    {row.kind === 'log' ? 'Visit' : 'Record'}
                    {row.detail ? ` · ${row.detail}` : ''}
                  </span>
                </div>
                <button
                  className="button button-outline"
                  disabled={disabled}
                  aria-label={`${accessibleVerb} ${row.kind === 'log' ? 'visit' : 'record'} ${row.name}${row.detail ? ` · ${row.detail}` : ''}`}
                  onClick={() => onPick(row)}
                >
                  {actionLabel}
                </button>
              </li>
            ))}
          </ul>
          {matching.length > limit && (
            <button
              className="button button-outline"
              disabled={disabled}
              onClick={() => setLimit(limit + 50)}
            >
              Show more records and visits
            </button>
          )}
        </>
      )}
    </section>
  );
}
