import { z } from 'zod';
import { logInput } from './validation';
import { photoArrow } from './photo-gallery';
const id = z.string().uuid();
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Choose a real date.');
const snapshotFields = z
  .array(z.enum(['type', 'decision', 'rank', 'dates', 'results', 'note']))
  .max(6)
  .refine((fields) => new Set(fields).size === fields.length, 'Choose each field once.');
export type SnapshotField = z.infer<typeof snapshotFields>[number];
export const sourceReference = z.object({ kind: z.enum(['item', 'log']), id }).strict();
const selectionBody = sourceReference
  .extend({
    fields: snapshotFields,
    photoIds: z
      .array(id)
      .max(4)
      .refine((ids) => new Set(ids).size === ids.length, 'Choose each photo once.'),
  })
  .strict();
export const sourceSelection = selectionBody.superRefine((value, context) => {
  if (
    value.fields.some((field) =>
      value.kind === 'item' ? field === 'results' : ['type', 'decision', 'rank'].includes(field),
    )
  )
    context.addIssue({ code: 'custom', message: 'Choose fields that belong to this record kind.' });
});
export type SourceSelection = z.infer<typeof sourceSelection>;
const recordedResults = logInput
  .pick({
    amount: true,
    unit: true,
    sets: true,
    reps: true,
    exerciseSets: true,
    weightUnit: true,
    measurements: true,
    exercise: true,
  })
  .strict();
export const snapshotData = z
  .object({
    title: z.string().min(1).max(120),
    type: z.string().max(60).optional(),
    decision: z.enum(['favorite', 'meh', 'would_not_again']).nullable().optional(),
    rank: z.number().int().positive().max(500).nullable().optional(),
    dates: z
      .union([
        z.object({ startedOn: day.nullable(), endedOn: day.nullable() }).strict(),
        z.object({ happenedOn: day }).strict(),
      ])
      .optional(),
    results: recordedResults.optional(),
    note: z.string().max(4000).optional(),
  })
  .strict();
export type SnapshotData = z.infer<typeof snapshotData>;
export const snapshotPhoto = z
  .object({
    id,
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    caption: z.string().max(500),
    arrows: z
      .array(photoArrow)
      .max(6)
      .refine(
        (arrows) => new Set(arrows.map((arrow) => arrow.id)).size === arrows.length,
        'Use each arrow once.',
      ),
    available: z.boolean(),
  })
  .strict();
export const sourcePreview = z
  .object({
    selection: sourceSelection,
    listName: z.string().min(1).max(80),
    data: snapshotData,
    photos: z.array(snapshotPhoto).max(4),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    previewedAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, context) => {
    const wanted = new Set(value.selection.fields),
      actual = selectedSnapshotFields(value.data);
    if (wanted.size !== actual.length || actual.some((field) => !wanted.has(field)))
      context.addIssue({ code: 'custom', message: 'Review exactly the chosen source fields.' });
    const ids = new Set(value.photos.map((photo) => photo.id));
    if (
      ids.size !== value.photos.length ||
      ids.size !== value.selection.photoIds.length ||
      value.selection.photoIds.some((id) => !ids.has(id)) ||
      value.photos.some((photo) => !photo.available)
    )
      context.addIssue({ code: 'custom', message: 'Review each chosen available photo once.' });
  });
export type SourcePreview = z.infer<typeof sourcePreview>;
export function selectedSnapshotFields(data: SnapshotData): SnapshotField[] {
  return (Object.keys(data) as (keyof SnapshotData)[]).filter((key): key is SnapshotField => key !== 'title');
}
export async function sourceReviewHash(
  value: Pick<SourcePreview, 'selection' | 'listName' | 'data' | 'photos'>,
): Promise<string> {
  const raw = {
    selection: sourceSelection.parse(value.selection),
    listName: value.listName,
    data: snapshotData.parse(value.data),
    photos: value.photos.map((photo) => snapshotPhoto.parse(photo)),
  };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(raw)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function defaultSnapshotSelection(reference: z.infer<typeof sourceReference>): SourceSelection {
  return {
    kind: reference.kind,
    id: reference.id,
    fields: reference.kind === 'item' ? ['type', 'decision', 'rank', 'dates'] : ['dates', 'results'],
    photoIds: [],
  };
}
