import { z } from 'zod';
import { collectionItemTitleLimit } from './collection-capture';

const shortText = (max: number) => z.string().trim().min(1).max(max);
const note = z.string().trim().max(4000);
const itemDecision = z.enum(['favorite', 'meh', 'would_not_again']).nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid date');

const artwork = z
  .object({
    object: z.enum(['cup', 'ticket', 'place', 'car', 'snack', 'bag']),
    tone: z.enum(['sage', 'clay', 'butter']),
  })
  .nullable();

export const listInput = z.object({
  name: shortText(80),
  kind: z.enum(['collection', 'activity']),
  description: z.string().trim().max(280).default(''),
  artwork: artwork.default(null),
});

export const listPatch = listInput
  .pick({ name: true, description: true, artwork: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const itemInput = z
  .object({
    title: shortText(collectionItemTitleLimit),
    type: z.string().trim().max(60).default(''),
    note: note.default(''),
    decision: itemDecision.default(null),
    startedOn: date.nullable().default(null),
    endedOn: date.nullable().default(null),
  })
  .refine((value) => !value.startedOn || !value.endedOn || value.startedOn <= value.endedOn, {
    message: 'End date must follow start date',
    path: ['endedOn'],
  });

export const itemPatch = z
  .object({
    title: shortText(collectionItemTitleLimit).optional(),
    type: z.string().trim().max(60).optional(),
    note: note.optional(),
    decision: itemDecision.optional(),
    startedOn: date.nullable().optional(),
    endedOn: date.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const itemsBatchInput = z.object({
  titles: z
    .array(shortText(collectionItemTitleLimit))
    .min(1)
    .max(30)
    .refine((titles) => new Set(titles.map((title) => title.toLocaleLowerCase())).size === titles.length, {
      message: 'Each title can only appear once in this batch',
    }),
});

export const logInput = z.object({
  exerciseSets: z
    .array(
      z.object({
        reps: z.number().int().positive().max(10000),
        weight: z.number().finite().nonnegative().max(100000).nullable(),
      }),
    )
    .max(100)
    .default([]),
  weightUnit: z.enum(['kg', 'lb']).default('kg'),
  itemId: z.string().uuid().nullable().default(null),
  title: z.string().trim().max(120).default(''),
  happenedOn: date,
  note: note.default(''),
  amount: z.number().finite().nonnegative().nullable().default(null),
  unit: z.string().trim().max(24).default(''),
  sets: z.number().int().positive().max(1000).nullable().default(null),
  reps: z.number().int().positive().max(10000).nullable().default(null),
});

export const logPatch = logInput.partial().refine((value) => Object.keys(value).length > 0);

export const rankInput = z.object({
  itemIds: z
    .array(z.string().uuid())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
  expectedRevision: z.number().int().nonnegative(),
});

export const shareInput = z.object({ limit: z.union([z.literal(5), z.literal(10), z.literal('all')]) });
