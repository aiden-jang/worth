import { z } from 'zod';
import type { SearchResult } from './models';

export const searchPageSize = 40;
export const searchScope = z.enum(['all', 'lists', 'items', 'logs', 'exercises', 'inbox']);
export type SearchScope = z.infer<typeof searchScope>;
export const searchFilter = z.object({
  scope: searchScope.default('all'),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export interface SearchPage {
  results: SearchResult[];
  nextOffset: number | null;
}
