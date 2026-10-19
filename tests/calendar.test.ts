import { expect, test } from 'vitest';
import { calendarDays, calendarFilter, shiftCalendarMonth } from '../src/shared/activity-calendar';
import { itemContext, itemContextDraft, contextSearchText } from '../src/shared/item-context';

test('calendar months keep literal leap dates and clamp navigation at supported boundaries', () => {
  expect(calendarDays('2024-02')).toHaveLength(29);
  expect(calendarDays('2026-02')).toHaveLength(28);
  expect(calendarDays('0099-02')[0]).toBe('0099-02-01');
  expect(calendarDays('9999-12').at(-1)).toBe('9999-12-31');
  expect(shiftCalendarMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftCalendarMonth('9999-12', 1)).toBe('9999-12');
  expect(shiftCalendarMonth('0000-01', -1)).toBe('0000-01');
  expect(calendarFilter.safeParse({ month: '', day: '-01', includeArchived: false }).success).toBe(false);
  expect(
    calendarFilter.safeParse({ month: '2026-02', day: '2026-02-29', includeArchived: false }).success,
  ).toBe(false);
  expect(
    calendarFilter.safeParse({ month: '2026-02', day: '2026-03-01', includeArchived: false }).success,
  ).toBe(false);
});
test('revisit plans are optional, snooze retains the original date and invalid plans stay recoverable as drafts', () => {
  expect(itemContext.parse({}).revisit).toEqual({ on: null, snoozedUntil: null });
  const plan = itemContext.parse({ revisit: { on: '2026-10-17', snoozedUntil: '2026-10-24' } });
  expect(plan.revisit.on).toBe('2026-10-17');
  expect(contextSearchText(plan)).toContain('2026-10-24');
  for (const revisit of [
    { on: null, snoozedUntil: '2026-10-24' },
    { on: '2026-10-17', snoozedUntil: '2026-10-16' },
    { on: '2026-02-30' },
  ])
    expect(itemContext.safeParse({ revisit }).success).toBe(false);
  expect(
    itemContextDraft.safeParse({ ...plan, revisit: { on: '2026-10-17', snoozedUntil: '2026-10-16' } })
      .success,
  ).toBe(true);
});
