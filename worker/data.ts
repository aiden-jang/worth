import { mapReceipt, type ReceiptRow } from './receipt-data';
import { exportReceiptReferences, type SavedReceipt } from '../src/shared/receipts';
import { mapBoard, type BoardRow } from './board-data';
import { exportBoardReferences, type SavedBoard } from '../src/shared/memory-boards';
import { galleryEntries, type GalleryEntry, type GallerySource } from '../src/shared/photo-gallery';
import { connectionsQuery, mapConnection, type ConnectionRow } from './connections';
import type { RecordConnection } from '../src/shared/connections';
import { historyQuery, mapHistory, type HistoryRow } from './taste-history';
import type { TasteEvent } from '../src/shared/taste-history';
import { mapInbox, type InboxRow } from './inbox';
import { collectionTemplates } from '../src/shared/templates';
import type { InboxEntry } from '../src/shared/inbox';
import type { CollectionTemplate } from '../src/shared/templates';
import { visitContext, hasVisitContext } from '../src/shared/visit-context';
import type {
  Item,
  ItemDecision,
  ListDetail,
  ListSummary,
  Log,
  ShareSummary,
  WorkoutRoutine,
  WorkoutSession,
} from '../src/shared/models';
import { collectionWorkspace, filterWorkspace } from '../src/shared/workspace';
import { emptyItemContext, type ItemContext } from '../src/shared/item-context';
const emptyContextJson = JSON.stringify(emptyItemContext);

export type RecordExport = {
  inbox: InboxEntry[];
  collectionTemplates: CollectionTemplate[];
  schemaVersion: 7;
  receipts: SavedReceipt[];
  boards: SavedBoard[];
  photoAssets: GallerySource[];
  connections: RecordConnection[];
  tasteHistory: TasteEvent[];
  exportedAt: string;
  photosExcluded: true;
  lists: ListDetail[];
  items: (Item & { gallery: GalleryEntry[]; coverPhotoId: string | null })[];
  logs: (Log & { gallery: GalleryEntry[]; coverPhotoId: string | null })[];
  workoutSessions: WorkoutSession[];
  workoutRoutines: WorkoutRoutine[];
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type ListRow = {
  archived: number;
  workspace_json: string;
  id: string;
  name: string;
  kind: 'collection' | 'activity';
  description: string;
  artwork: string | null;
  ranked_ids: string;
  rank_revision: number;
  updated_at: number;
  item_count: number;
  log_count: number;
  ranked_count: number;
  favorite_count: number;
  has_cover_photo: number;
  cover_revision: number;
};

type ItemRow = {
  gallery_json: string;
  cover_photo_id: string | null;
  context_json: string;
  context_revision: number;
  revisit_queued: number;
  want_to_try: number;
  merged_into_id: string | null;
  merged_ids: string;
  id: string;
  list_id: string;
  title: string;
  type: string;
  note: string;
  decision: ItemDecision | null;
  started_on: string | null;
  ended_on: string | null;
  has_photo: number;
  created_at: number;
  updated_at: number;
  log_count: number;
  last_logged_on: string | null;
};

type LogRow = {
  gallery_json: string;
  cover_photo_id: string | null;
  context_json: string;
  revision: number;
  workout_id: string | null;
  exercise_sets: string;
  weight_unit: 'kg' | 'lb';
  id: string;
  list_id: string;
  item_id: string | null;
  title: string;
  happened_on: string;
  note: string;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
  has_photo: number;
  created_at: number;
  updated_at: number;
};

type ShareRow = {
  id: string;
  title: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
};

const listQuery = `
  SELECT l.id, l.name, l.kind, l.description, l.archived, l.artwork, l.ranked_ids, l.rank_revision, l.updated_at, l.workspace_json, l.cover_revision,
    (SELECT COUNT(*) FROM record_items i WHERE i.list_id = l.id AND i.merged_into_id IS NULL) AS item_count,
    (SELECT COUNT(*) FROM active_logs g WHERE g.list_id = l.id) AS log_count,
    json_array_length(l.ranked_ids) AS ranked_count,
    (SELECT COUNT(*) FROM record_items i WHERE i.list_id = l.id AND i.decision = 'favorite' AND i.merged_into_id IS NULL) AS favorite_count,
    EXISTS(SELECT 1 FROM list_photos p WHERE p.list_id = l.id) AS has_cover_photo
  FROM active_lists l
`;

function mapList(row: ListRow): ListDetail {
  return {
    id: row.id,
    name: row.name,
    archived: Boolean(row.archived),
    kind: row.kind,
    description: row.description,
    artwork: row.artwork ? JSON.parse(row.artwork) : null,
    rankedIds: JSON.parse(row.ranked_ids) as string[],
    rankRevision: row.rank_revision,
    itemCount: row.item_count,
    logCount: row.log_count,
    rankedCount: row.ranked_count,
    favoriteCount: row.favorite_count,
    hasCoverPhoto: Boolean(row.has_cover_photo),
    coverRevision: row.cover_revision,
    updatedAt: row.updated_at,
  };
}

export async function listLists(
  db: D1Database,
  ownerId: string,
  status: 'current' | 'archived' = 'current',
): Promise<ListSummary[]> {
  const { results } = await db
    .prepare(`${listQuery} WHERE l.owner_id = ? AND l.archived = ? ORDER BY l.updated_at DESC`)
    .bind(ownerId, status === 'archived' ? 1 : 0)
    .all<ListRow>();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    archived: Boolean(row.archived),
    kind: row.kind,
    description: row.description,
    artwork: row.artwork ? JSON.parse(row.artwork) : null,
    itemCount: row.item_count,
    logCount: row.log_count,
    rankedCount: row.ranked_count,
    favoriteCount: row.favorite_count,
    hasCoverPhoto: Boolean(row.has_cover_photo),
    updatedAt: row.updated_at,
  }));
}

export async function requireList(db: D1Database, ownerId: string, id: string): Promise<ListDetail> {
  const row = await db
    .prepare(`${listQuery} WHERE l.owner_id = ? AND l.id = ?`)
    .bind(ownerId, id)
    .first<ListRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'List not found');
  return mapList(row);
}

function mapItem(row: ItemRow): Item {
  return {
    // Writes validate context; empty records need neither another parse nor a large default payload.
    context:
      row.context_json && row.context_json !== '{}' && row.context_json !== emptyContextJson
        ? (JSON.parse(row.context_json) as ItemContext)
        : undefined,
    contextRevision: row.context_revision ?? 0,
    id: row.id,
    listId: row.list_id,
    title: row.title,
    type: row.type,
    note: row.note,
    decision: row.decision,
    revisitQueued: Boolean(row.revisit_queued),
    wantToTry: Boolean(row.want_to_try),
    mergedIntoId: row.merged_into_id,
    mergedIds: JSON.parse(row.merged_ids ?? '[]'),
    startedOn: row.started_on,
    endedOn: row.ended_on,
    hasPhoto: Boolean(row.has_photo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    logCount: row.log_count,
    lastLoggedOn: row.last_logged_on,
  };
}

const itemQuery = `
  SELECT i.gallery_json,i.cover_photo_id,i.context_revision, i.context_json, i.want_to_try, i.merged_into_id, (SELECT json_group_array(m.id) FROM record_items m WHERE m.merged_into_id = i.id) AS merged_ids, i.revisit_queued, i.id, i.list_id, i.title, i.type, i.note, i.decision, i.started_on, i.ended_on,
    i.created_at, i.updated_at,
    EXISTS(SELECT 1 FROM item_photos p WHERE p.item_id = i.id) AS has_photo,
    (SELECT COUNT(*) FROM active_logs g WHERE g.item_id IN (SELECT m.id FROM record_items m WHERE m.id = i.id OR m.merged_into_id = i.id)) AS log_count,
    (SELECT MAX(g.happened_on) FROM active_logs g WHERE g.item_id IN (SELECT m.id FROM record_items m WHERE m.id = i.id OR m.merged_into_id = i.id)) AS last_logged_on
  FROM record_items i
`;

export async function listItems(
  db: D1Database,
  ownerId: string,
  listId: string,
  includeMerged = false,
  ids?: string[],
): Promise<Item[]> {
  const { results } = await db
    .prepare(
      `${itemQuery} WHERE i.owner_id = ? AND i.list_id = ? ${includeMerged ? '' : 'AND i.merged_into_id IS NULL'} ${ids ? 'AND i.id IN (SELECT value FROM json_each(?))' : ''} ORDER BY i.created_at DESC`,
    )
    .bind(ownerId, listId, ...(ids ? [JSON.stringify(ids)] : []))
    .all<ItemRow>();
  return results.map(mapItem);
}

export async function requireItem(
  db: D1Database,
  ownerId: string,
  id: string,
  includeMerged = false,
): Promise<Item> {
  const row = await db
    .prepare(
      `${itemQuery} WHERE i.owner_id = ? AND i.id = ? ${includeMerged ? '' : 'AND i.merged_into_id IS NULL'}`,
    )
    .bind(ownerId, id)
    .first<ItemRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Item not found');
  return mapItem(row);
}

function mapLog(row: LogRow): Log {
  const context = visitContext.parse(JSON.parse(row.context_json ?? '{}'));
  return {
    context: hasVisitContext(context) ? context : undefined,
    revision: row.revision ?? 0,
    id: row.id,
    listId: row.list_id,
    itemId: row.item_id,
    title: row.title,
    workoutId: row.workout_id,
    happenedOn: row.happened_on,
    exerciseSets: JSON.parse(row.exercise_sets),
    weightUnit: row.weight_unit,
    note: row.note,
    amount: row.amount,
    unit: row.unit,
    sets: row.sets,
    reps: row.reps,
    hasPhoto: Boolean(row.has_photo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listLogs(db: D1Database, ownerId: string, listId: string): Promise<Log[]> {
  const { results } = await db
    .prepare(
      `SELECT g.*, EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id = g.id) AS has_photo
      FROM active_logs g WHERE g.owner_id = ? AND g.list_id = ? ORDER BY g.happened_on DESC, g.created_at DESC`,
    )
    .bind(ownerId, listId)
    .all<LogRow>();
  return results.map(mapLog);
}

export async function requireLog(db: D1Database, ownerId: string, id: string): Promise<Log> {
  const row = await db
    .prepare(
      `SELECT g.*, EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id = g.id) AS has_photo
      FROM active_logs g WHERE g.owner_id = ? AND g.id = ?`,
    )
    .bind(ownerId, id)
    .first<LogRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Log not found');
  return mapLog(row);
}

export async function listShares(db: D1Database, ownerId: string, listId: string): Promise<ShareSummary[]> {
  const { results } = await db
    .prepare(
      'SELECT id, title, created_at, expires_at, revoked_at FROM shares WHERE owner_id = ? AND list_id = ? ORDER BY created_at DESC',
    )
    .bind(ownerId, listId)
    .all<ShareRow>();
  return results.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }));
}

export async function exportRecords(db: D1Database, ownerId: string): Promise<RecordExport> {
  const [
    listResult,
    itemResult,
    logResult,
    workoutResult,
    routineResult,
    inboxResult,
    templateResult,
    historyResult,
    historySizeResult,
    connectionResult,
    photoAssetResult,
    boardResult,
    boardSizeResult,
    receiptResult,
    receiptSizeResult,
  ] = await db.batch([
    db.prepare(`${listQuery} WHERE l.owner_id = ? ORDER BY l.created_at ASC`).bind(ownerId),
    db.prepare(`${itemQuery} WHERE i.owner_id = ? ORDER BY i.created_at ASC`).bind(ownerId),
    db
      .prepare(
        `SELECT g.*, EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id = g.id) AS has_photo
        FROM active_logs g WHERE g.owner_id = ? ORDER BY g.happened_on ASC, g.created_at ASC`,
      )
      .bind(ownerId),
    db
      .prepare(
        'SELECT * FROM workout_sessions WHERE list_id IN (SELECT id FROM active_lists) AND owner_id = ? ORDER BY happened_on ASC, created_at ASC',
      )
      .bind(ownerId),
    db
      .prepare(
        'SELECT * FROM workout_routines WHERE list_id IN (SELECT id FROM active_lists) AND owner_id = ? ORDER BY created_at ASC',
      )
      .bind(ownerId),
    db
      .prepare(
        'SELECT * FROM inbox_entries WHERE owner_id = ? AND trashed_at IS NULL ORDER BY created_at DESC, id DESC',
      )
      .bind(ownerId),
    db.prepare('SELECT templates_json FROM collection_template_sets WHERE owner_id = ?').bind(ownerId),
    db
      .prepare(
        `SELECT allowed.* FROM (${historyQuery}) allowed CROSS JOIN
      (SELECT COUNT(*) AS n, COALESCE(SUM(length(before_json) + length(after_json) + length(CAST(reason AS BLOB)) + 300),0) AS bytes FROM (${historyQuery})) bounds
      WHERE bounds.n <= 10000 AND bounds.bytes <= 16777216 ORDER BY allowed.created_at, allowed.id`,
      )
      .bind(ownerId, ownerId),
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(length(before_json) + length(after_json) + length(CAST(reason AS BLOB)) + 300),0) AS bytes FROM (${historyQuery})`,
      )
      .bind(ownerId),
    db.prepare(`${connectionsQuery} ORDER BY c.created_at,c.id`).bind(ownerId),
    db
      .prepare(
        `SELECT a.id, CASE WHEN a.item_id IS NOT NULL THEN 'item' ELSE 'log' END AS kind, COALESCE(a.item_id,a.log_id) AS recordId, a.content_type AS contentType,a.fingerprint,a.created_at AS createdAt,a.data IS NOT NULL AS available FROM photo_assets a WHERE a.owner_id=? AND a.removed_at IS NULL AND (EXISTS(SELECT 1 FROM record_items i WHERE i.id=a.item_id AND i.owner_id=a.owner_id) OR EXISTS(SELECT 1 FROM active_logs g WHERE g.id=a.log_id AND g.owner_id=a.owner_id)) ORDER BY a.created_at,a.id LIMIT 5001`,
      )
      .bind(ownerId),
    db
      .prepare(
        `SELECT * FROM memory_boards WHERE owner_id=? AND removed_at IS NULL AND
      (SELECT COALESCE(SUM(length(CAST(body_json AS BLOB))),0) FROM memory_boards WHERE owner_id=? AND removed_at IS NULL)<=16777216 ORDER BY created_at,id LIMIT 101`,
      )
      .bind(ownerId, ownerId),
    db
      .prepare(
        'SELECT COUNT(*) AS n,COALESCE(SUM(length(CAST(body_json AS BLOB))),0) AS bytes FROM memory_boards WHERE owner_id=? AND removed_at IS NULL',
      )

      .bind(ownerId),
    db
      .prepare(
        `SELECT id,owner_id,body_json,creation_hash,created_at,removed_at FROM receipts WHERE owner_id=? AND removed_at IS NULL AND
      (SELECT COALESCE(SUM(length(CAST(body_json AS BLOB))),0) FROM receipts WHERE owner_id=? AND removed_at IS NULL)<=16777216 ORDER BY created_at,id LIMIT 101`,
      )
      .bind(ownerId, ownerId),
    db
      .prepare(
        'SELECT COUNT(*) AS n,COALESCE(SUM(length(CAST(body_json AS BLOB))),0) AS bytes FROM receipts WHERE owner_id=? AND removed_at IS NULL',
      )
      .bind(ownerId),
  ]);
  const receiptBounds = receiptSizeResult.results[0] as { n: number; bytes: number };
  if (receiptBounds.n > 100 || receiptBounds.bytes > 16777216)
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'Receipt text exceeds the backup limit of 100 receipts or 16 MB. No receipts were omitted.',
    );
  const boardBounds = boardSizeResult.results[0] as { n: number; bytes: number };
  if (boardBounds.n > 100 || boardBounds.bytes > 16777216)
    throw new ApiError(
      413,
      'BACKUP_TOO_LARGE',
      'Board text exceeds the backup limit of 100 boards or 16 MB. No boards were omitted.',
    );
  if (photoAssetResult.results.length > 5000)
    throw new ApiError(
      413,
      'PHOTO_EXPORT_TOO_LARGE',
      'This archive exceeds 5,000 photo sources. Contact support for a full archive transfer. No photos were omitted.',
    );
  const historySize = historySizeResult.results[0] as { n: number; bytes: number };
  if (historySize.n > 10000 || historySize.bytes > 16 * 1024 * 1024)
    throw new ApiError(
      413,
      'HISTORY_EXPORT_TOO_LARGE',
      'This archive exceeds 10,000 history changes or 16 MB of history. Contact support for a full archive transfer. No history was omitted.',
    );
  const boardItemIds = new Set(
    (itemResult.results as ItemRow[]).filter((item) => !item.merged_into_id).map((item) => item.id),
  );
  const exportedItemIds = new Set((itemResult.results as ItemRow[]).map((i) => i.id));
  const exportedLogIds = new Set((logResult.results as LogRow[]).map((g) => g.id));
  return {
    collectionTemplates: collectionTemplates.parse(
      JSON.parse(
        (templateResult.results[0] as { templates_json: string } | undefined)?.templates_json ?? '[]',
      ),
    ),
    inbox: (inboxResult.results as InboxRow[]).map(mapInbox),
    // Older readers must reject new backup kinds instead of silently discarding them.
    schemaVersion: 7,
    boards: (boardResult.results as BoardRow[]).map((row) =>
      exportBoardReferences(mapBoard(row), boardItemIds, exportedLogIds),
    ),
    receipts: (receiptResult.results as ReceiptRow[]).map((row) =>
      exportReceiptReferences(mapReceipt(row), boardItemIds),
    ),
    photoAssets: (
      photoAssetResult.results as (Omit<GallerySource, 'available'> & { available: number })[]
    ).map((row) => ({ ...row, available: !!row.available })),
    connections: (connectionResult.results as ConnectionRow[]).map(mapConnection),
    tasteHistory: (historyResult.results as HistoryRow[]).map((row) =>
      mapHistory(row, exportedItemIds, exportedLogIds),
    ),
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: (listResult.results as ListRow[]).map((row) => ({
      ...mapList(row),
      coverRevision: undefined, // New IDs start a fresh cover revision on restore.
      workspace: filterWorkspace(
        collectionWorkspace.parse(JSON.parse(row.workspace_json)),
        new Set(
          (itemResult.results as ItemRow[])
            .filter((item) => item.list_id === row.id && !item.merged_into_id)
            .map((item) => item.id),
        ),
      ),
    })),
    items: (itemResult.results as ItemRow[]).map((row) => ({
      ...mapItem(row),
      gallery: galleryEntries.parse(JSON.parse(row.gallery_json)),
      coverPhotoId: row.cover_photo_id,
    })),
    logs: (logResult.results as LogRow[]).map((row) => ({
      ...mapLog(row),
      gallery: galleryEntries.parse(JSON.parse(row.gallery_json)),
      coverPhotoId: row.cover_photo_id,
    })),
    workoutSessions: (workoutResult.results as WorkoutRow[]).map(mapWorkout),
    workoutRoutines: (routineResult.results as RoutineRow[]).map(mapRoutine),
  };
}

type WorkoutRow = {
  status: 'active' | 'finished';
  skipped_exercises: string;
  planned_exercises: string;
  id: string;
  list_id: string;
  owner_id: string;
  title: string;
  happened_on: string;
  created_at: number;
  updated_at: number;
};
function mapWorkout(row: WorkoutRow): WorkoutSession {
  return {
    plannedExercises: JSON.parse(row.planned_exercises ?? '[]'),
    skippedExercises: JSON.parse(row.skipped_exercises ?? '[]'),
    status: row.status,
    id: row.id,
    listId: row.list_id,
    title: row.title,
    happenedOn: row.happened_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function listWorkouts(
  db: D1Database,
  ownerId: string,
  listId: string,
): Promise<WorkoutSession[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM workout_sessions WHERE list_id IN (SELECT id FROM active_lists) AND owner_id = ? AND list_id = ? ORDER BY happened_on DESC, created_at DESC',
    )
    .bind(ownerId, listId)
    .all<WorkoutRow>();
  return results.map(mapWorkout);
}
export async function requireWorkout(db: D1Database, ownerId: string, id: string): Promise<WorkoutSession> {
  const row = await db
    .prepare(
      'SELECT * FROM workout_sessions WHERE list_id IN (SELECT id FROM active_lists) AND owner_id = ? AND id = ?',
    )
    .bind(ownerId, id)
    .first<WorkoutRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Workout not found');
  return mapWorkout(row);
}
export async function validateWorkoutTarget(
  db: D1Database,
  ownerId: string,
  listId: string,
  workoutId: string | null,
  happenedOn: string,
  exerciseSets: unknown[],
  itemId: string | null,
): Promise<void> {
  if (!workoutId) return;
  const workout = await requireWorkout(db, ownerId, workoutId);
  if (workout.listId !== listId)
    throw new ApiError(400, 'INVALID_WORKOUT', 'Choose a workout in this activity list');
  if (workout.happenedOn !== happenedOn)
    throw new ApiError(400, 'INVALID_WORKOUT_DATE', 'The exercise date must match its workout');
  if (!exerciseSets.length || itemId)
    throw new ApiError(400, 'INVALID_WORKOUT_EXERCISE', 'Workout entries must contain exercise sets');
}

type RoutineRow = {
  id: string;
  list_id: string;
  owner_id: string;
  title: string;
  exercises: string;
  created_at: number;
  updated_at: number;
};
function mapRoutine(row: RoutineRow): WorkoutRoutine {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    exercises: JSON.parse(row.exercises),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function listRoutines(
  db: D1Database,
  ownerId: string,
  listId: string,
): Promise<WorkoutRoutine[]> {
  const { results } = await db
    .prepare(
      'SELECT * FROM workout_routines WHERE list_id IN (SELECT id FROM active_lists) AND owner_id = ? AND list_id = ? ORDER BY title COLLATE NOCASE, created_at',
    )
    .bind(ownerId, listId)
    .all<RoutineRow>();
  return results.map(mapRoutine);
}
export async function requireRoutine(db: D1Database, ownerId: string, id: string): Promise<WorkoutRoutine> {
  const row = await db
    .prepare(
      'SELECT * FROM workout_routines WHERE list_id IN (SELECT id FROM active_lists) AND owner_id = ? AND id = ?',
    )
    .bind(ownerId, id)
    .first<RoutineRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Routine not found');
  return mapRoutine(row);
}
