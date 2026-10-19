import { z } from 'zod';
const id = z.string().uuid('Choose a saved record or collection.');
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Choose a real date');
const mapping = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }).strict(),
  z.object({ mode: z.literal('existing'), itemId: id }).strict(),
  z
    .object({
      mode: z.literal('create'),
      itemId: id,
      listId: id,
      title: z
        .string()
        .max(120)
        .refine((v) => !!v.trim(), 'Give the new record a name'),
    })
    .strict(),
]);
const line = z
  .object({
    id,
    label: z
      .string()
      .max(240)
      .refine((v) => !!v.trim(), 'Name each receipt line'),
    amount: z.string().max(80),
    note: z.string().max(1000),
    mapping,
    referenceMissing: z.boolean(),
    createdHere: z.boolean().default(false),
    createdName: z.string().max(120).default(''),
  })
  .strict();
const receiptAttachment = z
  .object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    available: z.boolean(),
  })
  .strict();
const body = z
  .object({
    name: z
      .string()
      .max(80)
      .refine((v) => !!v.trim(), 'Give this receipt a name'),
    merchant: z.string().max(120),
    day: day.nullable(),
    text: z.string().max(16000),
    note: z.string().max(2000),
    lines: z.array(line).max(30),
    attachment: receiptAttachment.nullable(),
  })
  .strict();
function unique(value: z.infer<typeof body>, ctx: z.RefinementCtx) {
  if (!value.lines.length && !value.text.trim() && !value.note.trim() && !value.attachment)
    ctx.addIssue({
      code: 'custom',
      path: ['text'],
      message: 'Add reviewed text, a receipt line, a note or an attachment before saving.',
    });
  if (new Set(value.lines.map((l) => l.id)).size !== value.lines.length)
    ctx.addIssue({
      code: 'custom',
      path: ['lines'],
      message: 'Use each line identity once',
    });
  const creates = value.lines.flatMap((l) => (l.mapping.mode === 'create' ? [l.mapping.itemId] : []));
  if (new Set(creates).size !== creates.length)
    ctx.addIssue({
      code: 'custom',
      path: ['lines'],
      message: 'Give each new record a separate identity',
    });
  if (value.lines.some((l) => l.mapping.mode === 'existing' && creates.includes(l.mapping.itemId)))
    ctx.addIssue({
      code: 'custom',
      path: ['lines'],
      message: 'Choose existing records separately from new records',
    });
}
function creationNames<T extends z.infer<typeof body>>(value: T): T {
  return {
    ...value,
    lines: value.lines.map((line) => ({
      ...line,
      createdName: line.mapping.mode === 'create' ? line.mapping.title : line.createdName,
    })),
  };
}
export const receiptInput = body.superRefine(unique).transform(creationNames);
export type ReceiptInput = z.infer<typeof receiptInput>;
export const savedReceipt = body
  .extend({
    id,
    createdAt: z.number().int().nonnegative().max(8640000000000000),
  })
  .superRefine(unique)
  .transform(creationNames);
export type SavedReceipt = z.infer<typeof savedReceipt>;
export type ReceiptSource = {
  id: string;
  title: string;
  listId: string;
  listName: string;
  archived: boolean;
};
export type ReceiptView = SavedReceipt & { sources: ReceiptSource[] };
export type ReceiptSummary = Pick<SavedReceipt, 'id' | 'name' | 'merchant' | 'day' | 'createdAt'> & {
  lineCount: number;
};
const draftMapping = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }).strict(),
  z.object({ mode: z.literal('existing'), itemId: z.string().max(36) }).strict(),
  z
    .object({
      mode: z.literal('create'),
      itemId: id,
      listId: z.string().max(36),
      title: z.string().max(120),
    })
    .strict(),
]);
export const receiptDraft = z
  .object({
    current: body.extend({
      name: z.string().max(80),
      day: z.string().max(10),
      lines: z.array(line.extend({ label: z.string().max(240), mapping: draftMapping })).max(30),
    }),
    pending: z.object({ id, input: receiptInput }).strict().nullable(),
  })
  .strict();
export type ReceiptDraft = z.infer<typeof receiptDraft>;
export function emptyReceipt(): ReceiptDraft {
  return {
    current: {
      name: '',
      merchant: '',
      day: '',
      text: '',
      note: '',
      lines: [],
      attachment: null,
    },
    pending: null,
  };
}
export function receiptPayload(form: ReceiptDraft['current']): ReceiptInput {
  return receiptInput.parse({ ...form, day: form.day || null });
}
export function receiptBody(receipt: SavedReceipt): ReceiptInput {
  return receiptInput.parse({
    name: receipt.name,
    merchant: receipt.merchant,
    day: receipt.day,
    text: receipt.text,
    note: receipt.note,
    lines: receipt.lines,
    attachment: receipt.attachment,
  });
}
/** Suggestions only split literal lines; prices, currency, dates and mappings need review. */
export function receiptLineSuggestions(text: string) {
  return text
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter((label) => label && label.length <= 240)
    .slice(0, 30)
    .map((label) => ({
      id: crypto.randomUUID(),
      label,
      amount: '',
      note: '',
      mapping: { mode: 'none' as const },
      referenceMissing: false,
      createdHere: false,
      createdName: '',
    }));
}
export function exportReceiptReferences(receipt: SavedReceipt, items: ReadonlySet<string>): SavedReceipt {
  return {
    ...receipt,
    lines: receipt.lines.map((line) => {
      const createdHere = line.createdHere || line.mapping.mode === 'create';
      const createdName = line.mapping.mode === 'create' ? line.mapping.title : line.createdName;
      if (line.mapping.mode === 'none') return { ...line, createdHere, createdName };
      return items.has(line.mapping.itemId)
        ? {
            ...line,
            createdHere,
            createdName,
            mapping: { mode: 'existing' as const, itemId: line.mapping.itemId },
          }
        : { ...line, createdHere, createdName, mapping: { mode: 'none' as const }, referenceMissing: true };
    }),
  };
}
export async function receiptDigest(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
