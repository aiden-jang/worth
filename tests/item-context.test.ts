import { expect, test } from 'vitest';
import {
  calendarReminder,
  contextSearchText,
  emptyItemContext,
  itemContext,
  itemContextDraft,
} from '../src/shared/item-context';

test('optional context keeps prices, personal labels and recommendations independent of calls', () => {
  const context = itemContext.parse({
    whySaved: 'For rainy Sundays',
    recommendedBy: 'Mina',
    labels: ['comfort watch'],
    stamps: ['worth the detour'],
    purchase: { price: 0, currency: 'USD' },
  });
  expect(context.purchase.price).toBe(0);
  expect(contextSearchText(context)).toContain('Mina');
  expect(contextSearchText(context)).toContain('comfort watch');
  expect(contextSearchText(undefined)).toBe('');
  expect(contextSearchText(emptyItemContext)).not.toContain('unspecified');
  expect(itemContext.safeParse({ purchase: { price: 20 } }).success).toBe(false);
  expect(itemContext.safeParse({ labels: ['Fine', 'fine'] }).success).toBe(false);
  expect(itemContext.safeParse({ purchase: { boughtOn: '2026-02-30' } }).success).toBe(false);
});

test('source links reject executable URLs and credentials while incomplete local drafts survive', () => {
  for (const sourceUrl of ['javascript:alert(1)', 'data:text/html,test', 'https://name:secret@example.test'])
    expect(itemContext.safeParse({ sourceUrl }).success).toBe(false);
  expect(itemContext.safeParse({ sourceUrl: 'https://example.test/a?b=c' }).success).toBe(true);
  const draft = {
    ...emptyItemContext,
    sourceUrl: 'https:',
    fields: [{ name: '', value: 'Still writing' }],
    purchase: { ...emptyItemContext.purchase, price: 12, currency: '' },
  };
  expect(itemContextDraft.safeParse(draft).success).toBe(true);
  expect(itemContext.safeParse(draft).success).toBe(false);
});

test('calendar text safely escapes lines and folds Unicode titles without disclosing other context', () => {
  const calendar = calendarReminder(
    'Return: café, book;\rBEGIN:VEVENT\n' + '🌱'.repeat(60),
    '2026-11-01',
    new Date('2026-10-15T12:00:00Z'),
    '00000000-0000-4000-8000-000000000001',
  );
  expect(calendar).toContain('DTSTART;VALUE=DATE:20261101\r\n');
  expect(calendar).toContain('TRIGGER:-P1D');
  expect(calendar.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
  expect(calendar).toContain('book\\;\\nBEGIN:VEVENT\\n');
  for (const line of calendar.split('\r\n'))
    expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
  expect(() => calendarReminder('Return', '2026-02-30')).toThrow();
});
