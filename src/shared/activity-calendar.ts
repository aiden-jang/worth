import { z } from 'zod';

const calendarMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export function calendarDays(month: string): string[] {
  calendarMonth.parse(month);
  const start = new Date(`${month}-01T00:00:00Z`);
  return Array.from({ length: 31 }, (_, index) => {
    const day = new Date(start.valueOf() + index * 86400000).toISOString().slice(0, 10);
    return day.startsWith(month) ? day : '';
  }).filter(Boolean);
}
export function shiftCalendarMonth(month: string, delta: number): string {
  const date = new Date(`${calendarMonth.parse(month)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const next = date.toISOString().slice(0, 7);
  return calendarMonth.safeParse(next).success ? next : month;
}
export const calendarFilter = z
  .object({
    month: calendarMonth,
    day: z.string(),
    includeArchived: z.boolean(),
  })
  .strict()
  .refine(
    (filter) =>
      calendarMonth.safeParse(filter.month).success && calendarDays(filter.month).includes(filter.day),
    'Choose a day in this month',
  );
export type CalendarFilter = z.infer<typeof calendarFilter>;
export type CalendarEntry = {
  id: string;
  kind: 'revisit' | 'inbox' | 'visit' | 'activity';
  day: string;
  originalDay: string | null;
  title: string;
  listId: string | null;
  listName: string;
  archived: boolean;
};
export type ActivityCalendar = {
  filter: CalendarFilter;
  days: { day: string; planned: number; visits: number; activities: number }[];
  entries: CalendarEntry[];
  next: string | null;
};
export function calendarLabel(kind: CalendarEntry['kind']): string {
  return {
    revisit: 'Planned revisit',
    inbox: 'Planned revisit · Inbox',
    visit: 'Logged visit',
    activity: 'Logged activity',
  }[kind];
}
