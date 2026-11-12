import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useConnection } from '../hooks/useConnection';
import { inboxPayload, type InboxEntry } from '../shared/inbox';
import type { Item, ItemDecision } from '../shared/models';
import { CallChoices } from './PersonalCall';

type Target =
  | { kind: 'item'; id: string; title: string; initial?: Item }
  | { kind: 'inbox'; id: string; title: string; initial?: InboxEntry };

export function TryReview({ target, disabled = false }: { target: Target; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const online = useConnection();
  const source = useQuery({
    queryKey: ['try-review', target.kind, target.id],
    queryFn: async () =>
      target.kind === 'item' ? (await api.item(target.id)).item : (await api.inboxEntry(target.id)).entry,
    enabled: open && !target.initial,
  });
  const record = target.initial ?? source.data;
  const save = useMutation({
    mutationFn: async ({ record, decision }: { record: Item | InboxEntry; decision?: ItemDecision }) => {
      if (target.kind === 'item')
        return {
          kind: 'item' as const,
          item: (await api.updateItem(target.id, { ...(decision ? { decision } : {}), wantToTry: false }))
            .item,
        };
      const entry = record as InboxEntry;
      return {
        kind: 'inbox' as const,
        entry: (
          await api.updateInbox(
            target.id,
            { ...inboxPayload.parse(entry), decision: decision ?? entry.decision, wantToTry: false },
            entry.revision,
          )
        ).entry,
      };
    },
    onSuccess: (result) => {
      if (result.kind === 'item') {
        client.setQueryData(['item', result.item.id], { item: result.item });
        client.setQueryData<{ items: Item[] }>(['items', result.item.listId], (current) =>
          current
            ? { items: current.items.map((item) => (item.id === result.item.id ? result.item : item)) }
            : current,
        );
      } else {
        client.setQueryData<{ entries: InboxEntry[] }>(['inbox'], (current) =>
          current
            ? {
                entries: current.entries.map((entry) =>
                  entry.id === result.entry.id ? result.entry : entry,
                ),
              }
            : current,
        );
      }
      setOpen(false);
      for (const key of [
        'items',
        'item',
        'inbox',
        'try-review',
        'list',
        'lists',
        'overview',
        'patterns',
        'search',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  if (!open)
    return (
      <div className="try-review">
        <span className="try-review-status">Want to try</span>
        <button
          className="button button-outline"
          type="button"
          disabled={disabled || !online}
          onClick={() => {
            save.reset();
            setOpen(true);
          }}
        >
          I tried it
        </button>
      </div>
    );
  return (
    <section className="try-review try-review-open" aria-label={`Review ${target.title}`}>
      <strong>How was it?</strong>
      <p>Choose a call to move this out of Want to try. No date needed.</p>
      {record ? (
        <CallChoices
          label={`How was ${target.title}?`}
          value={save.isPending ? (save.variables?.decision ?? null) : null}
          disabled={disabled || !online || save.isPending}
          onChange={(decision) => {
            if (decision) save.mutate({ record, decision });
          }}
        />
      ) : source.isError ? (
        <p role="alert">
          Saved details couldn’t load.{' '}
          <button type="button" onClick={() => void source.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <p role="status">Opening saved details…</p>
      )}
      {save.isPending && <p role="status">Saving your call…</p>}
      {save.isError && (
        <p role="alert" className="form-error">
          {save.error.message} Try the same action again.
        </p>
      )}
      {record && (
        <button
          type="button"
          disabled={disabled || !online || save.isPending}
          onClick={() => save.mutate({ record })}
        >
          Remove from Want to try
        </button>
      )}
      <button type="button" disabled={save.isPending} onClick={() => setOpen(false)}>
        Keep in Want to try
      </button>
    </section>
  );
}
