import { z } from 'zod';
import { itemInput, logInput } from './validation';
import { experienceInput } from './memories';

const destination = z.union([z.literal('inbox'), z.string().uuid()]);
export const quickEntryRequest = z.object({
  listId: destination.optional(),
  title: z.string().max(120).optional(),
});
const quickEntryPending = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('inbox'), item: itemInput }).strict(),
  z.object({ kind: z.literal('item'), listId: z.string().uuid(), item: itemInput }).strict(),
  z.object({ kind: z.literal('experience'), listId: z.string().uuid(), body: experienceInput }).strict(),
  z.object({ kind: z.literal('activity'), listId: z.string().uuid(), body: logInput }).strict(),
]);
export const quickEntryDraft = z
  .object({
    listId: destination,
    title: z.string().max(120),
    itemId: z.string().uuid().nullable().default(null),
    note: z.string().max(4000),
    decision: z.enum(['favorite', 'meh', 'would_not_again']).nullable(),
    wantToTry: z.boolean(),
    experienced: z.boolean(),
    happenedOn: z.string().max(10),
    pending: quickEntryPending.nullable(),
  })
  .strict();
export type QuickEntryDraft = z.infer<typeof quickEntryDraft>;
export type QuickEntryPending = z.infer<typeof quickEntryPending>;
export type SavedEntry = {
  id: string;
  title: string;
  listId: string | null;
  kind: 'item' | 'log' | 'inbox';
  undoItemId?: string;
};

export function requestAddEntry(input: z.infer<typeof quickEntryRequest> = {}) {
  window.dispatchEvent(new CustomEvent('worth:add-entry', { detail: quickEntryRequest.parse(input) }));
}
