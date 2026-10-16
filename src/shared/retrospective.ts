import { z } from 'zod';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Choose a real date.');
export const retrospectiveFilter = z
  .object({
    from: day,
    to: day,
    listId: z.union([z.literal(''), z.string().uuid()]),
    includeArchived: z.boolean(),
    startOffset: z.number().min(-840).max(840),
    endOffset: z.number().min(-840).max(840),
  })
  .strict()
  .superRefine((value, context) => {
    const length = Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`);
    const bounds = retrospectiveBounds(value);
    if (length < 0 || length >= 366 * 86400000 || bounds.end <= bounds.start)
      context.addIssue({
        code: 'custom',
        message: 'Choose a period of one to 366 days, with the end on or after the start.',
      });
  });
export type RetrospectiveFilter = z.infer<typeof retrospectiveFilter>;
export const retrospectiveDraft = z
  .object({
    from: z.string().max(10),
    to: z.string().max(10),
    listId: z.union([z.literal(''), z.string().uuid()]),
    includeArchived: z.boolean(),
    notes: z.boolean(),
  })
  .strict();
export type RetrospectiveDraft = z.infer<typeof retrospectiveDraft>;
const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function retrospectivePeriod(period: 'month' | 'last-month' | 'year', now = new Date()) {
  const start = new Date(
    now.getFullYear(),
    period === 'year' ? 0 : now.getMonth() - (period === 'last-month' ? 1 : 0),
    1,
  );
  const end = period === 'last-month' ? new Date(now.getFullYear(), now.getMonth(), 0) : now;
  return { from: localDay(start), to: localDay(end) };
}
export function localRetrospectiveFilter(draft: RetrospectiveDraft): RetrospectiveFilter {
  const startUtc = Date.parse(`${draft.from}T00:00:00Z`),
    endUtc = Date.parse(`${draft.to}T00:00:00Z`) + 86400000;
  const start = new Date(`${draft.from}T00:00:00`);
  const end = Number.isFinite(endUtc)
    ? new Date(`${new Date(endUtc).toISOString().split('T')[0]}T00:00:00`)
    : new Date(NaN);
  // Use the actual local day boundary, including zones whose midnight falls in a clock gap.
  return retrospectiveFilter.parse({
    from: draft.from,
    to: draft.to,
    listId: draft.listId,
    includeArchived: draft.includeArchived,
    startOffset: (start.valueOf() - startUtc) / 60000,
    endOffset: (end.valueOf() - endUtc) / 60000,
  });
}
export function retrospectiveBounds(filter: RetrospectiveFilter) {
  return {
    start: Math.round(Date.parse(`${filter.from}T00:00:00Z`) + filter.startOffset * 60000),
    end: Math.round(Date.parse(`${filter.to}T00:00:00Z`) + 86400000 + filter.endOffset * 60000),
  };
}
export interface RetrospectiveRecord {
  id: string;
  listId: string | null;
  listName: string;
  archived: boolean;
  kind: 'item' | 'inbox' | 'visit' | 'activity';
  title: string;
  note: string;
  createdAt: number;
  happenedOn: string | null;
}
export interface Retrospective {
  period: RetrospectiveFilter;
  scopeName: string;
  readAt: string;
  counts: { kept: number; revisits: number; activity: number };
  kept: RetrospectiveRecord[];
  logs: RetrospectiveRecord[];
}
