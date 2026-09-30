import type { AuthUser } from '@aidenjang/auth-client';
import type { Item, ListDetail, ListSummary, Log, Overview, PublicShare, SearchResult, ShareSummary } from './shared/models';

export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...init });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  if (!response.ok) throw new RequestError(response.status, data?.error ?? 'REQUEST_FAILED',
    data?.message ?? `Request failed (${response.status})`);
  return data as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const api = {
  me: () => request<{ user: AuthUser | null }>('/me'),
  overview: () => request<Overview>('/overview'),
  lists: () => request<{ lists: ListSummary[] }>('/lists'),
  list: (id: string) => request<{ list: ListDetail }>(`/lists/${id}`),
  createList: (body: { name: string; kind: 'collection' | 'activity'; description: string }) =>
    request<{ list: ListDetail }>('/lists', json('POST', body)),
  updateList: (id: string, body: { name?: string; description?: string }) =>
    request<{ list: ListDetail }>(`/lists/${id}`, json('PATCH', body)),
  deleteList: (id: string) => request<void>(`/lists/${id}`, { method: 'DELETE' }),
  items: (listId: string) => request<{ items: Item[] }>(`/lists/${listId}/items`),
  createItem: (listId: string, body: ItemInput) => request<{ item: Item }>(`/lists/${listId}/items`, json('POST', body)),
  updateItem: (id: string, body: Partial<ItemInput>) => request<{ item: Item }>(`/items/${id}`, json('PATCH', body)),
  deleteItem: (id: string) => request<void>(`/items/${id}`, { method: 'DELETE' }),
  logs: (listId: string) => request<{ logs: Log[] }>(`/lists/${listId}/logs`),
  createLog: (listId: string, body: LogInput) => request<{ log: Log }>(`/lists/${listId}/logs`, json('POST', body)),
  updateLog: (id: string, body: Partial<LogInput>) => request<{ log: Log }>(`/logs/${id}`, json('PATCH', body)),
  deleteLog: (id: string) => request<void>(`/logs/${id}`, { method: 'DELETE' }),
  rank: (listId: string, itemIds: string[], expectedRevision: number) =>
    request<{ list: ListDetail }>(`/lists/${listId}/rank`, json('PUT', { itemIds, expectedRevision })),
  shares: (listId: string) => request<{ shares: ShareSummary[] }>(`/lists/${listId}/shares`),
  createShare: (listId: string, limit: 5 | 10 | 'all') =>
    request<{ id: string; token: string; share: PublicShare; expiresAt: number }>(`/lists/${listId}/shares`, json('POST', { limit })),
  revokeShare: (id: string) => request<void>(`/shares/${id}`, { method: 'DELETE' }),
  publicShare: (token: string) => request<{ share: PublicShare }>(`/public/${token}`),
  search: (query: string) => request<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`),
  uploadPhoto: (kind: 'items' | 'logs', id: string, blob: Blob) =>
    request<{ hasPhoto: boolean }>(`/${kind}/${id}/photo`, {
      method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob,
    }),
  deletePhoto: (kind: 'items' | 'logs', id: string) => request<void>(`/${kind}/${id}/photo`, { method: 'DELETE' }),
};

export interface ItemInput {
  title: string;
  type: string;
  note: string;
  startedOn: string | null;
  endedOn: string | null;
}

export interface LogInput {
  itemId: string | null;
  title: string;
  happenedOn: string;
  note: string;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
}

