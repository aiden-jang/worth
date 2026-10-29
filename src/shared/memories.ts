import { z } from 'zod';
import { logInput } from './validation';
import { visitContext } from './visit-context';
import type { ItemDecision } from './models';

export const experienceInput = z
  .object({
    itemId: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    type: z.string().trim().max(60).default(''),
    happenedOn: logInput.shape.happenedOn,
    note: z.string().trim().max(4000).default(''),
    context: visitContext.prefault({}),
  })
  .strict();
export type ExperienceInput = z.infer<typeof experienceInput>;

export const memoryFilter = z
  .object({
    mode: z.enum(['visits', 'saved']).default('visits'),
    list: z.union([z.literal(''), z.literal('inbox'), z.string().uuid()]).default(''),
    from: z.union([z.literal(''), logInput.shape.happenedOn]).default(''),
    to: z.union([z.literal(''), logInput.shape.happenedOn]).default(''),
    q: z.string().trim().max(120).default(''),
    type: z.string().max(60).default(''),
    label: z.string().max(32).default(''),
    archived: z.enum(['0', '1']).default('0'),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'End date must follow start date.');
export type MemoryFilter = z.infer<typeof memoryFilter>;
export interface MemoryRecord {
  id: string;
  itemId: string | null;
  listId: string | null;
  listName: string;
  title: string;
  note: string;
  date: string;
  kind: 'visit' | 'activity' | 'saved' | 'unfiled' | 'unfiled-visit';
  location: string;
  order: string;
  reaction: ItemDecision | null;
  hasPhoto: boolean;
}
export interface MemoryPage {
  records: MemoryRecord[];
  total: number;
  nextOffset: number | null;
}
export interface PreferenceGroup {
  listId: string;
  listName: string;
  kind: 'collection' | 'type' | 'label';
  basis: 'records' | 'visits';
  name: string;
  favorite: number;
  meh: number;
  notAgain: number;
  unrated: number;
}
export interface Preferences {
  groups: PreferenceGroup[];
  rediscover: { itemId: string; listId: string; title: string; lastDate: string }[];
  returns: {
    itemId: string;
    listId: string;
    title: string;
    visits: number;
    favorites: number;
    lastDate: string;
  }[];
}

export function isSavedMemory(record: MemoryRecord) {
  return record.kind === 'saved' || record.kind === 'unfiled';
}
export function memorySourceHref(record: MemoryRecord) {
  return record.kind === 'unfiled' || record.kind === 'unfiled-visit'
    ? `/inbox?focus=${record.id}`
    : `/lists/${record.listId}?focus=${record.kind === 'saved' ? `item:${record.itemId ?? record.id}` : `log:${record.id}`}`;
}
export function memoryPhotoHref(record: MemoryRecord) {
  const kind =
    record.kind === 'unfiled' || record.kind === 'unfiled-visit'
      ? 'inbox'
      : isSavedMemory(record)
        ? 'items'
        : 'logs';
  return `/api/${kind}/${record.id}/photo`;
}
