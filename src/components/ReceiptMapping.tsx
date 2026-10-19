import { Link } from 'react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { ReceiptDraft } from '../shared/receipts';
type Mapping = ReceiptDraft['current']['lines'][number]['mapping'];
export function ReceiptMapping({
  value,
  onChange,
  index,
  disabled,
}: {
  value: Mapping;
  onChange: (value: Mapping) => void;
  index: number;
  disabled: boolean;
}) {
  const [choice, setChoice] = useState(value.mode === 'create' ? value.listId : ''),
    [archived, setArchived] = useState(false);
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists }),
    old = useQuery({
      queryKey: ['archived-lists'],
      queryFn: api.archivedLists,
      enabled: archived,
    });
  const collections = [...(lists.data?.lists ?? []), ...(archived ? (old.data?.lists ?? []) : [])].filter(
    (l) => l.kind === 'collection',
  );
  const items = useQuery({
    queryKey: ['receipt-map-items', choice],
    enabled: !!choice && value.mode === 'existing',
    queryFn: () => api.items(choice),
  });
  const selectedId = value.mode === 'existing' ? value.itemId : '';
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedId);
  const known = items.data?.items.find((item) => item.id === selectedId);
  const selected = useQuery({
    queryKey: ['receipt-map-current', selectedId],
    enabled: validId && !known,
    queryFn: () => api.item(selectedId),
  });
  const currentItem = known ?? selected.data?.item;
  return (
    <section className="receipt-line-mapping" aria-label={`Record choice for line ${index}`}>
      <label>
        Record choice for line {index}
        <select
          disabled={disabled}
          value={value.mode}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === 'none') onChange({ mode });
            else if (mode === 'existing') onChange({ mode, itemId: '' });
            else
              onChange({
                mode: 'create',
                itemId: crypto.randomUUID(),
                listId: '',
                title: '',
              });
            setChoice('');
          }}
        >
          <option value="none">Leave unlinked</option>
          <option value="existing">Link an existing record</option>
          <option value="create">Create a new unranked record</option>
        </select>
      </label>
      {value.mode !== 'none' && (
        <>
          {value.mode === 'existing' && (
            <label className="receipt-check">
              <input
                type="checkbox"
                disabled={disabled}
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Include archived collections in these choices
            </label>
          )}
          <label>
            Collection for line {index}
            <select
              value={value.mode === 'create' ? value.listId : choice}
              disabled={disabled}
              onChange={(e) => {
                setChoice(e.target.value);
                if (value.mode === 'create') onChange({ ...value, listId: e.target.value });
                else onChange({ ...value, itemId: '' });
              }}
            >
              <option value="">Choose a collection</option>
              {collections
                .filter((l) => value.mode === 'existing' || !l.archived)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.archived ? ' · Archived' : ''}
                  </option>
                ))}
            </select>
          </label>
          {value.mode === 'create' ? (
            <label>
              New record name for line {index}
              <input
                disabled={disabled}
                value={value.title}
                maxLength={120}
                onChange={(e) => onChange({ ...value, title: e.target.value })}
              />
            </label>
          ) : (
            <label>
              Existing record for line {index}
              <select
                disabled={disabled || !choice || items.isPending}
                value={value.itemId}
                onChange={(e) => onChange({ ...value, itemId: e.target.value })}
              >
                <option value="">Choose a record</option>
                {value.itemId && !known && (
                  <option value={value.itemId}>
                    {currentItem
                      ? `Current choice: ${currentItem.title}`
                      : selected.isError
                        ? 'Saved choice unavailable'
                        : 'Saved record choice'}
                  </option>
                )}
                {items.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.type ? ` · ${item.type}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {value.mode === 'existing' && value.itemId && (
            <p>
              {currentItem ? (
                <>
                  Current choice: {currentItem.title}.{' '}
                  <Link to={`/lists/${currentItem.listId}?focus=item:${currentItem.id}`}>
                    Review chosen record →
                  </Link>
                </>
              ) : selected.isError ? (
                'The saved record choice is unavailable. Choose another record or leave this line unlinked.'
              ) : !validId ? (
                'Choose a saved record again or leave this line unlinked.'
              ) : (
                'Opening the saved record choice…'
              )}
              {!choice ? ' Choose a collection only if you want to change this choice.' : ''}
            </p>
          )}
          {(lists.isError || (archived && old.isError) || items.isError || (validId && selected.isError)) && (
            <p role="alert">
              These record choices could not load.
              <button
                className="button button-outline"
                disabled={disabled}
                onClick={() => {
                  void lists.refetch();
                  if (archived) void old.refetch();
                  if (choice && value.mode === 'existing') void items.refetch();
                  if (validId && !known) void selected.refetch();
                }}
              >
                Retry choices for line {index}
              </button>
            </p>
          )}
          <p>
            {value.mode === 'create'
              ? 'Only the entered record name is created. No call, rank, price or purchase date is copied.'
              : 'Linking leaves the existing record unchanged.'}
          </p>
        </>
      )}
    </section>
  );
}
