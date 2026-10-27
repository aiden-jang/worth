import { expect, test } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { archiveFile } from '../src/shared/portability';
import { archiveSpreadsheet } from '../src/shared/archive-spreadsheet';

const listId = '11111111-1111-4111-8111-111111111111';
const activityId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const logId = '44444444-4444-4444-8444-444444444444';
function fixture() {
  return archiveFile.parse({
    schemaVersion: 10,
    exportedAt: '2026-10-27T00:00:00.000Z',
    photosExcluded: true,
    lists: [
      {
        id: listId,
        name: 'Drinks',
        description: '',
        kind: 'collection',
        rankedIds: [itemId],
        archived: true,
        updatedAt: 0,
      },
      {
        id: activityId,
        name: 'Gym',
        description: '',
        kind: 'activity',
        rankedIds: [],
        updatedAt: 0,
      },
    ],
    items: [
      {
        id: itemId,
        listId,
        title: '=HYPERLINK("https://example.com","x")',
        decision: null,
        type: '',
        context: { purchase: { price: 0, currency: 'USD' } },
        note: 'A < B & C\n_x0041_\u0001🙂',
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    logs: [
      {
        id: logId,
        listId: activityId,
        title: 'Bench press',
        note: '',
        unit: '',
        exercise: true,
        happenedOn: '2026-10-01',
        createdAt: 0,
        updatedAt: 0,
        exerciseSets: [
          { reps: 8, weight: 0 },
          { reps: 6, weight: null },
        ],
        measurements: [
          { name: 'Distance', value: 0, unit: 'km' },
          { name: 'Elevation', value: -1, unit: 'm' },
        ],
      },
    ],
    workoutRoutines: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        listId: activityId,
        title: 'Push',
        exercises: ['Bench press'],
        targets: [{ exercise: 'bench PRESS', weight: 0 }],
        createdAt: 0,
        updatedAt: 0,
      },
    ],
  });
}
function read(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  return Object.fromEntries(
    Object.entries(files).map(([path, body]) => [
      path,
      new DOMParser().parseFromString(strFromU8(body), 'application/xml'),
    ]),
  );
}
test('Excel exports keep literal private text, typed values and missing weights distinct', () => {
  const files = read(archiveSpreadsheet(fixture()));
  for (const xml of Object.values(files)) expect(xml.querySelector('parsererror')).toBeNull();
  const sheets = files['xl/workbook.xml'].querySelectorAll('sheet');
  expect(Array.from(sheets, (sheet) => sheet.getAttribute('name'))).toEqual([
    'Saved things',
    'Experiences',
    'Exercise sets',
    'Measurements',
    'Workouts',
    'Routines',
    'Collections',
    'Inbox',
    'About',
  ]);
  const saved = files['xl/worksheets/sheet1.xml'];
  expect(saved.querySelector('c[r="A2"]')?.getAttribute('t')).toBe('inlineStr');
  expect(saved.querySelector('c[r="A2"] t')?.textContent).toBe('=HYPERLINK("https://example.com","x")');
  expect(saved.querySelector('f')).toBeNull();
  expect(saved.querySelector('c[r="D2"] t')?.textContent).toBe('');
  expect(saved.querySelector('c[r="E2"] v')?.textContent).toBe('1');
  expect(saved.querySelector('c[r="J2"] t')?.textContent).toBe('A < B & C\n_x005F_x0041__x0001_🙂');
  expect(saved.querySelector('c[r="M2"]')?.getAttribute('s')).toBe('3');
  expect(saved.querySelector('c[r="R2"] t')?.textContent).toContain('"price":0');
  expect(saved.querySelector('c[r="R2"] t')?.textContent).not.toContain('"sourceUrl"');
  expect(files['xl/worksheets/sheet6.xml'].querySelector('c[r="E2"] t')?.textContent).toContain('"weight":0');
  expect(saved.querySelector('pane')?.getAttribute('topLeftCell')).toBe('B2');
  const sets = files['xl/worksheets/sheet3.xml'];
  expect(sets.querySelector('c[r="F2"] v')?.textContent).toBe('0');
  expect(sets.querySelector('c[r="F3"] v')).toBeNull();
  expect(sets.querySelector('c[r="H3"] v')?.textContent).toBe('1');
  expect(sets.querySelector('c[r="C2"]')?.getAttribute('s')).toBe('2');
  const metrics = files['xl/worksheets/sheet4.xml'];
  expect(metrics.querySelector('c[r="E2"] v')?.textContent).toBe('0');
  expect(metrics.querySelector('c[r="E3"] v')?.textContent).toBe('-1');
  expect(files['xl/worksheets/sheet7.xml'].querySelector('c[r="D2"] v')?.textContent).toBe('1');
  expect(files['xl/worksheets/sheet9.xml'].querySelector('pane')).toBeNull();
  expect(Object.keys(files).some((path) => /externalLink|vbaProject|media/.test(path))).toBe(false);
});

test('empty archives remain readable workbooks and overlong cells direct people to JSON', () => {
  const empty = archiveFile.parse({
    schemaVersion: 1,
    exportedAt: '2026-10-27T00:00:00.000Z',
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
  });
  expect(read(archiveSpreadsheet(empty))['xl/worksheets/sheet1.xml'].querySelectorAll('row')).toHaveLength(1);
  const archive = fixture();
  archive.items[0].note = 'x'.repeat(32768);
  expect(() => archiveSpreadsheet(archive)).toThrow('Export JSON to keep it in full');
});
