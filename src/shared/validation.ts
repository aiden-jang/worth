import { z } from 'zod';
import { collectionFields } from './collection-fields';
import { visitContext } from './visit-context';
import { collectionItemTitleLimit } from './collection-capture';
import { itemContext, emptyItemContext } from './item-context';

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
    object: z.enum(['cup', 'ticket', 'place', 'car', 'snack', 'bag', 'ramen', 'sneaker', 'plant', 'camera']),
    tone: z.enum(['sage', 'clay', 'butter']),
  })
  .nullable();

export const listInput = z.object({
  name: shortText(80),
  kind: z.enum(['collection', 'activity']),
  description: z.string().trim().max(280).default(''),
  artwork: artwork.default(null),
});

export const listCreate = listInput
  .extend({ detailFields: collectionFields.default([]) })
  .refine(
    (value) => value.kind === 'collection' || !value.detailFields.length,
    'Reusable details belong to collections.',
  );

export const listPatch = listInput
  .pick({ name: true, description: true, artwork: true })
  .extend({ archived: z.boolean() })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const itemInput = z
  .object({
    context: itemContext.default(emptyItemContext),
    title: shortText(collectionItemTitleLimit),
    type: z.string().trim().max(60).default(''),
    note: note.default(''),
    decision: itemDecision.default(null),
    revisitQueued: z.boolean().default(false),
    wantToTry: z.boolean().default(false),
    startedOn: date.nullable().default(null),
    endedOn: date.nullable().default(null),
  })
  .refine((value) => !value.startedOn || !value.endedOn || value.startedOn <= value.endedOn, {
    message: 'End date must follow start date',
    path: ['endedOn'],
  });

export const itemPatch = z
  .object({
    context: itemContext.optional(),
    expectedContextRevision: z.number().int().nonnegative().optional(),
    title: shortText(collectionItemTitleLimit).optional(),
    type: z.string().trim().max(60).optional(),
    note: note.optional(),
    decision: itemDecision.optional(),
    revisitQueued: z.boolean().optional(),
    wantToTry: z.boolean().optional(),
    startedOn: date.nullable().optional(),
    endedOn: date.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const itemsBatchInput = z.object({
  wantToTry: z.boolean().default(false),
  titles: z
    .array(shortText(collectionItemTitleLimit))
    .min(1)
    .max(30)
    .refine((titles) => new Set(titles.map((title) => title.toLocaleLowerCase())).size === titles.length, {
      message: 'Each title can only appear once in this batch',
    }),
});

const plannedExercises = z
  .array(shortText(120))
  .max(40)
  .refine(
    (names) => new Set(names.map((name) => name.replace(/\s+/g, ' ').toLowerCase())).size === names.length,
    'Each exercise can only appear once',
  );
export const routineInput = z.object({
  title: shortText(80),
  exercises: plannedExercises.refine((names) => names.length > 0, 'Add at least one exercise'),
});
export const workoutInput = z.object({
  title: z.string().trim().max(80).default(''),
  happenedOn: date,
  routineId: z.string().uuid().optional(),
});
export const workoutPatch = workoutInput
  .omit({ routineId: true })
  .extend({ status: z.enum(['active', 'finished']), plannedExercises, skippedExercises: plannedExercises })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const logInput = z.object({
  context: visitContext.default({}),
  workoutId: z.string().uuid().nullable().default(null),
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

export const logPatch = logInput
  .extend({ expectedRevision: z.number().int().nonnegative().optional() })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const rankInput = z.object({
  itemIds: z
    .array(z.string().uuid())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
  expectedRevision: z.number().int().nonnegative(),
});

export const shareInput = z.object({ limit: z.union([z.literal(5), z.literal(10), z.literal('all')]) });

export const archiveActionInput = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move'),
    itemIds: z.array(z.string().uuid()).min(1).max(100),
    destinationId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('merge'),
    itemIds: z.array(z.string().uuid()).min(2).max(20),
    targetId: z.string().uuid(),
  }),
  z.object({ action: z.literal('trash'), itemIds: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({
    action: z.literal('queue'),
    itemIds: z.array(z.string().uuid()).min(1).max(100),
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('want'),
    itemIds: z.array(z.string().uuid()).min(1).max(100),
    value: z.boolean(),
  }),
  z.object({
    action: z.literal('type'),
    itemIds: z.array(z.string().uuid()).min(1).max(100),
    value: z.string().trim().max(60),
  }),
]);
