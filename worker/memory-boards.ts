import { recordIdentityGuard } from './record-identity';
import {
  boardInput,
  boardReferenceKey,
  type BoardInput,
  type BoardSource,
  type BoardSummary,
  type BoardView,
} from '../src/shared/memory-boards';
import { ApiError } from './data';
import { fingerprint } from './operations';
import { mapBoard, type BoardRow } from './board-data';
const refs = `SELECT json_extract(e.value,'$.reference.id') AS id,json_extract(e.value,'$.reference.kind') AS kind
 FROM memory_boards b,json_each(b.body_json,'$.entries') e WHERE b.owner_id=? AND b.id=? AND b.removed_at IS NULL`;
export async function boardSummaries(db: D1Database, owner: string): Promise<BoardSummary[]> {
  const rows = await db
    .prepare(
      `SELECT id,revision,updated_at AS updatedAt,json_extract(body_json,'$.name') AS name,
 json_extract(body_json,'$.kind') AS kind,json_extract(body_json,'$.from') AS 'from',json_extract(body_json,'$.until') AS until,
 json_extract(body_json,'$.archived') AS archived,json_array_length(body_json,'$.entries') AS entryCount
 FROM memory_boards WHERE owner_id=? AND removed_at IS NULL ORDER BY updated_at DESC,id LIMIT 101`,
    )
    .bind(owner)
    .all<Omit<BoardSummary, 'archived'> & { archived: number }>();
  if (rows.results.length > 100)
    throw new ApiError(409, 'BOARD_LIMIT', 'This archive exceeds the limit of 100 boards.');
  return rows.results.map((row) => ({ ...row, archived: !!row.archived }));
}
export async function readBoard(db: D1Database, owner: string, id: string): Promise<BoardView> {
  const [board, items, logs] = await db.batch([
    db
      .prepare('SELECT * FROM memory_boards WHERE owner_id=? AND id=? AND removed_at IS NULL')
      .bind(owner, id),
    db
      .prepare(
        `SELECT i.id,i.title,i.list_id AS listId,l.name AS listName,l.archived,
    EXISTS(SELECT 1 FROM item_photos p WHERE p.item_id=i.id AND p.owner_id=i.owner_id) AS hasPhoto,i.updated_at AS updatedAt
    FROM active_items i JOIN active_lists l ON l.id=i.list_id AND l.owner_id=i.owner_id
    WHERE i.owner_id=? AND i.id IN (SELECT id FROM (${refs}) WHERE kind='item')`,
      )
      .bind(owner, owner, id),
    db
      .prepare(
        `SELECT g.id,COALESCE(NULLIF(g.title,''),i.title,'Visit') AS title,g.list_id AS listId,l.name AS listName,l.archived,
    EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id=g.id AND p.owner_id=g.owner_id) AS hasPhoto,g.updated_at AS updatedAt
    FROM active_logs g JOIN active_lists l ON l.id=g.list_id AND l.owner_id=g.owner_id
    LEFT JOIN active_items i ON i.id=g.item_id AND i.owner_id=g.owner_id
    WHERE g.owner_id=? AND g.id IN (SELECT id FROM (${refs}) WHERE kind='log')`,
      )
      .bind(owner, owner, id),
  ]);
  const row = board.results[0] as BoardRow | undefined;
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Board not found.');
  type SourceRow = Omit<BoardSource, 'kind' | 'currentId' | 'merged' | 'archived' | 'hasPhoto'> & {
    archived: number;
    hasPhoto: number;
  };
  const sources: BoardSource[] = [];
  for (const [kind, result] of [
    ['item', items],
    ['log', logs],
  ] as const)
    for (const source of result.results as SourceRow[])
      sources.push({
        ...source,
        kind,
        currentId: source.id,
        merged: false,
        archived: !!source.archived,
        hasPhoto: !!source.hasPhoto,
      });
  return { ...mapBoard(row), sources };
}
async function ownedRow(
  db: D1Database,
  owner: string,
  id: string,
  includeRemoved = false,
): Promise<BoardRow> {
  const row = await db
    .prepare(
      `SELECT * FROM memory_boards WHERE owner_id=? AND id=? ${includeRemoved ? '' : 'AND removed_at IS NULL'}`,
    )
    .bind(owner, id)
    .first<BoardRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Board not found.');
  return row;
}
function revisionGuard(db: D1Database, owner: string, id: string, revision: number) {
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM memory_boards WHERE owner_id=? AND id=? AND revision=? AND removed_at IS NULL) THEN 'null' ELSE 'board changed' END)`,
    )
    .bind(owner, id, revision);
}
function sourceGuard(db: D1Database, owner: string, board: BoardInput, previous: BoardInput | null) {
  // An existing unavailable reference may stay only on the same saved entry. New references require a current owned source.
  const retained =
    previous?.entries
      .filter((entry) => entry.reference)
      .map((entry) => `${entry.id}:${boardReferenceKey(entry.reference!)}`) ?? [];
  return db
    .prepare(
      `SELECT json(CASE WHEN NOT EXISTS (
   SELECT 1 FROM json_each(?,'$.entries') e WHERE json_type(e.value,'$.reference')='object'
   AND (json_extract(e.value,'$.id') || ':' || json_extract(e.value,'$.reference.kind') || ':' || json_extract(e.value,'$.reference.id')) NOT IN (SELECT value FROM json_each(?))
   AND NOT (
    (json_extract(e.value,'$.reference.kind')='item' AND EXISTS(SELECT 1 FROM active_items i WHERE i.id=json_extract(e.value,'$.reference.id') AND i.owner_id=?))
    OR (json_extract(e.value,'$.reference.kind')='log' AND EXISTS(SELECT 1 FROM active_logs g WHERE g.id=json_extract(e.value,'$.reference.id') AND g.owner_id=?))
   )
 ) THEN 'null' ELSE 'board source changed' END)`,
    )
    .bind(JSON.stringify(board), JSON.stringify(retained), owner, owner);
}
function boardFailure(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('board capacity reached'))
    throw new ApiError(409, 'BOARD_LIMIT', 'Keep up to 100 boards. Remove one before adding another.');
  if (message.includes('malformed JSON'))
    throw new ApiError(
      409,
      'BOARD_CHANGED',
      'This board or a linked record changed. Load saved details to compare; your draft is kept.',
    );
  throw error;
}
export async function createBoard(
  db: D1Database,
  owner: string,
  id: string,
  input: BoardInput,
): Promise<BoardView> {
  const board = boardInput.parse(input),
    hash = await fingerprint(board);
  async function previous() {
    const row = await db.prepare('SELECT * FROM memory_boards WHERE id=?').bind(id).first<BoardRow>();
    if (!row) return null;
    if (row.owner_id !== owner || row.create_hash !== hash)
      throw new ApiError(
        409,
        'OPERATION_CHANGED',
        'This retry differs from the saved board. Keep the original draft or begin a new review.',
      );
    if (row.removed_at !== null)
      throw new ApiError(410, 'BOARD_REMOVED', 'This board was removed. An old retry cannot recreate it.');
    return readBoard(db, owner, id);
  }
  const existing = await previous();
  if (existing) return existing;
  const now = Date.now();
  try {
    await db.batch([
      recordIdentityGuard(db, [id]),
      sourceGuard(db, owner, board, null),
      db
        .prepare(
          'INSERT INTO memory_boards(id,owner_id,body_json,revision,create_hash,created_at,updated_at) VALUES(?,?,?,0,?,?,?)',
        )
        .bind(id, owner, JSON.stringify(board), hash, now, now),
    ]);
  } catch (error) {
    const retry = await previous();
    if (retry) return retry;
    boardFailure(error);
  }
  return readBoard(db, owner, id);
}
export async function updateBoard(
  db: D1Database,
  owner: string,
  id: string,
  input: BoardInput,
  revision: number,
): Promise<BoardView> {
  const row = await ownedRow(db, owner, id),
    board = boardInput.parse(input);
  if (row.revision !== revision)
    throw new ApiError(
      409,
      'BOARD_CHANGED',
      'This board changed elsewhere. Load saved details to compare; your draft is kept.',
    );
  try {
    await db.batch([
      revisionGuard(db, owner, id, row.revision),
      sourceGuard(db, owner, board, boardInput.parse(JSON.parse(row.body_json))),
      db
        .prepare(
          'UPDATE memory_boards SET body_json=?,revision=revision+1,updated_at=? WHERE owner_id=? AND id=?',
        )
        .bind(
          JSON.stringify(board),
          Math.min(8640000000000000, Math.max(Date.now(), row.updated_at + 1)),
          owner,
          id,
        ),
    ]);
  } catch (error) {
    boardFailure(error);
  }
  return readBoard(db, owner, id);
}
export async function removeBoard(
  db: D1Database,
  owner: string,
  id: string,
  revision: number,
): Promise<void> {
  const row = await ownedRow(db, owner, id, true);
  if (row.removed_at !== null) return;
  if (row.revision !== revision)
    throw new ApiError(409, 'BOARD_CHANGED', 'This board changed elsewhere. Review it before removing it.');
  try {
    await db.batch([
      revisionGuard(db, owner, id, row.revision),
      db
        .prepare(
          "UPDATE memory_boards SET body_json='{}',removed_at=?,updated_at=?,revision=revision+1 WHERE owner_id=? AND id=?",
        )
        .bind(Date.now(), Date.now(), owner, id),
    ]);
  } catch (error) {
    boardFailure(error);
  }
}
