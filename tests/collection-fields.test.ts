import { expect, test } from 'vitest';
import { collectionFields, missingFieldNames, readFieldNames } from '../src/shared/collection-fields';
import { collectionTemplate } from '../src/shared/templates';
import { archiveFile } from '../src/shared/portability';

test('detail names normalize identity without replacing saved spelling or values', () => {
  expect(readFieldNames('Roaster\n\nOrigin\n').success).toBe(true);
  for (const names of [
    ['Origin', ' origin '],
    ['Roaster name', 'Ｒｏａｓｔｅｒ  name'],
  ])
    expect(collectionFields.safeParse(names).success).toBe(false);
  expect(collectionFields.safeParse(Array.from({ length: 13 }, (_, i) => `Field ${i}`)).success).toBe(false);
  const existing = [{ name: 'Ｒｏａｓｔｅｒ', value: 'Keep this value' }];
  expect(missingFieldNames(['Roaster', 'Origin'], existing)).toEqual(['Origin']);
  expect(existing[0].value).toBe('Keep this value');
});

test('templates cannot carry records and old backups default to no templates', () => {
  const template = { id: crypto.randomUUID(), name: 'Tasting', collectionName: 'Drinks' };
  expect(collectionTemplate.parse(template)).toMatchObject({ artwork: null, detailFields: [] });
  expect(collectionTemplate.safeParse({ ...template, records: [] }).success).toBe(false);
  expect(
    archiveFile.parse({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      photosExcluded: true,
      lists: [],
      items: [],
      logs: [],
    }).collectionTemplates,
  ).toEqual([]);
});
