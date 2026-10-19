import { z } from 'zod';
import { itemInput } from './validation';

export const inboxLimit = 500;
const time = z.number().int().nonnegative().max(8640000000000000);
export const inboxEntry = itemInput.and(
  z.object({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    createdAt: time,
    updatedAt: time,
  }),
);
export type InboxEntry = z.infer<typeof inboxEntry>;
export const inboxCreate = z.object({ item: itemInput }).strict();
export const inboxEdit = inboxCreate.extend({ expectedRevision: z.number().int().nonnegative() }).strict();
export const inboxFile = z
  .object({ targetListId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() })
  .strict();
export type InboxPayload = z.infer<typeof itemInput>;
