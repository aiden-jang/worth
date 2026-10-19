import { sharedArchive, type SharedArchive } from '../src/shared/private-spaces';
import { ApiError } from './data';
// Live access is exported as a disconnected private copy; invitations and unrevealed choices never travel.
export async function exportSharedArchives(db: D1Database, user: string): Promise<SharedArchive[]> {
  const owned = await db
    .prepare('SELECT body_json FROM shared_archives WHERE owner_id=? ORDER BY id LIMIT 51')
    .bind(user)
    .all<{ body_json: string }>();
  const result = owned.results.map((r) => sharedArchive.parse(JSON.parse(r.body_json)));
  const spaces = await db
    .prepare(
      `SELECT s.id FROM private_spaces s WHERE s.removed_at IS NULL AND(s.owner_id=? OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL)) ORDER BY s.id LIMIT 51`,
    )
    .bind(user, user)
    .all<{ id: string }>();
  if (result.length + spaces.results.length > 50)
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'Shared spaces and private copies exceed the 50-copy restore limit. No shared content was omitted.',
    );
  for (const { id } of spaces.results) {
    const batches = await db.batch<Record<string, unknown>>([
      db
        .prepare(
          `SELECT s.* FROM private_spaces s WHERE s.id=? AND s.removed_at IS NULL AND(s.owner_id=? OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL))`,
        )
        .bind(id, user, user),
      db.prepare('SELECT * FROM space_entries WHERE space_id=? ORDER BY created_at,id').bind(id),
      db
        .prepare(
          `SELECT r.title,r.options_json,r.first_name,r.second_name,a.choice AS first_choice,b.choice AS second_choice FROM pair_rounds r JOIN pair_choices a ON a.round_id=r.id AND a.owner_id=r.first_id JOIN pair_choices b ON b.round_id=r.id AND b.owner_id=r.second_id WHERE r.space_id=? AND(r.first_id=? OR r.second_id=?) AND a.revealed_at IS NOT NULL AND b.revealed_at IS NOT NULL AND EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=r.space_id AND m.id=r.second_member_id AND m.account_id=r.second_id AND m.revoked_at IS NULL) ORDER BY r.created_at,r.id`,
        )
        .bind(id, user, user),
    ]);
    const space = batches[0].results[0];
    if (!space)
      throw new ApiError(
        409,
        'EXPORT_CHANGED',
        'Shared access changed while preparing this copy. Try again.',
      );
    result.push(
      sharedArchive.parse({
        id: crypto.randomUUID(),
        name: space.name,
        note: space.note,
        savedAt: Date.now(),
        entries: batches[1].results.map((r) => ({
          id: crypto.randomUUID(),
          authorName: r.author_name,
          listName: r.list_name,
          data: JSON.parse(String(r.data_json)),
        })),
        outcomes: batches[2].results.map((r) => ({
          title: r.title,
          options: JSON.parse(String(r.options_json)),
          result: [
            { name: r.first_name, choice: r.first_choice },
            { name: r.second_name, choice: r.second_choice },
          ],
        })),
      }),
    );
  }
  if (new TextEncoder().encode(JSON.stringify(result)).length > 8 * 1024 * 1024)
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'Shared text exceeds the 8 MB backup limit. No shared text was omitted.',
    );
  return result;
}
