import { z } from 'zod';
const id = z.string().uuid(),
  owner = z.string().min(1).max(100);
const record = z
  .object({
    id,
    kind: z.enum(['item', 'log', 'inbox']),
    listId: id.nullable(),
    title: z.string().max(120),
    note: z.string().max(4000),
    updatedAt: z.number().int().nonnegative(),
    date: z.string().max(10).nullable(),
    decision: z.enum(['favorite', 'meh', 'would_not_again']).nullable(),
    rank: z.number().int().positive().nullable(),
  })
  .strict();
export const offlineSnapshot = z
  .object({
    owner,
    epoch: id,
    savedAt: z.number().int().nonnegative(),
    lists: z
      .array(z.object({ id, name: z.string().max(80), kind: z.enum(['collection', 'activity']) }).strict())
      .max(500),
    records: z.array(record).max(5000),
  })
  .strict();
export type OfflineSnapshot = z.infer<typeof offlineSnapshot>;
export const offlineOperation = z
  .object({
    id,
    epoch: id,
    kind: z.enum(['capture', 'note']),
    recordKind: z.enum(['item', 'log', 'inbox']).nullable(),
    recordId: id.nullable(),
    title: z.string().max(120),
    note: z.string().max(4000),
    expectedNote: z.string().max(4000).nullable(),
    expectedUpdatedAt: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.kind === 'capture'
        ? !v.title.trim() ||
          v.recordKind !== null ||
          v.recordId !== null ||
          v.expectedNote !== null ||
          v.expectedUpdatedAt !== null
        : v.recordKind === null ||
          v.recordId === null ||
          v.expectedNote === null ||
          v.expectedUpdatedAt === null
    )
      c.addIssue({ code: 'custom', message: 'Review this pending capture or note edit.' });
  });
export type OfflineOperation = z.infer<typeof offlineOperation>;
export const offlineVault = z
  .object({ snapshot: offlineSnapshot, queue: z.array(offlineOperation).max(100) })
  .strict()
  .superRefine((v, c) => {
    if (
      v.queue.some((q) => q.epoch !== v.snapshot.epoch) ||
      new Set(v.queue.map((q) => q.id)).size !== v.queue.length
    )
      c.addIssue({ code: 'custom', message: 'Pending saves must belong to this snapshot.' });
  });
export type OfflineVault = z.infer<typeof offlineVault>;
