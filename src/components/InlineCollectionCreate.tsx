import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from '@phosphor-icons/react';
import { api } from '../api';
import type { ListSummary } from '../shared/models';

export function InlineCollectionCreate({
  lists,
  open,
  onOpenChange,
  onCreated,
  disabled = false,
  onBusyChange,
  submitLabel = 'Create collection',
  existingLabel = 'Use this collection',
}: {
  lists: ListSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (list: ListSummary) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  submitLabel?: string;
  existingLabel?: string;
}) {
  const [name, setName] = useState('');
  const client = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const notifyBusy = useRef(onBusyChange);
  const uncertainName = useRef('');
  useEffect(() => {
    notifyBusy.current = onBusyChange;
  }, [onBusyChange]);
  const existing = lists.find(
    (list) =>
      !list.archived &&
      list.kind === 'collection' &&
      list.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
  function chooseCollection(list: ListSummary) {
    onCreated(list);
    onOpenChange(false);
    setName('');
  }
  const create = useMutation({
    mutationFn: async () => {
      const normalized = name.trim().toLocaleLowerCase();
      if (uncertainName.current === normalized) {
        const latest = await api.lists();
        const saved = latest.lists.find(
          (list) =>
            !list.archived &&
            list.kind === 'collection' &&
            list.name.trim().toLocaleLowerCase() === normalized,
        );
        if (saved) return { list: saved };
      }
      return api.createList({ name: name.trim(), kind: 'collection', description: '' });
    },
    onError: () => {
      uncertainName.current = name.trim().toLocaleLowerCase();
      void client.invalidateQueries({ queryKey: ['lists'] });
    },
    onSuccess: ({ list }) => {
      uncertainName.current = '';
      client.setQueryData<{ lists: ListSummary[] }>(['lists'], (current) => ({
        lists: [...(current?.lists ?? []).filter((value) => value.id !== list.id), list],
      }));
      void client.invalidateQueries({ queryKey: ['overview'] });
      chooseCollection(list);
    },
  });
  useEffect(() => {
    notifyBusy.current?.(create.isPending);
  }, [create.isPending]);
  useEffect(() => () => notifyBusy.current?.(false), []);
  function submit() {
    if (disabled || create.isPending || !name.trim()) return;
    if (existing) chooseCollection(existing);
    else create.mutate();
  }
  if (!open)
    return (
      <button
        ref={trigger}
        className="quick-create-toggle"
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(true)}
      >
        <Plus size={16} /> New collection
      </button>
    );
  return (
    <fieldset className="quick-create-collection" disabled={disabled || create.isPending}>
      <legend className="sr-only">New collection</legend>
      <label>
        Collection name
        <input
          autoFocus
          maxLength={80}
          value={name}
          placeholder="What belongs together?"
          onChange={(event) => {
            setName(event.target.value);
            create.reset();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }
          }}
        />
      </label>
      {!name && (
        <div className="quick-collection-ideas" aria-label="Collection ideas">
          {['Places', 'Drinks', 'Food & snacks', 'Movies', 'Books']
            .filter(
              (idea) => !lists.some((list) => list.name.toLocaleLowerCase() === idea.toLocaleLowerCase()),
            )
            .map((idea) => (
              <button type="button" key={idea} onClick={() => setName(idea)}>
                {idea}
              </button>
            ))}
        </div>
      )}
      <div className="data-actions">
        <button className="button button-outline" type="button" disabled={!name.trim()} onClick={submit}>
          {create.isPending ? 'Creating…' : existing ? existingLabel : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            create.reset();
            requestAnimationFrame(() => trigger.current?.focus());
          }}
        >
          Cancel
        </button>
      </div>
      {create.isError && (
        <p className="form-error" role="alert">
          {create.error.message}
        </p>
      )}
    </fieldset>
  );
}
