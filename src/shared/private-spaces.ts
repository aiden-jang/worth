import { z } from 'zod';
import { snapshotData, sourceSelection } from './record-snapshots';
const id = z.string().uuid(),
  name = z
    .string()
    .max(80)
    .refine((v) => !!v.trim(), 'Enter a name.');
export const spaceInput = z.object({ name }).strict();
export const spaceNoteInput = z
  .object({ note: z.string().max(4000), expectedRevision: z.number().int().nonnegative() })
  .strict();
export const spaceInviteInput = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    role: z.enum(['viewer', 'editor']),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const spaceSnapshotInput = z
  .object({
    selection: sourceSelection.refine(
      (s) => s.photoIds.length === 0,
      'Shared snapshots support selected text fields. Photos stay private.',
    ),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
type SharedEntry = {
  id: string;
  authorId: string;
  authorName: string;
  listName: string;
  data: z.infer<typeof snapshotData>;
};
type SharedMember = {
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  accountId: string | null;
  expiresAt: number;
  revoked: boolean;
};
export type SpaceSummary = {
  id: string;
  name: string;
  role: 'owner' | 'viewer' | 'editor';
  revision: number;
};
export type SpaceView = SpaceSummary & { note: string; entries: SharedEntry[]; members: SharedMember[] };
export const pairInput = z
  .object({
    title: name,
    partnerId: z.string().min(1).max(100),
    options: z.tuple([name, name]).refine((v) => v[0].trim() !== v[1].trim(), 'Use two different options.'),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const pairChoice = z
  .object({ choice: z.number().int().min(0).max(1), expectedRevision: z.number().int().nonnegative() })
  .strict();
export type PairView = {
  id: string;
  title: string;
  options: [string, string];
  ownChoice: number | null;
  ownRevision: number;
  ownRevealed: boolean;
  partnerRevealed: boolean;
  result: { name: string; choice: number }[] | null;
};
const archiveEntry = z
  .object({ id, authorName: z.string().max(160), listName: z.string().max(80), data: snapshotData })
  .strict();
const outcome = z
  .object({
    title: name,
    options: z.tuple([name, name]),
    result: z
      .array(z.object({ name: z.string().max(160), choice: z.number().int().min(0).max(1) }).strict())
      .length(2),
  })
  .strict();
export const sharedArchive = z
  .object({
    id,
    name,
    note: z.string().max(4000),
    entries: z.array(archiveEntry).max(30),
    outcomes: z.array(outcome).max(30),
    savedAt: z.number().int().nonnegative(),
  })
  .strict();
export type SharedArchive = z.infer<typeof sharedArchive>;
