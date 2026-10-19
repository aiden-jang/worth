import { z } from 'zod';
const id = z.string().uuid();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Choose a real date');
const time = z
  .string()
  .max(5)
  .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), 'Use a time from 00:00 to 23:59');
const boardKind = z.enum(['moment', 'shortlist', 'evening', 'trip']);
export const boardLabels = {
  moment: 'Moment',
  shortlist: 'Shortlist',
  evening: 'Evening',
  trip: 'Trip',
} as const;
const reference = z.object({ kind: z.enum(['item', 'log']), id }).strict();
const stopFields = {
  id,
  name: z.string().max(120),
  note: z.string().max(1000),
  day: day.nullable(),
  time,
  location: z.string().max(240),
  reference: reference.nullable(),
  referenceMissing: z.boolean(),
  photo: z.boolean(),
};
const stop = z
  .object(stopFields)
  .strict()
  .refine((value) => !!value.name.trim(), 'Give each stop or selection a name.');
const fields = z
  .object({
    kind: boardKind,
    name: z.string().max(80),
    introduction: z.string().max(2000),
    from: day.nullable(),
    until: day.nullable(),
    archived: z.boolean(),
    entries: z.array(stop).max(40),
  })
  .strict();
function checkBoard(value: z.infer<typeof fields>, ctx: z.RefinementCtx) {
  if (!value.name.trim())
    ctx.addIssue({ code: 'custom', path: ['name'], message: 'Give this board a name.' });
  if (value.from && value.until && value.from > value.until)
    ctx.addIssue({
      code: 'custom',
      path: ['until'],
      message: 'The end date must be on or after the start date.',
    });
  if (new Set(value.entries.map((entry) => entry.id)).size !== value.entries.length)
    ctx.addIssue({ code: 'custom', path: ['entries'], message: 'Use each entry identity once.' });
}
export const boardInput = fields.superRefine(checkBoard);
export type BoardInput = z.infer<typeof boardInput>;
export const savedBoard = fields
  .extend({
    id,
    revision: z.number().int().nonnegative(),
    createdAt: z.number().int().nonnegative().max(8640000000000000),
    updatedAt: z.number().int().nonnegative().max(8640000000000000),
  })
  .superRefine(checkBoard);
export type SavedBoard = z.infer<typeof savedBoard>;
export type BoardReference = z.infer<typeof reference>;
export type BoardStop = BoardInput['entries'][number];
export type BoardSource = BoardReference & {
  title: string;
  listId: string;
  listName: string;
  archived: boolean;
  currentId: string;
  merged: boolean;
  hasPhoto: boolean;
  updatedAt: number;
};
export type BoardView = SavedBoard & { sources: BoardSource[] };
export type BoardSummary = Pick<
  SavedBoard,
  'id' | 'name' | 'kind' | 'from' | 'until' | 'archived' | 'revision' | 'updatedAt'
> & { entryCount: number };
export const boardPatch = z
  .object({ board: boardInput, expectedRevision: z.number().int().nonnegative() })
  .strict();
const draftStop = z
  .object({ ...stopFields, name: z.string().max(120), day: z.string().max(10), time: z.string().max(5) })
  .strict();
const draftForm = z
  .object({
    kind: boardKind,
    name: z.string().max(80),
    introduction: z.string().max(2000),
    from: z.string().max(10),
    until: z.string().max(10),
    archived: z.boolean(),
    entries: z.array(draftStop).max(40),
  })
  .strict();
export const boardDraft = z
  .object({
    current: draftForm,
    expectedRevision: z.number().int().nonnegative(),
    previous: z
      .object({ form: draftForm, expectedRevision: z.number().int().nonnegative() })
      .strict()
      .nullable(),
    pending: z
      .object({ id, board: boardInput, revision: z.number().int().nonnegative().nullable() })
      .strict()
      .nullable(),
  })
  .strict();
export type BoardDraft = z.infer<typeof boardDraft>;
export function emptyBoardDraft(kind: BoardInput['kind'] = 'moment'): BoardDraft {
  return {
    current: { kind, name: '', introduction: '', from: '', until: '', archived: false, entries: [] },
    expectedRevision: 0,
    pending: null,
    previous: null,
  };
}
export function boardForm(board: SavedBoard): BoardDraft['current'] {
  return {
    kind: board.kind,
    name: board.name,
    introduction: board.introduction,
    archived: board.archived,
    from: board.from ?? '',
    until: board.until ?? '',
    entries: board.entries.map((entry) => ({ ...entry, day: entry.day ?? '' })),
  };
}
export function boardPayload(form: BoardDraft['current']): BoardInput {
  return boardInput.parse({
    ...form,
    from: form.from || null,
    until: form.until || null,
    entries: form.entries.map((entry) => ({ ...entry, day: entry.day || null })),
  });
}
export function boardReferenceKey(ref: BoardReference) {
  return `${ref.kind}:${ref.id}`;
}

export function exportBoardReferences(
  board: SavedBoard,
  itemIds: ReadonlySet<string>,
  logIds: ReadonlySet<string>,
): SavedBoard {
  return {
    ...board,
    entries: board.entries.map((entry) =>
      entry.reference && !(entry.reference.kind === 'item' ? itemIds : logIds).has(entry.reference.id)
        ? { ...entry, reference: null, referenceMissing: true }
        : entry,
    ),
  };
}
