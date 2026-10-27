import { z } from 'zod';
import {
  snapshotData,
  snapshotPhoto,
  sourceReference,
  sourceSelection,
  sourcePreview,
  selectedSnapshotFields,
} from './record-snapshots';
const id = z.string().uuid();
const timestamp = z.number().int().nonnegative().max(8640000000000000);
export const capsuleLimit = 25;
export function dayInZone(time: number, zone: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}
const opening = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    zone: z.string().min(1).max(80),
    opensAt: timestamp,
  })
  .strict()
  .refine((value) => {
    try {
      return dayInZone(value.opensAt, value.zone) === value.day;
    } catch {
      return false;
    }
  }, 'Choose a valid opening date and timezone.');
export type CapsuleOpening = z.infer<typeof opening>;
export function localCapsuleOpening(day: string): CapsuleOpening | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const opensAt = new Date(`${day}T00:00:00`).valueOf();
  const parsed = opening.safeParse({ day, zone, opensAt });
  return parsed.success ? parsed.data : null;
}
const copiedPhoto = snapshotPhoto
  .extend({ sourceAssetId: id.nullable(), sourceMissing: z.boolean() })
  .strict()
  .refine(
    (value) => value.sourceMissing === (value.sourceAssetId === null),
    'Mark unavailable photo sources explicitly.',
  );
const entry = z
  .object({
    id,
    kind: z.enum(['item', 'log']),
    reference: sourceReference.nullable(),
    referenceMissing: z.boolean(),
    listName: z.string().min(1).max(80),
    data: snapshotData,
    photos: z.array(copiedPhoto).max(4),
  })
  .strict()
  .superRefine((value, context) => {
    const fields = selectedSnapshotFields(value.data);
    if (
      value.referenceMissing !== (value.reference === null) ||
      (value.reference && value.reference.kind !== value.kind)
    )
      context.addIssue({ code: 'custom', message: 'Mark unavailable record sources explicitly.' });
    if (
      fields.some((field) =>
        value.kind === 'item' ? field === 'results' : ['type', 'decision', 'rank'].includes(field),
      )
    )
      context.addIssue({ code: 'custom', message: 'Snapshot fields must match the record kind.' });
    if (
      value.data.dates &&
      (value.kind === 'item' ? !('startedOn' in value.data.dates) : !('happenedOn' in value.data.dates))
    )
      context.addIssue({ code: 'custom', message: 'Snapshot dates must match the record kind.' });
    if (new Set(value.photos.map((photo) => photo.id)).size !== value.photos.length)
      context.addIssue({ code: 'custom', message: 'Use each copied photo once.' });
  });
const identity = {
  name: z
    .string()
    .max(80)
    .refine((value) => !!value.trim(), 'Give this capsule a name.'),
  message: z.string().max(4000),
  opening,
};
export const capsuleBody = z
  .object({ ...identity, entries: z.array(entry).max(6) })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.entries.map((entry) => entry.id)).size !== value.entries.length)
      context.addIssue({ code: 'custom', message: 'Use each capsule entry once.' });
    const photos = value.entries.flatMap((entry) => entry.photos);
    if (photos.length > 4 || new Set(photos.map((photo) => photo.id)).size !== photos.length)
      context.addIssue({ code: 'custom', message: 'Choose up to four distinct copied photos.' });
  });
export const capsuleInput = z
  .object({
    ...identity,
    sources: z
      .array(z.object({ id, selection: sourceSelection, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict())
      .max(6),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.sources.map((source) => source.id)).size !== value.sources.length ||
      new Set(value.sources.map((source) => `${source.selection.kind}:${source.selection.id}`)).size !==
        value.sources.length
    )
      context.addIssue({ code: 'custom', message: 'Choose each source once.' });
    if (value.sources.reduce((sum, source) => sum + source.selection.photoIds.length, 0) > 4)
      context.addIssue({ code: 'custom', message: 'Choose up to four photos across this capsule.' });
  });
export type CapsuleInput = z.infer<typeof capsuleInput>;
export const savedCapsule = capsuleBody
  .safeExtend({ id, createdAt: timestamp, openedAt: timestamp.nullable() })
  .strict()
  .superRefine((value, context) => {
    if (
      value.openedAt !== null &&
      (value.openedAt < value.opening.opensAt || value.openedAt < value.createdAt)
    )
      context.addIssue({
        code: 'custom',
        message: 'A capsule cannot be opened before its date or creation.',
      });
  });
export type SavedCapsule = z.infer<typeof savedCapsule>;
export type CapsuleSummary = {
  id: string;
  name: string;
  opening: CapsuleOpening;
  createdAt: number;
  openedAt: number | null;
  entryCount: number;
  ready: boolean;
};
export type CapsuleCurrent = {
  entryId: string;
  available: boolean;
  listName?: string;
  data?: z.infer<typeof snapshotData>;
  photos: {
    sourceAssetId: string;
    available: boolean;
    caption: string;
    arrows: z.infer<typeof snapshotPhoto>['arrows'];
  }[];
};
export type CapsuleView = {
  summary: CapsuleSummary;
  serverNow: number;
  capsule: SavedCapsule | null;
  current: CapsuleCurrent[];
};
export const capsuleDraft = z
  .object({
    name: z.string().max(80),
    message: z.string().max(4000),
    day: z.string().max(10),
    opening: opening.nullable(),
    sources: z.array(z.object({ id, preview: sourcePreview }).strict()).max(6),
    pending: capsuleInput.nullable(),
  })
  .strict();
export type CapsuleDraft = z.infer<typeof capsuleDraft>;
export function emptyCapsule(): CapsuleDraft {
  return { name: '', message: '', day: '', opening: null, sources: [], pending: null };
}
export function capsulePayload(draft: CapsuleDraft): CapsuleInput {
  if (!draft.opening || draft.day !== draft.opening.day)
    throw new Error('Choose and review the opening date again. Your message and source reviews are kept.');
  const parsed = capsuleInput.safeParse({
    name: draft.name,
    message: draft.message,
    opening: draft.opening,
    sources: draft.sources.map((source) => ({
      id: source.id,
      selection: source.preview.selection,
      hash: source.preview.hash,
    })),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check this capsule.');
  return parsed.data;
}
export function normalizeCapsuleReferences(
  capsule: SavedCapsule,
  items: ReadonlySet<string>,
  logs: ReadonlySet<string>,
  photos: ReadonlySet<string>,
): SavedCapsule {
  return {
    ...capsule,
    entries: capsule.entries.map((entry) => {
      const available = entry.reference && (entry.kind === 'item' ? items : logs).has(entry.reference.id);
      return {
        ...entry,
        reference: available ? entry.reference : null,
        referenceMissing: !available,
        photos: entry.photos.map((photo) => {
          const present = photo.sourceAssetId && photos.has(photo.sourceAssetId);
          return { ...photo, sourceAssetId: present ? photo.sourceAssetId : null, sourceMissing: !present };
        }),
      };
    }),
  };
}
