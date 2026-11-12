import { z } from 'zod';
import { itemInput, logInput } from './validation';
import { experienceInput } from './memories';
import { inboxPayload } from './inbox';
import { itemContextDraft } from './item-context';
import { codeCaptureDraft } from './code-capture';

const captureSourceDraft = z
  .object({
    mode: z.enum(['link', 'photo', 'code']).nullable(),
    link: z.string().max(1000),
    text: z.string().max(16000),
    code: z.string().max(80),
    book: codeCaptureDraft.shape.suggestion,
    bookTitle: z.string().max(1000),
  })
  .strict();
export type CaptureSourceDraft = z.infer<typeof captureSourceDraft>;
export const emptyCaptureSource: CaptureSourceDraft = {
  mode: null,
  link: '',
  text: '',
  code: '',
  book: null,
  bookTitle: '',
};

const destination = z.union([z.literal('inbox'), z.string().uuid()]);
const attachment = { photoKey: z.string().uuid().optional() };
export const quickEntryRequest = z.object({
  listId: destination.optional(),
  title: z.string().max(120).optional(),
});
const quickEntryPending = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('inbox'), item: inboxPayload, ...attachment }).strict(),
  z.object({ kind: z.literal('item'), listId: z.string().uuid(), item: itemInput, ...attachment }).strict(),
  z
    .object({
      kind: z.literal('experience'),
      listId: z.string().uuid(),
      body: experienceInput,
      ...attachment,
    })
    .strict(),
  z
    .object({ kind: z.literal('activity'), listId: z.string().uuid(), body: logInput, ...attachment })
    .strict(),
]);
export const quickEntryDraft = z
  .object({
    listId: destination,
    title: z.string().max(120),
    type: z.string().max(60).optional(),
    context: itemContextDraft.optional(),
    itemId: z.string().uuid().nullable().default(null),
    keepSeparate: z.boolean().optional(),
    parkedDecision: z.enum(['favorite', 'meh', 'would_not_again']).nullable().optional(),
    captureSource: captureSourceDraft.optional(),
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
