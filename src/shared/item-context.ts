import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max).default('');
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Choose a real date')
  .nullable()
  .default(null);
const labels = (max: number, length: number) =>
  z
    .array(z.string().trim().min(1).max(length))
    .max(max)
    .refine(
      (values) => new Set(values.map((value) => value.toLocaleLowerCase())).size === values.length,
      'Use each label once',
    )
    .default([]);
const itemContextFields = z
  .object({
    revisit: z.object({ on: day, snoozedUntil: day }).strict().prefault({}),
    sourceUrl: text(1000).refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    }, 'Use an http or https link without login credentials'),
    whySaved: text(500),
    recommendedBy: text(120),
    recommendation: text(500),
    followUp: text(500),
    location: text(120),
    version: text(120),
    labels: labels(12, 32),
    stamps: labels(8, 48),
    fields: z
      .array(z.object({ name: z.string().trim().min(1).max(40), value: text(240) }).strict())
      .max(12)
      .refine(
        (fields) => new Set(fields.map((field) => field.name.toLocaleLowerCase())).size === fields.length,
        'Use each detail name once',
      )
      .default([]),
    purchase: z
      .object({
        boughtOn: day,
        price: z.number().finite().min(0).max(1_000_000_000).nullable().default(null),
        currency: text(3).refine(
          (value) => !value || /^[A-Z]{3}$/.test(value),
          'Use a three-letter currency code such as USD',
        ),
        returnBy: day,
        status: z.enum(['unspecified', 'using', 'stored', 'passed_on', 'returned']).default('unspecified'),
      })
      .strict()
      .prefault({}),
    loan: z
      .object({
        direction: z.enum(['none', 'borrowed', 'lent']).default('none'),
        person: text(120),
        startedOn: day,
        returnBy: day,
        returnedOn: day,
      })
      .strict()
      .prefault({}),
  })
  .strict();
export const itemContext = itemContextFields.superRefine((value, context) => {
  const bad = (path: (string | number)[], message: string) =>
    context.addIssue({ code: 'custom', path, message });
  if (value.revisit.snoozedUntil && (!value.revisit.on || value.revisit.snoozedUntil < value.revisit.on))
    bad(['revisit', 'snoozedUntil'], 'Choose a revisit date first and snooze to that day or later');
  if (value.purchase.price !== null && !value.purchase.currency)
    bad(['purchase', 'currency'], 'Add a currency for this price');
  if (value.purchase.boughtOn && value.purchase.returnBy && value.purchase.returnBy < value.purchase.boughtOn)
    bad(['purchase', 'returnBy'], 'Return deadline must follow the purchase date');
  if (value.loan.startedOn && value.loan.returnedOn && value.loan.returnedOn < value.loan.startedOn)
    bad(['loan', 'returnedOn'], 'Returned date must follow the loan date');
  if (value.loan.startedOn && value.loan.returnBy && value.loan.returnBy < value.loan.startedOn)
    bad(['loan', 'returnBy'], 'Return deadline must follow the loan date');
});
export type ItemContext = z.infer<typeof itemContext>;
export const emptyItemContext: ItemContext = itemContext.parse({});
export function contextSearchText(value: ItemContext | undefined): string {
  if (!value) return '';
  return [
    value.sourceUrl,
    value.whySaved,
    value.recommendedBy,
    value.recommendation,
    value.followUp,
    value.location,
    value.version,
    ...value.labels,
    ...value.stamps,
    ...value.fields.flatMap((field) => [field.name, field.value]),
    value.revisit?.on,
    value.revisit?.snoozedUntil,
    value.purchase.boughtOn,
    value.purchase.returnBy,
    value.purchase.price === null ? '' : `${value.purchase.price} ${value.purchase.currency}`,
    value.purchase.status === 'unspecified' ? '' : value.purchase.status,
    value.loan.person,
    value.loan.startedOn,
    value.loan.returnBy,
    value.loan.returnedOn,
  ]
    .filter(Boolean)
    .join(' ');
}
export const itemContextDraft = itemContextFields.extend({
  sourceUrl: z.string().max(1000),
  fields: z.array(z.object({ name: z.string().max(40), value: z.string().max(240) })).max(12),
  purchase: itemContextFields.shape.purchase
    .unwrap()
    .extend({ currency: z.string().max(3), price: z.number().finite().nullable() }),
});

export function calendarReminder(
  title: string,
  date: string,
  now = new Date(),
  id = crypto.randomUUID(),
): string {
  day.parse(date);
  const escape = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Worth//Return reminder//EN',
    'BEGIN:VEVENT',
    `UID:${id}@worth.aidenjang.com`,
    `DTSTAMP:${now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`,
    'DURATION:P1D',
    `SUMMARY:${escape(title)}`,
    'DESCRIPTION:An optional reminder from Worth.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-P1D',
    'DESCRIPTION:Worth return reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return (
    lines
      .map((line) => {
        const chunks: string[] = [];
        let chunk = '',
          size = 0;
        for (const character of line) {
          const bytes = new TextEncoder().encode(character).length;
          if (size + bytes > 74) {
            chunks.push(chunk);
            chunk = ' ';
            size = 1;
          }
          chunk += character;
          size += bytes;
        }
        chunks.push(chunk);
        return chunks.join('\r\n');
      })
      .join('\r\n') + '\r\n'
  );
}
