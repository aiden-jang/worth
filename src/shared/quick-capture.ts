import type { ListSummary } from './models';

export function preferredQuickCaptureList(
  pathname: string,
  rememberedId: string | null,
  lists: ListSummary[],
): ListSummary | null {
  const activeListId = /^\/lists\/([^/]+)$/.exec(pathname)?.[1];
  const preferredId = activeListId ?? rememberedId;
  return lists.find((list) => list.id === preferredId) ?? null;
}
