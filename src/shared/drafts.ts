import { z } from 'zod';
import type { ItemInput, LogInput } from '../api';
import { logInput } from './validation';
import { measurementDrafts } from './activity-plans';
import { itemContextDraft } from './item-context';
const itemDraft = z.object({
  context: itemContextDraft.optional(),
  expectedContextRevision: z.number().int().nonnegative().optional(),
  title: z.string().max(120),
  type: z.string().max(60),
  note: z.string().max(4000),
  decision: z.enum(['favorite', 'meh', 'would_not_again']).nullable(),
  startedOn: z.string().nullable(),
  endedOn: z.string().nullable(),
  wantToTry: z.boolean().optional(),
  revisitQueued: z.boolean().optional(),
});
const logDraft = logInput.extend({
  expectedRevision: z.number().int().nonnegative().optional(),
  measurements: measurementDrafts.optional(),
  exerciseSets: z.array(z.object({ reps: z.number().nullable(), weight: z.number().nullable() })).max(100),
});
export function isItemDraft(value: unknown): value is ItemInput {
  return itemDraft.safeParse(value).success;
}
export function isLogDraft(value: unknown): value is LogInput {
  return logDraft.safeParse(value).success;
}
