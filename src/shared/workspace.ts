import { z } from 'zod';
const name = z.string().trim().min(1).max(80);
const key = z.string().uuid();
export const collectionShelf = z
  .object({
    style: z.enum(['pockets', 'spines']),
    bookend: z.enum(['none', 'arch', 'plant']),
    dedication: z.string().max(280),
    keepsakeId: key.nullable(),
    inscription: z
      .object({ itemId: key, text: z.string().max(280) })
      .strict()
      .nullable(),
    paperCreature: z.boolean(),
  })
  .strict();
export type ShelfPresentation = z.infer<typeof collectionShelf>;
export const emptyCollectionShelf: ShelfPresentation = {
  style: 'pockets',
  bookend: 'none',
  dedication: '',
  keepsakeId: null,
  inscription: null,
  paperCreature: false,
};
const savedViewFilters = z
  .object({
    label: z.string().max(32).default(''),
    stamp: z.string().max(48).default(''),
    browse: z.enum(['all', 'kept', 'want', 'queue', 'revisited', 'not-opened-lately']),
    search: z.string().max(200),
    type: z.string().max(60),
    rankFilter: z.enum(['all', 'top5', 'top10', 'unranked']),
    decisionFilter: z.enum(['all', 'none', 'favorite', 'meh', 'would_not_again']),
    sort: z.enum(['rank', 'recent', 'name', 'times']),
    addedSince: z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/),
    addedBefore: z.string().regex(/^(|\d{4}-\d{2}-\d{2})$/),
    visits: z.enum(['all', 'never', 'once', 'again']),
  })
  .strict();
const distinct = <T extends { id: string }>(values: T[]) =>
  new Set(values.map((value) => value.id)).size === values.length;
export const collectionWorkspace = z
  .object({
    shelf: collectionShelf.optional(),
    rankings: z
      .array(
        z
          .object({
            id: key,
            name,
            itemIds: z
              .array(key)
              .max(500)
              .refine((ids) => new Set(ids).size === ids.length),
          })
          .strict(),
      )
      .max(20)
      .refine(distinct)
      .default([]),
    views: z
      .array(z.object({ id: key, name, filters: savedViewFilters }).strict())
      .max(30)
      .refine(distinct)
      .default([]),
  })
  .strict();
export type CollectionWorkspace = z.infer<typeof collectionWorkspace>;
export type SavedViewFilters = z.infer<typeof savedViewFilters>;
export type WorkspaceResponse = { workspace: CollectionWorkspace; revision: number };
export const workspaceUpdate = z
  .object({ workspace: collectionWorkspace, expectedRevision: z.number().int().nonnegative() })
  .strict();
export function filterWorkspace(workspace: CollectionWorkspace, itemIds: Set<string>): CollectionWorkspace {
  return {
    ...workspace,
    ...(workspace.shelf
      ? {
          shelf: {
            ...workspace.shelf,
            keepsakeId:
              workspace.shelf.keepsakeId && itemIds.has(workspace.shelf.keepsakeId)
                ? workspace.shelf.keepsakeId
                : null,
            inscription:
              workspace.shelf.inscription && itemIds.has(workspace.shelf.inscription.itemId)
                ? workspace.shelf.inscription
                : null,
          },
        }
      : {}),
    rankings: workspace.rankings.map((ranking) => ({
      ...ranking,
      itemIds: ranking.itemIds.filter((id) => itemIds.has(id)),
    })),
  };
}
