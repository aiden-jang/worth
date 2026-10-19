import { z } from 'zod';
export const visitContext = z
  .object({
    location: z.string().trim().max(120).default(''),
    version: z.string().trim().max(120).default(''),
    order: z.string().trim().max(500).default(''),
    reaction: z.enum(['favorite', 'meh', 'would_not_again']).nullable().default(null),
  })
  .strict();
export type VisitContext = z.infer<typeof visitContext>;
export const emptyVisitContext: VisitContext = visitContext.parse({});
export const hasVisitContext = (value: VisitContext | undefined) =>
  !!value && Boolean(value.location || value.version || value.order || value.reaction);
export const visitReactionLabel = (value: VisitContext['reaction']) =>
  value === 'favorite'
    ? 'Favorite this time'
    : value === 'meh'
      ? 'Meh this time'
      : value === 'would_not_again'
        ? 'Not again this time'
        : 'No reaction';
