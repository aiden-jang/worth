import { useState } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { duplicateGroups } from '../shared/duplicates';
import type { Item } from '../shared/models';
import { decisionLabel } from '../shared/decisions';
import '../duplicates.css';

export function DuplicateReview({
  listId,
  items,
  onOpen,
  onRevisit,
}: {
  listId: string;
  items: Item[];
  onOpen: (id: string) => void;
  onRevisit: (id: string) => void;
}) {
  const { query, mutation } = useWorkspace(listId);
  const [showReviewed, setShowReviewed] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const workspace = query.data?.workspace;
  const groups = duplicateGroups(items, workspace?.duplicateReviews);
  const pending = groups.filter((group) => !group.reviewId).length;
  const visible = groups.filter(
    (group) =>
      (showReviewed || !group.reviewId) &&
      `${group.items[0].title} ${group.items[0].type}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const reviews = workspace?.duplicateReviews ?? [];
  const currentReviewIds = new Set(groups.flatMap((group) => (group.reviewId ? [group.reviewId] : [])));
  const otherReviews = reviews.filter((review) => !currentReviewIds.has(review.id));
  const byId = new Map(items.map((item) => [item.id, item]));
  const total = reviews.reduce((count, review) => count + review.itemIds.length, 0);
  return (
    <details className="duplicate-review">
      <summary>Possible duplicates · {pending}</summary>
      <p>
        Names and types look the same. Open the records to review them, or keep them separate. Your records
        stay unchanged.
      </p>
      {query.isPending && <p role="status">Loading saved reviews…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}{' '}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      <label className="duplicate-search">
        Find duplicate groups
        <input
          value={search}
          maxLength={200}
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(20);
          }}
        />
      </label>
      <label className="workbench-check">
        <input
          type="checkbox"
          checked={showReviewed}
          onChange={(event) => {
            setShowReviewed(event.target.checked);
            setLimit(20);
          }}
        />
        Show groups kept separate
      </label>
      {!visible.length && (
        <p>
          {pending || search ? 'No matching groups in this view.' : 'No unreviewed matching names and types.'}
        </p>
      )}
      {visible.slice(0, limit).map((group) => {
        const key = group.items
          .map((item) => item.id)
          .sort()
          .join(',');
        const allowed =
          group.items.length <= 500 && reviews.length < 100 && total + group.items.length <= 2000;
        const members = expanded.includes(key) ? group.items : group.items.slice(0, 6);
        return (
          <article className="duplicate-group" key={key}>
            <h3>{group.items[0].title}</h3>
            <p>
              {group.items[0].type || 'No type'} · {group.items.length} records
              {group.reviewId ? ' · Kept separate' : ''}
            </p>
            <ul>
              {members.map((item, index) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {decisionLabel(item.decision) || 'No call'} · {item.logCount}{' '}
                      {item.logCount === 1 ? 'visit' : 'visits'}
                      {item.wantToTry ? ' · Want to try' : ''}
                    </p>
                  </div>
                  <div className="duplicate-actions">
                    <button
                      className="button button-outline"
                      disabled={mutation.isPending}
                      aria-label={`Open record ${index + 1}: ${item.title}`}
                      onClick={() => onOpen(item.id)}
                    >
                      Open
                    </button>
                    <button
                      className="button button-outline"
                      disabled={mutation.isPending}
                      aria-label={`Revisit record ${index + 1}: ${item.title}`}
                      onClick={() => onRevisit(item.id)}
                    >
                      Revisit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {members.length < group.items.length && (
              <button className="button button-outline" onClick={() => setExpanded([...expanded, key])}>
                Show all {group.items.length} records
              </button>
            )}
            {workspace &&
              (group.reviewId ? (
                <button
                  className="button button-outline"
                  disabled={mutation.isPending || query.isFetching}
                  onClick={() =>
                    mutation.mutate(
                      {
                        ...workspace,
                        duplicateReviews: reviews.filter((review) => review.id !== group.reviewId),
                      },
                      { onSuccess: () => setStatus('This group is back in suggestions.') },
                    )
                  }
                >
                  Show suggestions for this group again
                </button>
              ) : (
                <>
                  <button
                    className="button button-outline"
                    disabled={!allowed || mutation.isPending || query.isFetching}
                    onClick={() =>
                      mutation.mutate(
                        {
                          ...workspace,
                          duplicateReviews: [
                            ...reviews,
                            { id: crypto.randomUUID(), itemIds: group.items.map((item) => item.id) },
                          ],
                        },
                        {
                          onSuccess: () =>
                            setStatus(
                              `${group.items.length} records kept separate. No records were changed.`,
                            ),
                        },
                      )
                    }
                  >
                    Keep all {group.items.length} as separate records
                  </button>
                  {!allowed && (
                    <p>
                      {group.items.length > 500
                        ? 'Review up to 500 records together. You can still open each record.'
                        : 'Saved review limit reached. Show groups kept separate and reopen an older review to make room.'}
                    </p>
                  )}
                </>
              ))}
          </article>
        );
      })}
      {visible.length > limit && (
        <button className="button button-outline" onClick={() => setLimit(limit + 20)}>
          Show more groups · {limit} of {visible.length}
        </button>
      )}
      {showReviewed && otherReviews.length > 0 && (
        <section aria-label="Other saved duplicate reviews">
          <h3>Other saved reviews</h3>
          <p>
            These reviewed groups no longer match a current duplicate group. You can remove their saved review
            without changing any records.
          </p>
          {otherReviews.map((review, index) => (
            <article className="duplicate-group" key={review.id}>
              <p>
                {review.itemIds
                  .map((id) => byId.get(id)?.title)
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <button
                className="button button-outline"
                disabled={mutation.isPending || query.isFetching}
                aria-label={`Remove saved review ${index + 1}`}
                onClick={() =>
                  mutation.mutate(
                    { ...workspace!, duplicateReviews: reviews.filter((value) => value.id !== review.id) },
                    { onSuccess: () => setStatus('Saved review removed. Records stay unchanged.') },
                  )
                }
              >
                Remove saved review
              </button>
            </article>
          ))}
        </section>
      )}
      {status && <p role="status">{status}</p>}
      {mutation.isError && (
        <p role="alert">
          {mutation.error.message}{' '}
          <button
            className="button button-outline"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
              mutation.reset();
            }}
          >
            Refresh saved reviews
          </button>
        </p>
      )}
    </details>
  );
}
