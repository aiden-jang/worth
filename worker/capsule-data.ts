import { capsuleBody, savedCapsule, type SavedCapsule, type CapsuleSummary } from '../src/shared/capsules';
export type CapsuleRow = {
  id: string;
  owner_id: string;
  body_json: string;
  creation_hash: string;
  created_at: number;
  opens_at: number;
  opened_at: number | null;
  removed_at: number | null;
};
export function mapCapsule(row: CapsuleRow): SavedCapsule {
  return savedCapsule.parse({
    ...JSON.parse(row.body_json),
    id: row.id,
    createdAt: row.created_at,
    openedAt: row.opened_at,
  });
}
export function capsuleSummary(row: CapsuleRow, now: number): CapsuleSummary {
  const body = JSON.parse(row.body_json) as SavedCapsule;
  return {
    id: row.id,
    name: body.name,
    opening: body.opening,
    createdAt: row.created_at,
    openedAt: row.opened_at,
    entryCount: body.entries.length,
    ready: now >= row.opens_at,
  };
}
export function capsuleRecordBody(capsule: SavedCapsule) {
  return capsuleBody.parse({
    name: capsule.name,
    message: capsule.message,
    opening: capsule.opening,
    entries: capsule.entries,
  });
}
