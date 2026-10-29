import { z } from 'zod';
import { itemInput, logInput } from './validation';

export const inboxLimit = 500;
const time = z.number().int().nonnegative().max(8640000000000000);
export const inboxPayload = itemInput.safeExtend({
  memory: z
    .object({
      happenedOn: logInput.shape.happenedOn,
      reaction: itemInput.shape.decision,
    })
    .strict()
    .nullable()
    .optional(),
});
const inboxPhoto = z
  .object({
    id: z.string().uuid(),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    fingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    createdAt: time,
    available: z.boolean(),
  })
  .strict();
export const inboxEntry = inboxPayload.and(
  z.object({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    createdAt: time,
    updatedAt: time,
    photo: inboxPhoto.nullable().optional(),
  }),
);
export type InboxEntry = z.infer<typeof inboxEntry>;
export const inboxCreate = z.object({ item: inboxPayload }).strict();
export const inboxEdit = inboxCreate.extend({ expectedRevision: z.number().int().nonnegative() }).strict();
export const inboxFile = z
  .object({ targetListId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() })
  .strict();
export type InboxPayload = z.infer<typeof inboxPayload>;
