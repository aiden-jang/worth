import type {
  WorkoutSession,
  Item,
  ItemDecision,
  ListDetail,
  ListSummary,
  Log,
  ShareSummary,
} from '../src/shared/models';

export type RecordExport = {
  schemaVersion: 1;
  exportedAt: string;
  photosExcluded: true;
  lists: ListDetail[];
  items: Item[];
  logs: Log[];
  workoutSessions: WorkoutSession[];
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
};

type ItemRow = {
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
  SELECT l.id, l.name, l.kind, l.description, l.artwork, l.ranked_ids, l.rank_revision, l.updated_at,
    (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id) AS item_count,
    (SELECT COUNT(*) FROM logs g WHERE g.list_id = l.id) AS log_count,
    json_array_length(l.ranked_ids) AS ranked_count,
    (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id AND i.decision = 'favorite') AS favorite_count,
    EXISTS(SELECT 1 FROM list_photos p WHERE p.list_id = l.id) AS has_cover_photo
  FROM lists l
`;

function mapList(row: ListRow): ListDetail {
  return {
    id: row.id,
    name: row.name,
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
    updatedAt: row.updated_at,
  };
}

export async function listLists(db: D1Database, ownerId: string): Promise<ListSummary[]> {
  const { results } = await db
    .prepare(`${listQuery} WHERE l.owner_id = ? ORDER BY l.updated_at DESC`)
    .bind(ownerId)
    .all<ListRow>();
  return results.map(({ ranked_ids: _rankedIds, rank_revision: _rankRevision, ...row }) => ({
    id: row.id,
    name: row.name,
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
    id: row.id,
    listId: row.list_id,
    title: row.title,
    type: row.type,
    note: row.note,
    decision: row.decision,
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
  SELECT i.id, i.list_id, i.title, i.type, i.note, i.decision, i.started_on, i.ended_on,
    i.created_at, i.updated_at,
    EXISTS(SELECT 1 FROM item_photos p WHERE p.item_id = i.id) AS has_photo,
    (SELECT COUNT(*) FROM logs g WHERE g.item_id = i.id) AS log_count,
    (SELECT MAX(g.happened_on) FROM logs g WHERE g.item_id = i.id) AS last_logged_on
  FROM items i
`;

export async function listItems(db: D1Database, ownerId: string, listId: string): Promise<Item[]> {
  const { results } = await db
    .prepare(`${itemQuery} WHERE i.owner_id = ? AND i.list_id = ? ORDER BY i.created_at DESC`)
    .bind(ownerId, listId)
    .all<ItemRow>();
  return results.map(mapItem);
}

export async function requireItem(db: D1Database, ownerId: string, id: string): Promise<Item> {
  const row = await db
    .prepare(`${itemQuery} WHERE i.owner_id = ? AND i.id = ?`)
    .bind(ownerId, id)
    .first<ItemRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Item not found');
  return mapItem(row);
}

function mapLog(row: LogRow): Log {
  return {
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
      FROM logs g WHERE g.owner_id = ? AND g.list_id = ? ORDER BY g.happened_on DESC, g.created_at DESC`,
    )
    .bind(ownerId, listId)
    .all<LogRow>();
  return results.map(mapLog);
}

export async function requireLog(db: D1Database, ownerId: string, id: string): Promise<Log> {
  const row = await db
    .prepare(
      `SELECT g.*, EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id = g.id) AS has_photo
      FROM logs g WHERE g.owner_id = ? AND g.id = ?`,
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
  const [listResult, itemResult, logResult, workoutResult] = await Promise.all([
    db.prepare(`${listQuery} WHERE l.owner_id = ? ORDER BY l.created_at ASC`).bind(ownerId).all<ListRow>(),
    db.prepare(`${itemQuery} WHERE i.owner_id = ? ORDER BY i.created_at ASC`).bind(ownerId).all<ItemRow>(),
    db
      .prepare(
        `SELECT g.*, EXISTS(SELECT 1 FROM log_photos p WHERE p.log_id = g.id) AS has_photo
        FROM logs g WHERE g.owner_id = ? ORDER BY g.happened_on ASC, g.created_at ASC`,
      )
      .bind(ownerId)
      .all<LogRow>(),
    db
      .prepare('SELECT * FROM workout_sessions WHERE owner_id = ? ORDER BY happened_on ASC, created_at ASC')
      .bind(ownerId)
      .all<WorkoutRow>(),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: listResult.results.map(mapList),
    items: itemResult.results.map(mapItem),
    logs: logResult.results.map(mapLog),
    workoutSessions: workoutResult.results.map(mapWorkout),
  };
}

type WorkoutRow = {
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
      'SELECT * FROM workout_sessions WHERE owner_id = ? AND list_id = ? ORDER BY happened_on DESC, created_at DESC',
    )
    .bind(ownerId, listId)
    .all<WorkoutRow>();
  return results.map(mapWorkout);
}
export async function requireWorkout(db: D1Database, ownerId: string, id: string): Promise<WorkoutSession> {
  const row = await db
    .prepare('SELECT * FROM workout_sessions WHERE owner_id = ? AND id = ?')
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
