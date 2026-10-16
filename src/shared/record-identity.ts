import type { Item } from './models';

export function duplicateIdentity(item: Pick<Item, 'title' | 'type'>): string {
  return JSON.stringify(
    [item.title, item.type].map((value) =>
      value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
    ),
  );
}
