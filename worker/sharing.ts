import type { Item, ListDetail, PublicShare } from '../src/shared/models';
import { rankedItems } from '../src/shared/ranking';

export { rankedItems } from '../src/shared/ranking';

export function shareSnapshot(
  list: ListDetail,
  items: Item[],
  limit: 5 | 10 | 'all',
  now: number,
): PublicShare {
  const selected = limit === 'all' ? rankedItems(list, items) : rankedItems(list, items).slice(0, limit);
  return {
    title: list.name,
    entries: selected.map((item, index) => ({ rank: index + 1, title: item.title, type: item.type })),
    createdAt: now,
  };
}

export function createShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function validShareToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
