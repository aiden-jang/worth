import { expect, test } from 'vitest';
import { archiveFile } from '../src/shared/portability';
import { itemInput } from '../src/shared/validation';

test('backup readers retain old files and reject unsupported future formats', () => {
  const base = {
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    workoutSessions: [],
    workoutRoutines: [],
    photos: [],
  };
  expect(archiveFile.parse({ ...base, schemaVersion: 1 }).inbox).toEqual([]);
  const entry = {
    ...itemInput.parse({ title: 'A saved find', context: { recommendedBy: 'Sam' } }),
    id: '11111111-1111-4111-8111-111111111111',
    revision: 2,
    createdAt: 1,
    updatedAt: 2,
  };
  expect(archiveFile.parse({ ...base, schemaVersion: 2, inbox: [entry] }).inbox).toEqual([entry]);
  expect(archiveFile.safeParse({ ...base, schemaVersion: 11, inbox: [entry] }).success).toBe(false);
});
