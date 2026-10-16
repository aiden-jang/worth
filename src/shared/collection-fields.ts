import { z } from 'zod';

const detailNameKey = (name: string) =>
  name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const collectionFields = z
  .array(z.string().trim().min(1).max(40, 'Keep each detail name within 40 characters.'))
  .max(12, 'Keep up to 12 detail names.')
  .refine((names) => new Set(names.map(detailNameKey)).size === names.length, 'Use each detail name once.');
export function readFieldNames(text: string) {
  return collectionFields.safeParse(
    text
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean),
  );
}
export function missingFieldNames(names: string[], fields: { name: string }[]) {
  const existing = new Set(fields.map((field) => detailNameKey(field.name)));
  return names.filter((name) => !existing.has(detailNameKey(name)));
}
