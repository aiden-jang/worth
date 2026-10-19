import { z } from 'zod';
const call = z.enum(['favorite', 'meh', 'would_not_again']).nullable();
const ids = z.array(z.string().uuid().nullable()).max(500);
const common = {
  id: z.string().regex(/^[a-f0-9]{32}$/),
  reason: z.string().max(2000),
  logId: z.string().uuid().nullable(),
  revision: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative().max(8640000000000000),
};
export const tasteEvent = z.discriminatedUnion('kind', [
  z.object({
    ...common,
    kind: z.literal('rank'),
    listId: z.string().uuid(),
    itemId: z.null(),
    before: ids,
    after: ids,
  }),
  z.object({
    ...common,
    kind: z.literal('opinion'),
    itemId: z.string().uuid(),
    listId: z.null(),
    before: call,
    after: call,
  }),
]);
export type TasteEvent = z.infer<typeof tasteEvent>;
export const historyNote = z
  .object({
    reason: z.string().max(2000),
    logId: z.string().uuid().nullable(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export type HistoryPage = { events: TasteEvent[]; next: string | null };
export function historyDraft(value: unknown): value is z.infer<typeof historyNote> {
  return historyNote.safeParse(value).success;
}
// Unavailable positions remain gaps, so an old second place never becomes first by omission.
export function historyOrder(order: (string | null)[], available: Set<string>): (string | null)[] {
  return order.map((id) => (id && available.has(id) ? id : null));
}
