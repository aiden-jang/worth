export function recordHref(listId: string | null, kind: 'item' | 'log' | 'inbox', id: string) {
  return kind === 'inbox' ? `/inbox?focus=${id}&view=1` : `/lists/${listId}?focus=${kind}:${id}&view=1`;
}
