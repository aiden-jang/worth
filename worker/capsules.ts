import {
  capsuleBody,
  capsuleInput,
  capsuleLimit,
  type CapsuleInput,
  type CapsuleSummary,
  type CapsuleView,
  type CapsuleCurrent,
} from '../src/shared/capsules';
import { selectedSnapshotFields } from '../src/shared/record-snapshots';
import { ApiError } from './data';
import { fingerprint } from './operations';
import { recordIdentityGuard } from './record-identity';
import { mapCapsule, capsuleSummary, type CapsuleRow } from './capsule-data';
import { prepareRecordSource, currentRecordSource } from './source-snapshots';
async function requireCapsule(db: D1Database, owner: string, id: string): Promise<CapsuleRow> {
  const row = await db
    .prepare('SELECT * FROM time_capsules WHERE id=? AND owner_id=? AND removed_at IS NULL')
    .bind(id, owner)
    .first<CapsuleRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Capsule not found.');
  return row;
}
export async function capsuleSummaries(db: D1Database, owner: string): Promise<CapsuleSummary[]> {
  const result = await db
    .prepare(
      'SELECT * FROM time_capsules WHERE owner_id=? AND removed_at IS NULL ORDER BY opens_at,created_at,id LIMIT 26',
    )
    .bind(owner)
    .all<CapsuleRow>();
  if (result.results.length > capsuleLimit)
    throw new ApiError(409, 'CAPSULE_LIMIT', 'Keep up to 25 time capsules.');
  const now = Date.now();
  return result.results.map((row) => capsuleSummary(row, now));
}
export async function capsuleView(db: D1Database, owner: string, id: string): Promise<CapsuleView> {
  const row = await requireCapsule(db, owner, id),
    now = Date.now();
  return {
    summary: capsuleSummary(row, now),
    serverNow: now,
    capsule: row.opened_at === null ? null : mapCapsule(row),
    current: [],
  };
}
export async function capsuleComparison(
  db: D1Database,
  owner: string,
  id: string,
): Promise<CapsuleCurrent[]> {
  const row = await requireCapsule(db, owner, id);
  if (row.opened_at === null)
    throw new ApiError(
      409,
      'CAPSULE_CLOSED',
      'Open this capsule on or after its chosen date before comparing it.',
    );
  const capsule = mapCapsule(row);
  return Promise.all(
    capsule.entries.map(async (entry) => {
      if (!entry.reference) return { entryId: entry.id, available: false, photos: [] };
      try {
        const current = await currentRecordSource(db, owner, {
          ...entry.reference,
          fields: selectedSnapshotFields(entry.data),
          photoIds: entry.photos.flatMap((photo) => (photo.sourceAssetId ? [photo.sourceAssetId] : [])),
        });
        return { entryId: entry.id, available: true, ...current };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404)
          return { entryId: entry.id, available: false, photos: [] };
        throw error;
      }
    }),
  );
}
export function capsuleFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('capsule capacity reached'))
    throw new ApiError(409, 'CAPSULE_LIMIT', 'Keep up to 25 capsules. Remove one before saving another.');
  if (message.includes('malformed JSON'))
    throw new ApiError(
      409,
      'SOURCE_CHANGED',
      'A source changed after its review. Your message and reviews are kept. Review the current source before trying again.',
    );
  throw error;
}
export async function checkCapsuleSave(
  db: D1Database,
  owner: string,
  id: string,
  input: CapsuleInput,
): Promise<CapsuleView> {
  const row = await db
    .prepare('SELECT creation_hash,removed_at FROM time_capsules WHERE id=? AND owner_id=?')
    .bind(id, owner)
    .first<{ creation_hash: string; removed_at: number | null }>();
  if (!row)
    throw new ApiError(
      404,
      'NOT_FOUND',
      'This save is not confirmed yet. Keep its fixed draft and retry exactly when ready.',
    );
  if (row.removed_at !== null)
    throw new ApiError(410, 'CAPSULE_REMOVED', 'This capsule was removed. An old retry cannot recreate it.');
  if (row.creation_hash !== (await fingerprint(capsuleInput.parse(input))))
    throw new ApiError(
      409,
      'OPERATION_CHANGED',
      'The saved capsule differs from this draft. Your draft is kept; open the saved capsule separately before deciding what to keep.',
    );
  return capsuleView(db, owner, id);
}
export async function createCapsule(
  db: D1Database,
  owner: string,
  id: string,
  raw: CapsuleInput,
): Promise<CapsuleView> {
  const input = capsuleInput.parse(raw),
    hash = await fingerprint(input);
  async function previous(): Promise<CapsuleView | null> {
    const row = await db.prepare('SELECT * FROM time_capsules WHERE id=?').bind(id).first<CapsuleRow>();
    if (!row) return null;
    if (row.owner_id !== owner || row.creation_hash !== hash)
      throw new ApiError(
        409,
        'OPERATION_CHANGED',
        'This retry differs from its saved capsule. Check the saved result before starting another.',
      );
    if (row.removed_at !== null)
      throw new ApiError(
        410,
        'CAPSULE_REMOVED',
        'This capsule was removed. An old retry cannot recreate it.',
      );
    return capsuleView(db, owner, id);
  }
  const known = await previous();
  if (known) return known;
  const prepared = await Promise.all(
    input.sources.map(async (source) => {
      const result = await prepareRecordSource(db, owner, source.selection);
      if (result.preview.hash !== source.hash)
        throw new ApiError(
          409,
          'SOURCE_CHANGED',
          'A source changed after its review. Your message and reviews are kept; review the current source again.',
        );
      return { source, ...result };
    }),
  );
  const now = Date.now();
  const body = capsuleBody.parse({
    name: input.name,
    message: input.message,
    opening: input.opening,
    entries: prepared.map(({ source, preview }) => ({
      id: source.id,
      kind: preview.selection.kind,
      reference: { kind: preview.selection.kind, id: preview.selection.id },
      referenceMissing: false,
      listName: preview.listName,
      data: preview.data,
      photos: preview.photos.map((photo) => ({
        ...photo,
        id: crypto.randomUUID(),
        sourceAssetId: photo.id,
        sourceMissing: false,
        arrows: photo.arrows.map((arrow) => ({ ...arrow, id: crypto.randomUUID() })),
      })),
    })),
  });
  const photos = body.entries.flatMap((entry) => entry.photos);
  try {
    await db.batch([
      recordIdentityGuard(db, [id, ...photos.map((photo) => photo.id)]),
      ...prepared.flatMap((source) => source.guards),
      db
        .prepare(
          'INSERT INTO time_capsules(id,owner_id,body_json,creation_hash,created_at,opens_at) VALUES(?,?,?,?,?,?)',
        )
        .bind(id, owner, JSON.stringify(body), hash, now, input.opening.opensAt),
      ...body.entries.flatMap((entry, index) =>
        entry.photos.map((photo) => {
          const source = prepared[index],
            file = source.photos.find((file) => file.id === photo.sourceAssetId)!;
          return db
            .prepare(
              'INSERT INTO capsule_photos(id,capsule_id,owner_id,content_type,fingerprint,data) SELECT ?,?,?,?,?,data FROM photo_assets WHERE id=? AND owner_id=? AND removed_at IS NULL AND data=?',
            )
            .bind(photo.id, id, owner, file.contentType, file.digest, file.id, owner, file.bytes);
        }),
      ),
    ]);
  } catch (error) {
    const saved = await previous();
    if (saved) return saved;
    capsuleFailure(error);
  }
  return capsuleView(db, owner, id);
}
export async function openCapsule(db: D1Database, owner: string, id: string): Promise<CapsuleView> {
  const row = await requireCapsule(db, owner, id),
    now = Date.now();
  if (row.opened_at === null && row.opens_at > now)
    throw new ApiError(
      409,
      'CAPSULE_NOT_READY',
      'This capsule opens on its chosen date. It is still closed.',
    );
  await db
    .prepare(
      'UPDATE time_capsules SET opened_at=? WHERE id=? AND owner_id=? AND removed_at IS NULL AND opened_at IS NULL AND opens_at<=?',
    )
    .bind(now, id, owner, now)
    .run();
  return capsuleView(db, owner, id);
}
export async function removeCapsule(db: D1Database, owner: string, id: string) {
  const row = await db
    .prepare('SELECT id FROM time_capsules WHERE id=? AND owner_id=?')
    .bind(id, owner)
    .first();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Capsule not found.');
  await db.batch([
    db.prepare('DELETE FROM capsule_photos WHERE capsule_id=? AND owner_id=?').bind(id, owner),
    db
      .prepare(
        "UPDATE time_capsules SET body_json='{}',removed_at=? WHERE id=? AND owner_id=? AND removed_at IS NULL",
      )
      .bind(Date.now(), id, owner),
  ]);
}
