import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Item } from '../shared/models';
import { decisionLabel } from '../shared/decisions';

export function MergedRecords({ item }: { item: Item }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['merged', item.id],
    queryFn: () => api.mergedItems(item.id),
    enabled: Boolean(item.mergedIds?.length),
  });
  const separate = useMutation({
    mutationFn: (id: string) => api.separateItem(item.id, id),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
  if (!item.mergedIds?.length) return null;
  return (
    <section className="merged-records" aria-label="Merged originals">
      <h3>Merged originals</h3>
      <p>Original details stay intact. Separating restores an original and its visits as an unranked item.</p>
      {query.isPending && <p role="status">Opening originals…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}{' '}
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {separate.isError && <p role="alert">{separate.error.message}</p>}
      {query.data?.items.map((source) => (
        <article key={source.id}>
          <h4>{source.title}</h4>
          <p>
            {[
              source.type,
              source.decision ? decisionLabel(source.decision) : 'No call',
              source.wantToTry ? 'Want to try' : '',
              source.revisitQueued ? 'In revisit queue' : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {(source.startedOn || source.endedOn) && (
            <p>
              {source.startedOn ?? 'No start date'} → {source.endedOn ?? 'No end date'}
            </p>
          )}
          {source.note && <p className="preserved-note">{source.note}</p>}
          {source.hasPhoto && (
            <img
              src={`/api/items/${source.id}/photo?v=${source.updatedAt}`}
              alt={`Private photo for ${source.title}`}
            />
          )}
          <button
            type="button"
            className="button button-outline"
            disabled={separate.isPending}
            onClick={() => separate.mutate(source.id)}
          >
            Separate<span className="sr-only"> {source.title}</span>
          </button>
        </article>
      ))}
    </section>
  );
}
