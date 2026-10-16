import type { AuthUser } from '@aidenjang/auth-client';
import type {
  TrashEntry,
  CollectionArt,
  ArchivePatterns,
  ExerciseSet,
  Item,
  ItemDecision,
  ListDetail,
  ListSummary,
  Log,
  Overview,
  PublicShare,
  SearchResult,
  ShareSummary,
  WorkoutRoutine,
  WorkoutSession,
} from './shared/models';

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(30_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  let data: unknown;
  try {
    response = await fetch(`/api${path}`, { credentials: 'include', ...init, signal });
    if (response.status === 204) return undefined as T;
    data = await response.json().catch((error: unknown) => {
      if (signal.aborted) throw error;
      return null;
    });
  } catch (error) {
    // Search cancellation belongs to the caller, so React Query can discard it quietly.
    if (init.signal?.aborted) throw error;
    throw new RequestError(
      0,
      timeout.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      timeout.aborted
        ? 'This is taking too long. Check whether your change was saved before trying again.'
        : 'Couldn’t connect to Worth. Check your connection and try again.',
    );
  }
  const envelope = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  if (!response.ok) {
    const failure = envelope as { error?: unknown; message?: unknown } | null;
    throw new RequestError(
      response.status,
      typeof failure?.error === 'string' ? failure.error : 'REQUEST_FAILED',
      typeof failure?.message === 'string' ? failure.message : `Request failed (${response.status})`,
    );
  }
  if (!envelope)
    throw new RequestError(502, 'INVALID_RESPONSE', 'Worth returned an unreadable response. Try again.');
  return envelope as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export type TrashReference = { kind: 'list' | 'item' | 'log'; id: string };
export type ArchiveAction = import('zod').infer<typeof import('./shared/validation').archiveActionInput>;
export function announceTrash(entries: TrashReference[]) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('worth:trashed', { detail: entries }));
}
async function trashRecord(kind: TrashReference['kind'], id: string, path: string) {
  await request<void>(path, { method: 'DELETE' });
  announceTrash([{ kind, id }]);
}
export const api = {
  workspace: (listId: string) =>
    request<import('./shared/workspace').WorkspaceResponse>(`/lists/${listId}/workspace`),
  updateWorkspace: (
    listId: string,
    workspace: import('./shared/workspace').CollectionWorkspace,
    expectedRevision: number,
  ) =>
    request<import('./shared/workspace').WorkspaceResponse>(
      `/lists/${listId}/workspace`,
      json('PUT', { workspace, expectedRevision }),
    ),
  trash: () => request<{ entries: TrashEntry[] }>('/trash'),
  restoreTrash: (entries: TrashReference[]) =>
    request<{ restored: number }>('/trash/restore', json('POST', { entries })),
  mergedItems: (id: string) => request<{ items: Item[] }>(`/items/${id}/merged`),
  separateItem: (id: string, sourceId: string) =>
    request<{ item: Item }>(`/items/${id}/separate/${sourceId}`, json('POST', {})),
  collectionAction: (listId: string, body: ArchiveAction, key: string) =>
    request<{ count: number; action: string }>(`/lists/${listId}/actions`, {
      ...json('POST', body),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  exportArchive: (photos = false) =>
    request<import('./shared/portability').ArchiveFile>(photos ? '/export/backup' : '/export/records'),
  restoreArchive: (body: import('./shared/portability').ArchiveFile, key: string) =>
    request<{ ids: string[] }>('/import', {
      ...json('POST', body),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  deleteWorthData: () =>
    request<void>('/data', {
      method: 'DELETE',
      headers: { 'X-Worth-Confirmation': 'delete-all-worth-data' },
    }),
  me: () => request<{ user: AuthUser | null }>('/me'),
  overview: () => request<Overview>('/overview'),
  patterns: () => request<ArchivePatterns>('/patterns'),
  lists: () => request<{ lists: ListSummary[] }>('/lists'),
  archivedLists: () => request<{ lists: ListSummary[] }>('/lists?archived=1'),
  list: (id: string) => request<{ list: ListDetail }>(`/lists/${id}`),
  createList: (body: {
    name: string;
    kind: 'collection' | 'activity';
    description: string;
    artwork?: CollectionArt | null;
  }) => request<{ list: ListDetail }>('/lists', json('POST', body)),
  updateList: (
    id: string,
    body: { name?: string; description?: string; artwork?: CollectionArt | null; archived?: boolean },
  ) => request<{ list: ListDetail }>(`/lists/${id}`, json('PATCH', body)),
  deleteList: (id: string) => trashRecord('list', id, `/lists/${id}`),
  items: (listId: string) => request<{ items: Item[] }>(`/lists/${listId}/items`),
  createItem: (listId: string, body: ItemInput, operationId?: string) =>
    request<{ item: Item }>(`/lists/${listId}/items`, {
      ...json('POST', body),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  createItems: (listId: string, titles: string[], operationId?: string, wantToTry = false) =>
    request<{ items: Item[] }>(`/lists/${listId}/items/batch`, {
      ...json('POST', { titles, wantToTry }),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  importItems: (
    listId: string,
    items: import('./shared/reviewed-capture').ReviewedItem[],
    operationId: string,
  ) =>
    request<{ items: Item[] }>(`/lists/${listId}/items/import`, {
      ...json('POST', { items }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': operationId },
    }),
  updateItem: (id: string, body: Partial<ItemInput>) =>
    request<{ item: Item }>(`/items/${id}`, json('PATCH', body)),
  deleteItem: (id: string) => trashRecord('item', id, `/items/${id}`),
  routines: (listId: string) => request<{ routines: WorkoutRoutine[] }>(`/lists/${listId}/routines`),
  createRoutine: (listId: string, body: { title: string; exercises: string[] }) =>
    request<{ routine: WorkoutRoutine }>(`/lists/${listId}/routines`, json('POST', body)),
  updateRoutine: (id: string, body: { title: string; exercises: string[] }) =>
    request<{ routine: WorkoutRoutine }>(`/routines/${id}`, json('PUT', body)),
  deleteRoutine: (id: string) => request<void>(`/routines/${id}`, { method: 'DELETE' }),
  workouts: (listId: string) => request<{ workouts: WorkoutSession[] }>(`/lists/${listId}/workouts`),
  createWorkout: (listId: string, body: { title: string; happenedOn: string; routineId?: string }) =>
    request<{ workout: WorkoutSession }>(`/lists/${listId}/workouts`, json('POST', body)),
  updateWorkout: (
    id: string,
    body: {
      title?: string;
      happenedOn?: string;
      status?: 'active' | 'finished';
      plannedExercises?: string[];
      skippedExercises?: string[];
    },
  ) => request<{ workout: WorkoutSession }>(`/workouts/${id}`, json('PATCH', body)),
  deleteWorkout: (id: string) => request<void>(`/workouts/${id}`, { method: 'DELETE' }),
  logs: (listId: string) => request<{ logs: Log[] }>(`/lists/${listId}/logs`),
  createLog: (listId: string, body: LogInput, operationId?: string) =>
    request<{ log: Log }>(`/lists/${listId}/logs`, {
      ...json('POST', body),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  updateLog: (id: string, body: Partial<LogInput> & { expectedRevision?: number }) =>
    request<{ log: Log }>(`/logs/${id}`, json('PATCH', body)),
  deleteLog: (id: string) => trashRecord('log', id, `/logs/${id}`),
  rank: (listId: string, itemIds: string[], expectedRevision: number) =>
    request<{ list: ListDetail }>(`/lists/${listId}/rank`, json('PUT', { itemIds, expectedRevision })),
  shares: (listId: string) => request<{ shares: ShareSummary[] }>(`/lists/${listId}/shares`),
  createShare: (listId: string, limit: 5 | 10 | 'all') =>
    request<{ id: string; token: string; share: PublicShare; expiresAt: number }>(
      `/lists/${listId}/shares`,
      json('POST', { limit }),
    ),
  revokeShare: (id: string) => request<void>(`/shares/${id}`, { method: 'DELETE' }),
  publicShare: (token: string) => request<{ share: PublicShare }>(`/public/${token}`),
  search: (query: string, signal?: AbortSignal) =>
    request<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`, { signal }),
  uploadPhoto: (kind: 'items' | 'logs', id: string, blob: Blob) =>
    request<{ hasPhoto: boolean }>(`/${kind}/${id}/photo`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type },
      body: blob,
    }),
  deletePhoto: (kind: 'items' | 'logs', id: string) =>
    request<void>(`/${kind}/${id}/photo`, { method: 'DELETE' }),
  uploadListCover: (id: string, blob: Blob) =>
    request<{ hasCoverPhoto: boolean }>(`/lists/${id}/cover`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type },
      body: blob,
    }),
  deleteListCover: (id: string) => request<void>(`/lists/${id}/cover`, { method: 'DELETE' }),
};

export interface ItemInput {
  context?: import('./shared/item-context').ItemContext;
  expectedContextRevision?: number;
  wantToTry?: boolean;
  revisitQueued?: boolean;
  title: string;
  type: string;
  note: string;
  decision: ItemDecision | null;
  startedOn: string | null;
  endedOn: string | null;
}

export interface LogInput {
  context?: import('./shared/visit-context').VisitContext;
  workoutId?: string | null;
  exerciseSets?: ExerciseSet[];
  weightUnit?: 'kg' | 'lb';
  itemId: string | null;
  title: string;
  happenedOn: string;
  note: string;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
}
