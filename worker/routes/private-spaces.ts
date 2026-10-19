import { recordIdentityGuard } from '../record-identity';
import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { z } from 'zod';
import { ApiError } from '../data';
import { readJson } from '../http';
import { operationId, fingerprint } from '../operations';
import { prepareRecordSource } from '../source-snapshots';
import {
  spaceInput,
  spaceNoteInput,
  spaceInviteInput,
  spaceSnapshotInput,
  pairInput,
  pairChoice,
  sharedArchive,
  type SpaceView,
  type SharedArchive,
  type PairView,
} from '../../src/shared/private-spaces';
type SpaceRow = {
  id: string;
  owner_id: string;
  name: string;
  note: string;
  revision: number;
  removed_at: number | null;
  role: 'owner' | 'editor' | 'viewer';
};
const accessSQL = `SELECT s.*,CASE WHEN s.owner_id=? THEN 'owner' ELSE (SELECT m.role FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL LIMIT 1) END AS role FROM private_spaces s WHERE s.id=? AND s.removed_at IS NULL AND(s.owner_id=? OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL))`;
async function access(db: D1Database, user: string, id: string, edit = false) {
  const row = await db.prepare(accessSQL).bind(user, user, id, user, user).first<SpaceRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Shared space unavailable.');
  if (edit && row.role === 'viewer')
    throw new ApiError(403, 'READ_ONLY', 'This invitation gives viewing access.');
  return row;
}
function guard(db: D1Database, user: string, id: string, revision: number, edit = false, owner = false) {
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM private_spaces s WHERE s.id=? AND s.removed_at IS NULL AND s.revision=? AND(s.owner_id=? ${owner ? '' : `OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL ${edit ? "AND m.role='editor'" : ''})`})) THEN 'null' ELSE 'space changed' END)`,
    )
    .bind(id, revision, user, ...(owner ? [] : [user]));
}
async function write(db: D1Database, statements: D1PreparedStatement[]) {
  try {
    await db.batch(statements);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('malformed JSON'))
      throw new ApiError(
        409,
        'SPACE_CHANGED',
        'This space changed or your access ended. Reload saved details before trying again; your draft is kept.',
      );
    if (msg.includes('capacity reached'))
      throw new ApiError(
        409,
        'SPACE_LIMIT',
        'This space or private archive has reached its limit. Remove an entry before adding another.',
      );
    throw e;
  }
}
function bump(db: D1Database, id: string) {
  return db.prepare('UPDATE private_spaces SET revision=revision+1 WHERE id=?').bind(id);
}
async function view(db: D1Database, user: string, id: string): Promise<SpaceView> {
  const results = await db.batch<Record<string, unknown>>([
    db.prepare(accessSQL).bind(user, user, id, user, user),
    db.prepare('SELECT * FROM space_entries WHERE space_id=? ORDER BY created_at,id').bind(id),
    db
      .prepare(
        'SELECT id,email,role,account_id,expires_at,revoked_at FROM space_members WHERE space_id=? ORDER BY id',
      )
      .bind(id),
  ]);
  const space = results[0].results[0] as SpaceRow | undefined;
  if (!space) throw new ApiError(404, 'NOT_FOUND', 'Shared space unavailable.');
  return {
    id,
    name: space.name,
    note: space.note,
    role: space.role,
    revision: space.revision,
    entries: results[1].results.map((r) => ({
      id: String(r.id),
      authorId: String(r.author_id),
      authorName: String(r.author_name),
      listName: String(r.list_name),
      data: JSON.parse(String(r.data_json)),
    })),
    members: results[2].results
      .filter((r) => space.role === 'owner' || r.account_id === user)
      .map((r) => ({
        id: String(r.id),
        email: String(r.email),
        role: r.role as 'viewer' | 'editor',
        accountId: r.account_id as string | null,
        expiresAt: Number(r.expires_at),
        revoked: r.revoked_at !== null,
      })),
  };
}
type RoundRow = {
  id: string;
  space_id: string;
  title: string;
  options_json: string;
  first_id: string;
  second_id: string;
  first_name: string;
  second_name: string;
};
async function roundView(db: D1Database, user: string, id: string): Promise<PairView> {
  const results = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT r.* FROM pair_rounds r JOIN private_spaces s ON s.id=r.space_id WHERE r.id=? AND(s.owner_id=? OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL)) AND s.removed_at IS NULL AND(r.first_id=? OR r.second_id=?) AND EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.id=r.second_member_id AND m.account_id=r.second_id AND m.revoked_at IS NULL)`,
      )
      .bind(id, user, user, user, user),
    db.prepare('SELECT owner_id,choice,revision,revealed_at FROM pair_choices WHERE round_id=?').bind(id),
  ]);
  const row = results[0].results[0] as RoundRow | undefined;
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'This two-person round is unavailable.');
  const choices = results[1].results,
    mine = choices.find((r) => r.owner_id === user),
    partner = choices.find((r) => r.owner_id !== user),
    both = choices.length === 2 && choices.every((r) => r.revealed_at !== null);
  return {
    id,
    title: row.title,
    options: JSON.parse(row.options_json),
    ownChoice: mine ? Number(mine.choice) : null,
    ownRevision: mine ? Number(mine.revision) : 0,
    ownRevealed: !!mine && mine.revealed_at !== null,
    partnerRevealed: !!partner && partner.revealed_at !== null,
    result: both
      ? [
          { name: row.first_name, choice: Number(choices.find((r) => r.owner_id === row.first_id)!.choice) },
          {
            name: row.second_name,
            choice: Number(choices.find((r) => r.owner_id === row.second_id)!.choice),
          },
        ]
      : null,
  };
}
function roundGuard(db: D1Database, user: string, id: string) {
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM pair_rounds r JOIN private_spaces s ON s.id=r.space_id WHERE r.id=? AND s.removed_at IS NULL AND(r.first_id=? OR r.second_id=?) AND(s.owner_id=? OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL)) AND EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.id=r.second_member_id AND m.account_id=r.second_id AND m.revoked_at IS NULL)) THEN 'null' ELSE 'space changed' END)`,
    )
    .bind(id, user, user, user, user);
}
async function privateArchive(
  db: D1Database,
  user: string,
  id: string,
  archiveId: string = crypto.randomUUID(),
): Promise<SharedArchive> {
  const space = await view(db, user, id);
  const rounds = await db
    .prepare(
      'SELECT id FROM pair_rounds WHERE space_id=? AND(first_id=? OR second_id=?) ORDER BY created_at,id',
    )
    .bind(id, user, user)
    .all<{ id: string }>();
  const outcomes: SharedArchive['outcomes'] = [];
  for (const round of rounds.results) {
    try {
      const pair = await roundView(db, user, round.id);
      if (pair.result) outcomes.push({ title: pair.title, options: pair.options, result: pair.result });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  // Recheck the complete projection after reading outcomes. Revision changes never silently export newer text.
  const current = await access(db, user, id);
  if (current.revision !== space.revision)
    throw new ApiError(
      409,
      'SPACE_CHANGED',
      'This space changed while preparing its private copy. Try again.',
    );
  return sharedArchive.parse({
    id: archiveId,
    name: space.name,
    note: space.note,
    entries: space.entries.map(({ authorName, listName, data }) => ({
      id: crypto.randomUUID(),
      authorName,
      listName,
      data,
    })),
    outcomes,
    savedAt: Date.now(),
  });
}
export function registerPrivateSpaceRoutes(api: Hono<AppEnv>) {
  api.get('/spaces', async (c) => {
    const user = c.get('ownerId'),
      rows = await c.env.DB.prepare(
        `SELECT s.id,s.name,s.revision,CASE WHEN s.owner_id=? THEN 'owner' ELSE (SELECT role FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL LIMIT 1) END AS role FROM private_spaces s WHERE s.removed_at IS NULL AND(s.owner_id=? OR EXISTS(SELECT 1 FROM space_members m WHERE m.space_id=s.id AND m.account_id=? AND m.revoked_at IS NULL)) ORDER BY s.created_at DESC LIMIT 101`,
      )
        .bind(user, user, user, user)
        .all();
    if (rows.results.length > 100)
      throw new ApiError(409, 'SPACE_LIMIT', 'Open fewer than 100 shared spaces.');
    return c.json({ spaces: rows.results });
  });
  api.post('/spaces', async (c) => {
    const input = await readJson(c.req.raw, spaceInput),
      user = c.get('ownerId'),
      id = operationId(c.req.header('Idempotency-Key')),
      hash = await fingerprint(input);
    if (!c.get('user').emailVerified)
      throw new ApiError(403, 'VERIFY_EMAIL', 'Verify your Accounts email before creating shared spaces.');
    const old = await c.env.DB.prepare(
      'SELECT owner_id,creation_hash,removed_at FROM private_spaces WHERE id=?',
    )
      .bind(id)
      .first();
    if (old) {
      if (old.owner_id !== user || old.creation_hash !== hash)
        throw new ApiError(409, 'OPERATION_CHANGED', 'This save key belongs to another request.');
      if (old.removed_at !== null)
        throw new ApiError(410, 'SPACE_REMOVED', 'This space was removed. Start a new space.');
      return c.json(await view(c.env.DB, user, id), 201);
    }
    await write(c.env.DB, [
      recordIdentityGuard(c.env.DB, [id]),
      c.env.DB.prepare(
        'INSERT INTO private_spaces(id,owner_id,name,creation_hash,created_at) VALUES(?,?,?,?,?)',
      ).bind(id, user, input.name, hash, Date.now()),
    ]);
    return c.json(await view(c.env.DB, user, id), 201);
  });
  api.get('/spaces/archives', async (c) => {
    const rows = await c.env.DB.prepare(
      'SELECT body_json FROM shared_archives WHERE owner_id=? ORDER BY id LIMIT 51',
    )
      .bind(c.get('ownerId'))
      .all<{ body_json: string }>();
    return c.json({ archives: rows.results.map((r) => sharedArchive.parse(JSON.parse(r.body_json))) });
  });
  api.delete('/spaces/archives/:archiveId', async (c) => {
    await c.env.DB.prepare('DELETE FROM shared_archives WHERE id=? AND owner_id=?')
      .bind(c.req.param('archiveId'), c.get('ownerId'))
      .run();
    return c.body(null, 204);
  });
  api.get('/spaces/:id', async (c) => c.json(await view(c.env.DB, c.get('ownerId'), c.req.param('id'))));
  api.put('/spaces/:id/note', async (c) => {
    const input = await readJson(c.req.raw, spaceNoteInput),
      user = c.get('ownerId'),
      id = c.req.param('id');
    await access(c.env.DB, user, id, true);
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, true),
      c.env.DB.prepare('UPDATE private_spaces SET note=?,revision=revision+1 WHERE id=?').bind(
        input.note,
        id,
      ),
    ]);
    return c.json(await view(c.env.DB, user, id));
  });
  api.post('/spaces/:id/invites', async (c) => {
    const input = await readJson(c.req.raw, spaceInviteInput),
      user = c.get('ownerId'),
      id = c.req.param('id'),
      space = await access(c.env.DB, user, id),
      inviteId = operationId(c.req.header('Idempotency-Key'));
    if (space.role !== 'owner') throw new ApiError(403, 'OWNER_ONLY', 'Only the owner manages invitations.');
    if (input.email === c.get('user').email.trim().toLowerCase())
      throw new ApiError(400, 'OWN_EMAIL', 'Choose another person’s verified account email.');
    const token = crypto.randomUUID() + crypto.randomUUID(),
      hash = await fingerprint(token);
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, false, true),
      c.env.DB.prepare(
        `SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM space_members WHERE space_id=? AND email=? AND revoked_at IS NULL) THEN 'null' ELSE 'space changed' END)`,
      ).bind(id, input.email),
      c.env.DB.prepare(
        'INSERT INTO space_members(id,space_id,email,role,token_hash,expires_at) VALUES(?,?,?,?,?,?)',
      ).bind(inviteId, id, input.email, input.role, hash, Date.now() + 7 * 86400000),
      bump(c.env.DB, id),
    ]);
    return c.json(
      { inviteId, link: `/spaces/invite/${inviteId}#${token}`, space: await view(c.env.DB, user, id) },
      201,
    );
  });
  api.post('/spaces/invites/:inviteId/accept', async (c) => {
    const input = await readJson(c.req.raw, z.object({ token: z.string().min(72).max(72) }).strict()),
      user = c.get('user'),
      id = c.req.param('inviteId'),
      hash = await fingerprint(input.token);
    if (!user.emailVerified)
      throw new ApiError(403, 'VERIFY_EMAIL', 'Verify the invited email in Accounts before accepting.');
    const invite = await c.env.DB.prepare('SELECT * FROM space_members WHERE id=?').bind(id).first<{
      space_id: string;
      email: string;
      account_id: string | null;
      token_hash: string;
      expires_at: number;
      revoked_at: number | null;
    }>();
    if (
      !invite ||
      invite.token_hash !== hash ||
      invite.revoked_at !== null ||
      (!invite.account_id && invite.expires_at < Date.now()) ||
      (invite.account_id ? invite.account_id !== user.id : invite.email !== user.email.trim().toLowerCase())
    )
      throw new ApiError(
        404,
        'INVITE_UNAVAILABLE',
        'This invitation is unavailable or belongs to a different verified email.',
      );
    const space = await c.env.DB.prepare('SELECT * FROM private_spaces WHERE id=? AND removed_at IS NULL')
      .bind(invite.space_id)
      .first<SpaceRow>();
    if (!space) throw new ApiError(404, 'NOT_FOUND', 'Shared space unavailable.');
    await write(c.env.DB, [
      c.env.DB.prepare(
        `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM private_spaces s JOIN space_members m ON m.space_id=s.id WHERE m.id=? AND s.removed_at IS NULL AND m.revoked_at IS NULL AND m.token_hash=? AND(m.account_id=? OR(m.account_id IS NULL AND m.email=? AND m.expires_at>=?))) THEN 'null' ELSE 'space changed' END)`,
      ).bind(id, hash, user.id, user.email.trim().toLowerCase(), Date.now()),
      c.env.DB.prepare(
        `SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM space_members WHERE space_id=? AND account_id=? AND revoked_at IS NULL AND id<>?) THEN 'null' ELSE 'space changed' END)`,
      ).bind(space.id, user.id, id),
      c.env.DB.prepare('UPDATE space_members SET account_id=?,account_name=? WHERE id=?').bind(
        user.id,
        user.displayName.slice(0, 160),
        id,
      ),
      bump(c.env.DB, space.id),
    ]);
    return c.json(await view(c.env.DB, user.id, space.id));
  });
  api.delete('/spaces/:id/members/:memberId', async (c) => {
    const input = await readJson(
        c.req.raw,
        z.object({ expectedRevision: z.number().int().nonnegative() }).strict(),
      ),
      user = c.get('ownerId'),
      id = c.req.param('id'),
      space = await access(c.env.DB, user, id);
    if (space.role !== 'owner') throw new ApiError(403, 'OWNER_ONLY', 'Only the owner revokes invitations.');
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, false, true),
      c.env.DB.prepare('UPDATE space_members SET revoked_at=? WHERE id=? AND space_id=?').bind(
        Date.now(),
        c.req.param('memberId'),
        id,
      ),
      bump(c.env.DB, id),
    ]);
    return c.json(await view(c.env.DB, user, id));
  });
  api.post('/spaces/:id/entries', async (c) => {
    const input = await readJson(c.req.raw, spaceSnapshotInput),
      user = c.get('ownerId'),
      id = c.req.param('id'),
      entryId = operationId(c.req.header('Idempotency-Key'));
    await access(c.env.DB, user, id, true);
    const requestHash = await fingerprint(input);
    const old = await c.env.DB.prepare('SELECT * FROM space_entry_receipts WHERE id=?').bind(entryId).first();
    if (old) {
      if (old.space_id !== id || old.author_id !== user || old.fingerprint !== requestHash)
        throw new ApiError(409, 'OPERATION_CHANGED', 'This save key belongs to another shared snapshot.');
      const present = await c.env.DB.prepare('SELECT id FROM space_entries WHERE id=? AND space_id=?')
        .bind(entryId, id)
        .first();
      if (!present)
        throw new ApiError(
          410,
          'ENTRY_REMOVED',
          'This shared snapshot was removed. Review a new snapshot before another save.',
        );
      return c.json(await view(c.env.DB, user, id), 201);
    }
    const source = await prepareRecordSource(c.env.DB, user, input.selection);
    if (source.preview.hash !== input.hash)
      throw new ApiError(
        409,
        'SOURCE_CHANGED',
        'The private source changed. Review it again before sharing.',
      );
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, true),
      ...source.guards,
      recordIdentityGuard(c.env.DB, [entryId]),
      c.env.DB.prepare(
        'INSERT INTO space_entry_receipts(id,space_id,author_id,fingerprint) VALUES(?,?,?,?)',
      ).bind(entryId, id, user, requestHash),
      c.env.DB.prepare(
        'INSERT INTO space_entries(id,space_id,author_id,author_name,list_name,data_json,created_at) VALUES(?,?,?,?,?,?,?)',
      ).bind(
        entryId,
        id,
        user,
        c.get('user').displayName.slice(0, 160),
        source.preview.listName,
        JSON.stringify(source.preview.data),
        Date.now(),
      ),
      bump(c.env.DB, id),
    ]);
    return c.json(await view(c.env.DB, user, id), 201);
  });
  api.delete('/spaces/:id/entries/:entryId', async (c) => {
    const input = await readJson(
        c.req.raw,
        z.object({ expectedRevision: z.number().int().nonnegative() }).strict(),
      ),
      user = c.get('ownerId'),
      id = c.req.param('id'),
      space = await access(c.env.DB, user, id, true);
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, true),
      c.env.DB.prepare(
        `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM space_entries WHERE id=? AND space_id=? AND(author_id=? OR ?='owner')) THEN 'null' ELSE 'space changed' END)`,
      ).bind(c.req.param('entryId'), id, user, space.role),
      c.env.DB.prepare('DELETE FROM space_entries WHERE id=? AND space_id=?').bind(
        c.req.param('entryId'),
        id,
      ),
      bump(c.env.DB, id),
    ]);
    return c.json(await view(c.env.DB, user, id));
  });
  api.delete('/spaces/:id', async (c) => {
    const input = await readJson(
        c.req.raw,
        z.object({ expectedRevision: z.number().int().nonnegative() }).strict(),
      ),
      user = c.get('ownerId'),
      id = c.req.param('id'),
      space = await access(c.env.DB, user, id);
    if (space.role !== 'owner') throw new ApiError(403, 'OWNER_ONLY', 'Only the owner removes this space.');
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, false, true),
      c.env.DB.prepare(
        "UPDATE private_spaces SET removed_at=?,name='',note='',revision=revision+1 WHERE id=?",
      ).bind(Date.now(), id),
      c.env.DB.prepare('DELETE FROM space_entries WHERE space_id=?').bind(id),
      c.env.DB.prepare('DELETE FROM pair_rounds WHERE space_id=?').bind(id),
      c.env.DB.prepare('UPDATE space_members SET revoked_at=? WHERE space_id=?').bind(Date.now(), id),
    ]);
    return c.body(null, 204);
  });
  api.post('/spaces/:id/archive', async (c) => {
    const user = c.get('ownerId'),
      id = c.req.param('id'),
      key = operationId(c.req.header('Idempotency-Key'));
    const known = await c.env.DB.prepare(
      'SELECT owner_id,source_space_id,body_json FROM shared_archives WHERE id=?',
    )
      .bind(key)
      .first<{ owner_id: string; source_space_id: string | null; body_json: string }>();
    if (known) {
      if (known.owner_id !== user || known.source_space_id !== id)
        throw new ApiError(409, 'OPERATION_CHANGED', 'This save key is already used.');
      return c.json({ archive: sharedArchive.parse(JSON.parse(known.body_json)) }, 201);
    }
    const copy = await privateArchive(c.env.DB, user, id, key),
      space = await access(c.env.DB, user, id);
    await write(c.env.DB, [
      guard(c.env.DB, user, id, space.revision),
      recordIdentityGuard(c.env.DB, [key]),
      c.env.DB.prepare(
        'INSERT INTO shared_archives(id,owner_id,source_space_id,body_json) VALUES(?,?,?,?)',
      ).bind(key, user, id, JSON.stringify(copy)),
    ]);
    return c.json({ archive: copy }, 201);
  });
  api.get('/spaces/:id/pairs', async (c) => {
    const user = c.get('ownerId'),
      id = c.req.param('id');
    await access(c.env.DB, user, id);
    const rows = await c.env.DB.prepare(
      'SELECT id FROM pair_rounds WHERE space_id=? AND(first_id=? OR second_id=?) ORDER BY created_at,id',
    )
      .bind(id, user, user)
      .all<{ id: string }>();
    const pairs: PairView[] = [];
    for (const r of rows.results) {
      try {
        pairs.push(await roundView(c.env.DB, user, r.id));
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    }
    return c.json({ pairs });
  });
  api.post('/spaces/:id/pairs', async (c) => {
    const input = await readJson(c.req.raw, pairInput),
      user = c.get('ownerId'),
      id = c.req.param('id'),
      space = await access(c.env.DB, user, id, true),
      key = operationId(c.req.header('Idempotency-Key'));
    if (space.role !== 'owner') throw new ApiError(403, 'OWNER_ONLY', 'The owner starts a two-person round.');
    const pairHash = await fingerprint(input);
    const existing = await c.env.DB.prepare(
      'SELECT space_id,first_id,creation_hash FROM pair_rounds WHERE id=?',
    )
      .bind(key)
      .first();
    if (existing) {
      if (existing.space_id !== id || existing.first_id !== user || existing.creation_hash !== pairHash)
        throw new ApiError(409, 'OPERATION_CHANGED', 'This save key belongs to another round.');
      return c.json(await roundView(c.env.DB, user, key), 201);
    }
    const member = await c.env.DB.prepare(
      'SELECT id,account_id,account_name FROM space_members WHERE space_id=? AND account_id=? AND revoked_at IS NULL',
    )
      .bind(id, input.partnerId)
      .first();
    if (!member || input.partnerId === user)
      throw new ApiError(400, 'PARTNER_REQUIRED', 'Choose one accepted member.');
    await write(c.env.DB, [
      guard(c.env.DB, user, id, input.expectedRevision, false, true),
      recordIdentityGuard(c.env.DB, [key]),
      c.env.DB.prepare(
        'INSERT INTO pair_rounds(id,space_id,title,creation_hash,options_json,first_id,second_id,second_member_id,first_name,second_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        key,
        id,
        input.title,
        pairHash,
        JSON.stringify(input.options),
        user,
        input.partnerId,
        String(member.id),
        c.get('user').displayName.slice(0, 160),
        String(member.account_name || 'Partner'),
        Date.now(),
      ),
      bump(c.env.DB, id),
    ]);
    return c.json(await roundView(c.env.DB, user, key), 201);
  });
  api.put('/pairs/:id/choice', async (c) => {
    const input = await readJson(c.req.raw, pairChoice),
      user = c.get('ownerId'),
      id = c.req.param('id');
    await roundView(c.env.DB, user, id);
    await write(c.env.DB, [
      roundGuard(c.env.DB, user, id),
      c.env.DB.prepare(
        `SELECT json(CASE WHEN (NOT EXISTS(SELECT 1 FROM pair_choices WHERE round_id=? AND owner_id=?) AND ?=0) OR EXISTS(SELECT 1 FROM pair_choices WHERE round_id=? AND owner_id=? AND((revealed_at IS NULL AND revision=?) OR(choice=? AND revision=?))) THEN 'null' ELSE 'space changed' END)`,
      ).bind(
        id,
        user,
        input.expectedRevision,
        id,
        user,
        input.expectedRevision,
        input.choice,
        input.expectedRevision + 1,
      ),
      c.env.DB.prepare(
        'INSERT INTO pair_choices(round_id,owner_id,choice,revision) VALUES(?,?,?,1) ON CONFLICT(round_id,owner_id) DO UPDATE SET choice=excluded.choice,revision=revision+1 WHERE pair_choices.revealed_at IS NULL AND pair_choices.revision=?',
      ).bind(id, user, input.choice, input.expectedRevision),
    ]);
    return c.json(await roundView(c.env.DB, user, id));
  });
  api.post('/pairs/:id/reveal', async (c) => {
    const input = await readJson(c.req.raw, pairChoice),
      user = c.get('ownerId'),
      id = c.req.param('id');
    await roundView(c.env.DB, user, id);
    await write(c.env.DB, [
      roundGuard(c.env.DB, user, id),
      c.env.DB.prepare(
        `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM pair_choices WHERE round_id=? AND owner_id=? AND choice=? AND revision=?) THEN 'null' ELSE 'space changed' END)`,
      ).bind(id, user, input.choice, input.expectedRevision),
      c.env.DB.prepare(
        'UPDATE pair_choices SET revealed_at=COALESCE(revealed_at,?) WHERE round_id=? AND owner_id=?',
      ).bind(Date.now(), id, user),
    ]);
    return c.json(await roundView(c.env.DB, user, id));
  });
}
