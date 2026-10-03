import type { Item } from './models';

export const notOpenedLatelyDays = 120;

export function wasOpenedLongAgo(item: Item, now = Date.now()): boolean {
  if (!item.lastLoggedOn) return true;
  const lastOpened = new Date(`${item.lastLoggedOn}T12:00:00Z`).getTime();
  if (Number.isNaN(lastOpened)) return true;
  return lastOpened < now - notOpenedLatelyDays * 24 * 60 * 60 * 1000;
}

export function collectionBrowseCount(
  mode: 'all' | 'kept' | 'revisited' | 'not-opened-lately',
  items: Item[],
): number {
  if (mode === 'kept') return items.filter((item) => item.decision === 'favorite').length;
  if (mode === 'revisited') return items.filter((item) => item.logCount > 1).length;
  if (mode === 'not-opened-lately') return items.filter((item) => wasOpenedLongAgo(item)).length;
  return items.length;
}
