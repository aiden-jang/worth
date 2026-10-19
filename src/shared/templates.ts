import { z } from 'zod';
import { listInput } from './validation';
import { collectionFields } from './collection-fields';

export const collectionTemplate = listInput
  .pick({ name: true, description: true, artwork: true })
  .extend({
    id: z.string().uuid(),
    collectionName: z.string().trim().min(1).max(80),
    detailFields: collectionFields.default([]),
  })
  .strict();
export type CollectionTemplate = z.infer<typeof collectionTemplate>;
export const collectionTemplates = z
  .array(collectionTemplate)
  .max(50)
  .refine(
    (templates) => new Set(templates.map((template) => template.id)).size === templates.length,
    'Use each template ID once.',
  );
