import type { Item } from './models';
import type { CollectionWorkspace } from './workspace';
import { duplicateIdentity } from './record-identity';
export type DuplicateGroup = { items: Item[]; reviewId: string | null };
export function duplicateGroups(
  items: Item[],
  reviews: CollectionWorkspace['duplicateReviews'] = [],
): DuplicateGroup[] {
  const grouped = new Map<string, Item[]>();
  for (const item of items) {
    const identity = duplicateIdentity(item);
    const group = grouped.get(identity);
    if (group) group.push(item);
    else grouped.set(identity, [item]);
  }
  const key = (ids: string[]) => [...ids].sort().join(',');
  const reviewed = new Map(reviews.map((review) => [key(review.itemIds), review.id]));
  return [...grouped.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      items: [...group].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
      reviewId: reviewed.get(key(group.map((item) => item.id))) ?? null,
    }))
    .sort((a, b) => a.items[0].title.localeCompare(b.items[0].title));
}
