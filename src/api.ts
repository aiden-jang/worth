import type { AuthUser } from '@aidenjang/auth-client';
import type {
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

export const api = {
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
  list: (id: string) => request<{ list: ListDetail }>(`/lists/${id}`),
  createList: (body: {
    name: string;
    kind: 'collection' | 'activity';
    description: string;
    artwork?: CollectionArt | null;
  }) => request<{ list: ListDetail }>('/lists', json('POST', body)),
  updateList: (id: string, body: { name?: string; description?: string; artwork?: CollectionArt | null }) =>
    request<{ list: ListDetail }>(`/lists/${id}`, json('PATCH', body)),
  deleteList: (id: string) => request<void>(`/lists/${id}`, { method: 'DELETE' }),
  items: (listId: string) => request<{ items: Item[] }>(`/lists/${listId}/items`),
  createItem: (listId: string, body: ItemInput, operationId?: string) =>
    request<{ item: Item }>(`/lists/${listId}/items`, {
      ...json('POST', body),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  createItems: (listId: string, titles: string[], operationId?: string) =>
    request<{ items: Item[] }>(`/lists/${listId}/items/batch`, {
      ...json('POST', { titles }),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  updateItem: (id: string, body: Partial<ItemInput>) =>
    request<{ item: Item }>(`/items/${id}`, json('PATCH', body)),
  deleteItem: (id: string) => request<void>(`/items/${id}`, { method: 'DELETE' }),
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
  updateLog: (id: string, body: Partial<LogInput>) =>
    request<{ log: Log }>(`/logs/${id}`, json('PATCH', body)),
  deleteLog: (id: string) => request<void>(`/logs/${id}`, { method: 'DELETE' }),
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
  revisitQueued?: boolean;
  title: string;
  type: string;
  note: string;
  decision: ItemDecision | null;
  startedOn: string | null;
  endedOn: string | null;
}

export interface LogInput {
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
