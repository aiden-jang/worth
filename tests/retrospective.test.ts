import { expect, test } from 'vitest';
import {
  localRetrospectiveFilter,
  retrospectiveBounds,
  retrospectiveFilter,
  retrospectivePeriod,
} from '../src/shared/retrospective';

test('retrospective periods validate real bounded dates and device offsets', () => {
  const filter = {
    from: '2026-10-01',
    to: '2026-10-31',
    listId: '',
    includeArchived: false,
    startOffset: 240,
    endOffset: 240,
  };
  expect(retrospectiveBounds(retrospectiveFilter.parse(filter))).toEqual({
    start: Date.parse('2026-10-01T04:00:00Z'),
    end: Date.parse('2026-11-01T04:00:00Z'),
  });
  expect(
    retrospectiveBounds(
      retrospectiveFilter.parse({
        ...filter,
        from: '2026-03-01',
        to: '2026-03-31',
        startOffset: 300,
        endOffset: 240,
      }),
    ),
  ).toEqual({ start: Date.parse('2026-03-01T05:00:00Z'), end: Date.parse('2026-04-01T04:00:00Z') });
  for (const patch of [
    { from: '2026-02-30' },
    { to: '2026-09-01' },
    { from: '2025-01-01' },
    { startOffset: 841 },
    { listId: 'foreign-text' },
    { from: '2026-10-01', to: '2026-10-01', startOffset: 840, endOffset: -840 },
  ])
    expect(retrospectiveFilter.safeParse({ ...filter, ...patch }).success).toBe(false);
  expect(retrospectiveFilter.safeParse({ ...filter, from: '2024-01-01', to: '2024-12-31' }).success).toBe(
    true,
  );
});
test('period shortcuts use the device calendar and only form valid local read boundaries', () => {
  const now = new Date(2026, 0, 16, 12);
  expect(retrospectivePeriod('last-month', now)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  expect(retrospectivePeriod('year', now)).toEqual({ from: '2026-01-01', to: '2026-01-16' });
  const filter = localRetrospectiveFilter({
    ...retrospectivePeriod('month', now),
    listId: '',
    includeArchived: false,
    notes: false,
  });
  const bounds = retrospectiveBounds(filter);
  expect(bounds.start).toBe(new Date(2026, 0, 1).valueOf());
  expect(bounds.end).toBe(new Date(2026, 0, 17).valueOf());
});

test('calendar boundaries retain historical seconds and the final supported calendar day', () => {
  const filter = retrospectiveFilter.parse({
    from: '1800-01-01',
    to: '1800-01-01',
    listId: '',
    includeArchived: false,
    startOffset: 296 + 2 / 60,
    endOffset: 296 + 2 / 60,
  });
  expect(retrospectiveBounds(filter)).toEqual({
    start: Date.parse('1800-01-01T04:56:02Z'),
    end: Date.parse('1800-01-02T04:56:02Z'),
  });
  const last = localRetrospectiveFilter({
    from: '9999-12-31',
    to: '9999-12-31',
    listId: '',
    includeArchived: false,
    notes: false,
  });
  expect(retrospectiveBounds(last).end).toBeGreaterThan(retrospectiveBounds(last).start);
});
