import { expect, test } from 'vitest';
import {
  capsuleInput,
  savedCapsule,
  normalizeCapsuleReferences,
  capsulePayload,
  emptyCapsule,
  dayInZone,
} from '../src/shared/capsules';
import { sourcePreview, sourceReviewHash, sourceSelection } from '../src/shared/record-snapshots';
import { archiveFile } from '../src/shared/portability';
const recordId = '11111111-1111-4111-8111-111111111111',
  entryId = '22222222-2222-4222-8222-222222222222',
  photoId = '33333333-3333-4333-8333-333333333333',
  assetId = '44444444-4444-4444-8444-444444444444';
const opening = { day: '2026-11-01', zone: 'America/New_York', opensAt: Date.parse('2026-11-01T04:00:00Z') };
function snapshot() {
  return savedCapsule.parse({
    id: crypto.randomUUID(),
    name: 'For later',
    message: 'My private message',
    opening,
    createdAt: 1000,
    openedAt: null,
    entries: [
      {
        id: entryId,
        kind: 'item',
        reference: { kind: 'item', id: recordId },
        referenceMissing: false,
        listName: 'Kept things',
        data: { title: 'Coffee', rank: 1, decision: null, note: 'A frozen note' },
        photos: [
          {
            id: photoId,
            sourceAssetId: assetId,
            sourceMissing: false,
            contentType: 'image/png',
            digest: '0'.repeat(64),
            caption: 'A copied photo',
            arrows: [],
            available: true,
          },
        ],
      },
    ],
  });
}
test('capsule dates retain the chosen timezone across clock changes and DST', () => {
  expect(dayInZone(opening.opensAt, 'America/New_York')).toBe(opening.day);
  expect(dayInZone(Date.parse('2026-11-02T05:00:00Z'), 'America/New_York')).toBe('2026-11-02');
  expect(capsuleInput.safeParse({ name: 'A letter', message: '', opening, sources: [] }).success).toBe(true);
  expect(
    capsuleInput.safeParse({
      name: 'A letter',
      message: '',
      opening: { ...opening, opensAt: Date.parse('2026-11-01T00:00:00Z') },
      sources: [],
    }).success,
  ).toBe(false);
  expect(
    capsuleInput.safeParse({
      name: 'A letter',
      message: '',
      opening: { ...opening, zone: 'Not/a-zone' },
      sources: [],
    }).success,
  ).toBe(false);
  const draft = { ...emptyCapsule(), name: 'A letter', day: '2026-11-02', opening };
  expect(() => capsulePayload(draft)).toThrow('Choose and review the opening date again');
});
test('capsule preview hashes bind exact selected fields and photos, without binding a transient read time', async () => {
  const first = sourcePreview.parse({
    selection: { kind: 'item', id: recordId, fields: ['decision', 'rank'], photoIds: [] },
    listName: 'Kept things',
    data: { title: 'Coffee', decision: null, rank: 1 },
    photos: [],
    hash: '0'.repeat(64),
    previewedAt: 1,
  });
  const hash = await sourceReviewHash(first),
    later = { ...first, previewedAt: 999, hash };
  expect(await sourceReviewHash(later)).toBe(hash);
  expect(await sourceReviewHash({ ...first, data: { ...first.data, decision: 'meh' } })).not.toBe(hash);
  expect(
    sourcePreview.safeParse({ ...first, data: { ...first.data, note: 'Unselected private text' } }).success,
  ).toBe(false);
  expect(sourceSelection.safeParse({ ...first.selection, kind: 'log' }).success).toBe(false);
  expect(first.data.decision).toBeNull();
  expect(first.data.rank).toBe(1);
});
test('capsules retain frozen data while missing original records and photos are marked explicitly', () => {
  const original = snapshot(),
    copy = structuredClone(original),
    missing = normalizeCapsuleReferences(original, new Set(), new Set(), new Set());
  expect(missing.entries[0].reference).toBeNull();
  expect(missing.entries[0].referenceMissing).toBe(true);
  expect(missing.entries[0].photos[0].sourceAssetId).toBeNull();
  expect(missing.entries[0].photos[0].sourceMissing).toBe(true);
  expect(missing.entries[0].data).toEqual(original.entries[0].data);
  expect(missing.entries[0].photos[0].available).toBe(true);
  expect(missing.message).toBe(original.message);
  expect(original).toEqual(copy);
  expect(savedCapsule.parse(missing)).toEqual(missing);
  expect(savedCapsule.safeParse({ ...original, openedAt: opening.opensAt - 1 }).success).toBe(false);
  expect(savedCapsule.safeParse({ ...original, openedAt: opening.opensAt }).success).toBe(true);
});
test('capsule backup version nine preserves unopened contents but rejects mismatched photo and source identities', () => {
  const capsule = normalizeCapsuleReferences(snapshot(), new Set(), new Set(), new Set());
  const base = {
    schemaVersion: 9,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    capsules: [capsule],
  };
  const file = archiveFile.parse(base);
  expect(file.capsules[0].message).toBe('My private message');
  expect(file.capsules[0].openedAt).toBeNull();
  expect(archiveFile.safeParse({ ...base, schemaVersion: 8 }).success).toBe(false);
  expect(archiveFile.safeParse({ ...base, photosExcluded: false }).success).toBe(false);
  const unavailable = {
    ...capsule,
    entries: capsule.entries.map((entry) => ({
      ...entry,
      photos: entry.photos.map((photo) => ({ ...photo, available: false })),
    })),
  };
  expect(archiveFile.safeParse({ ...base, photosExcluded: false, capsules: [unavailable] }).success).toBe(
    true,
  );
  expect(archiveFile.safeParse({ ...base, capsules: [{ ...capsule, id: photoId }] }).success).toBe(false);
  expect(archiveFile.safeParse({ ...base, capsules: [snapshot()] }).success).toBe(false);
  expect(
    archiveFile.safeParse({
      ...base,
      capsules: Array.from({ length: 26 }, () => ({ ...capsule, id: crypto.randomUUID(), entries: [] })),
    }).success,
  ).toBe(false);
});

test('source picker display metadata never becomes part of a private selection', async () => {
  const { defaultSnapshotSelection, sourceSelection } = await import('../src/shared/record-snapshots');
  const row = {
    kind: 'item' as const,
    id: crypto.randomUUID(),
    name: 'A record',
    detail: 'A displayed type',
  };
  expect(sourceSelection.parse(defaultSnapshotSelection(row))).toEqual({
    kind: 'item',
    id: row.id,
    fields: ['type', 'decision', 'rank', 'dates'],
    photoIds: [],
  });
});
