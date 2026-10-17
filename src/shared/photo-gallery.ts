import { z } from 'zod';
const id = z.string().uuid();
const point = z.number().finite().min(0).max(1);
export const photoArrow = z
  .object({
    id,
    fromX: point,
    fromY: point,
    toX: point,
    toY: point,
    label: z.string().max(120),
  })
  .strict()
  .refine(
    (arrow) => arrow.fromX !== arrow.toX || arrow.fromY !== arrow.toY,
    'Give this arrow a start and an end',
  );
export const galleryEntries = z
  .array(
    z
      .object({
        id,
        caption: z.string().max(500),
        arrows: z
          .array(photoArrow)
          .max(6)
          .refine((arrows) => new Set(arrows.map((a) => a.id)).size === arrows.length, 'Use each arrow once'),
      })
      .strict(),
  )
  .max(12)
  .refine(
    (entries) => new Set(entries.map((entry) => entry.id)).size === entries.length,
    'Use each photo once',
  );
export type GalleryEntry = z.infer<typeof galleryEntries>[number];
export const galleryChoices = z
  .object({ entries: galleryEntries, coverId: id.nullable() })
  .strict()
  .refine(
    (value) => value.coverId === null || value.entries.some((entry) => entry.id === value.coverId),
    'Choose a cover from these photos',
  );
export const galleryPatch = galleryChoices
  .innerType()
  .extend({ expectedRevision: z.number().int().nonnegative() })
  .strict()
  .superRefine((value, context) => {
    const parsed = galleryChoices.safeParse({ entries: value.entries, coverId: value.coverId });
    if (!parsed.success) context.addIssue({ code: 'custom', message: parsed.error.issues[0].message });
  });
export const gallerySource = z
  .object({
    id,
    kind: z.enum(['item', 'log']),
    recordId: id,
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    fingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    createdAt: z.number().int().nonnegative(),
    available: z.boolean(),
  })
  .strict();
export type GallerySource = z.infer<typeof gallerySource>;
export type PhotoGallery = {
  kind: 'items' | 'logs';
  recordId: string;
  listId: string;
  revision: number;
  coverId: string | null;
  entries: (GalleryEntry & { source: GallerySource })[];
};

const draftArrow = photoArrow.innerType();
const draftMetadata = z
  .object({
    entries: z
      .array(z.object({ id, caption: z.string().max(500), arrows: z.array(draftArrow).max(6) }).strict())
      .max(12),
    coverId: id.nullable(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const galleryDraft = z.object({ current: draftMetadata, previous: draftMetadata.nullable() }).strict();
export type GalleryDraft = z.infer<typeof galleryDraft>;
