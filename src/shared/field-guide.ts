import { z } from 'zod';
import type { Item } from './models';
import { bookletEntries, type BookletData } from './booklet';
const selected = z
  .object({
    id: z.string().uuid(),
    listId: z.string().uuid(),
    title: z.string().max(120),
    caption: z.string().max(300),
  })
  .strict();
const fieldGuideDraft = z
  .object({
    title: z.string().max(120),
    introduction: z.string().max(280),
    entries: z
      .array(selected)
      .max(12)
      .refine((entries) => new Set(entries.map((e) => e.id)).size === entries.length),
    notes: z.boolean(),
    photos: z.boolean(),
    locations: z.boolean(),
    collections: z.boolean(),
    includeArchived: z.boolean(),
  })
  .strict();
export type FieldGuideDraft = z.infer<typeof fieldGuideDraft>;
export const emptyFieldGuide: FieldGuideDraft = {
  title: 'Field guide',
  introduction: '',
  entries: [],
  notes: false,
  photos: false,
  locations: false,
  collections: false,
  includeArchived: false,
};
export function isFieldGuideDraft(value: unknown): value is FieldGuideDraft {
  return fieldGuideDraft.safeParse(value).success;
}
export function fieldGuideData(
  draft: FieldGuideDraft,
  items: Item[],
  listNames: Map<string, string>,
): BookletData {
  const byId = new Map(items.map((item) => [item.id, item]));
  const captions = Object.fromEntries(
    draft.entries.map((entry) => {
      const item = byId.get(entry.id);
      return [
        entry.id,
        [
          entry.caption,
          draft.locations && item?.context?.location ? `Where: ${item.context.location}` : '',
          draft.collections && item
            ? `Collection: ${listNames.get(item.listId) ?? 'Unavailable collection'}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      ];
    }),
  );
  return {
    format: 'guide',
    title: draft.title.trim() || 'Field guide',
    dedication: draft.introduction,
    entries: bookletEntries(
      items,
      draft.entries.map((entry) => entry.id),
      [],
      { ranks: false, calls: false, notes: draft.notes, photos: draft.photos },
      captions,
    ),
  };
}
