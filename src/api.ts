import type { ExperienceInput, MemoryFilter, MemoryPage, Preferences } from './shared/memories';
import type { SpaceSummary } from './shared/private-spaces';
import type { HistoryPage } from './shared/taste-history';
import type { AuthUser } from '@aidenjang/auth-client';
import type { SearchPage, SearchScope } from './shared/search';
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

// A document stays bound to its first account. Switching accounts requires a reload,
// so cached records and unfinished asynchronous saves cannot cross that boundary.
let pageAccount: string | null = null;
export function bindPageAccount(owner: string): boolean {
  if (pageAccount === null) pageAccount = owner;
  return pageAccount === owner;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(30_000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  let data: unknown;
  const headers = new Headers(init.headers);
  if (pageAccount && path !== '/me' && !path.startsWith('/public/'))
    headers.set('X-Worth-Account', pageAccount);
  try {
    response = await fetch(`/api${path}`, { credentials: 'include', ...init, headers, signal });
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
    if (failure?.error === 'ACCOUNT_CHANGED' && typeof window !== 'undefined')
      window.dispatchEvent(new Event('worth:account-changed'));
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

export type TrashReference = { kind: 'list' | 'item' | 'log' | 'inbox'; id: string };
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
  spaces: () => request<{ spaces: SpaceSummary[] }>('/spaces'),
  space: (id: string) => request<import('./shared/private-spaces').SpaceView>(`/spaces/${id}`),
  createSpace: (name: string, key: string) =>
    request<import('./shared/private-spaces').SpaceView>('/spaces', {
      ...json('POST', { name }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  spaceNote: (id: string, note: string, expectedRevision: number) =>
    request<import('./shared/private-spaces').SpaceView>(
      `/spaces/${id}/note`,
      json('PUT', { note, expectedRevision }),
    ),
  spaceInvite: (
    id: string,
    email: string,
    role: 'viewer' | 'editor',
    expectedRevision: number,
    key: string,
  ) =>
    request<{ link: string; inviteId: string; space: import('./shared/private-spaces').SpaceView }>(
      `/spaces/${id}/invites`,
      {
        ...json('POST', { email, role, expectedRevision }),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      },
    ),
  acceptSpace: (id: string, token: string) =>
    request<import('./shared/private-spaces').SpaceView>(
      `/spaces/invites/${id}/accept`,
      json('POST', { token }),
    ),
  revokeSpaceMember: (id: string, memberId: string, expectedRevision: number) =>
    request<import('./shared/private-spaces').SpaceView>(
      `/spaces/${id}/members/${memberId}`,
      json('DELETE', { expectedRevision }),
    ),
  shareSnapshot: (
    id: string,
    preview: import('./shared/record-snapshots').SourcePreview,
    expectedRevision: number,
    key: string,
  ) =>
    request<import('./shared/private-spaces').SpaceView>(`/spaces/${id}/entries`, {
      ...json('POST', { selection: preview.selection, hash: preview.hash, expectedRevision }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  removeSharedSnapshot: (id: string, entryId: string, expectedRevision: number) =>
    request<import('./shared/private-spaces').SpaceView>(
      `/spaces/${id}/entries/${entryId}`,
      json('DELETE', { expectedRevision }),
    ),
  removeSpace: (id: string, expectedRevision: number) =>
    request<void>(`/spaces/${id}`, json('DELETE', { expectedRevision })),
  spaceArchives: () =>
    request<{ archives: import('./shared/private-spaces').SharedArchive[] }>('/spaces/archives'),
  saveSpaceCopy: (id: string, key: string) =>
    request<{ archive: import('./shared/private-spaces').SharedArchive }>(`/spaces/${id}/archive`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    }),
  removeSpaceCopy: (id: string) => request<void>(`/spaces/archives/${id}`, { method: 'DELETE' }),
  pairs: (id: string) =>
    request<{ pairs: import('./shared/private-spaces').PairView[] }>(`/spaces/${id}/pairs`),
  createPair: (
    id: string,
    input: import('zod').infer<typeof import('./shared/private-spaces').pairInput>,
    key: string,
  ) =>
    request<import('./shared/private-spaces').PairView>(`/spaces/${id}/pairs`, {
      ...json('POST', input),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  pairChoice: (id: string, choice: number, expectedRevision: number) =>
    request<import('./shared/private-spaces').PairView>(
      `/pairs/${id}/choice`,
      json('PUT', { choice, expectedRevision }),
    ),
  revealPair: (id: string, choice: number, expectedRevision: number) =>
    request<import('./shared/private-spaces').PairView>(
      `/pairs/${id}/reveal`,
      json('POST', { choice, expectedRevision }),
    ),

  capsules: () => request<{ capsules: import('./shared/capsules').CapsuleSummary[] }>('/capsules'),
  capsule: (id: string) => request<import('./shared/capsules').CapsuleView>(`/capsules/${id}`),
  capsulePreview: (selection: import('./shared/record-snapshots').SourceSelection) =>
    request<{ preview: import('./shared/record-snapshots').SourcePreview }>(
      '/capsules/source-preview',
      json('POST', selection),
    ),
  createCapsule: (input: import('./shared/capsules').CapsuleInput, key: string) =>
    request<import('./shared/capsules').CapsuleView>('/capsules', {
      ...json('POST', input),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  checkCapsuleSave: (id: string, input: import('./shared/capsules').CapsuleInput) =>
    request<import('./shared/capsules').CapsuleView>(`/capsules/${id}/check`, json('POST', input)),
  openCapsule: (id: string) =>
    request<import('./shared/capsules').CapsuleView>(`/capsules/${id}/open`, { method: 'POST' }),
  capsuleCurrent: (id: string) =>
    request<{ current: import('./shared/capsules').CapsuleCurrent[] }>(`/capsules/${id}/current`),
  removeCapsule: (id: string) => request<void>(`/capsules/${id}`, { method: 'DELETE' }),
  receipts: () => request<{ receipts: import('./shared/receipts').ReceiptSummary[] }>('/receipts'),
  receipt: (id: string) => request<{ receipt: import('./shared/receipts').ReceiptView }>(`/receipts/${id}`),
  createReceipt: (input: import('./shared/receipts').ReceiptInput, key: string, file: Blob | null) => {
    const form = new FormData();
    form.set('receipt', JSON.stringify(input));
    if (file) form.set('attachment', file, 'receipt-copy');
    return request<{ receipt: import('./shared/receipts').ReceiptView }>('/receipts', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: form,
    });
  },
  removeReceipt: (id: string) => request<void>(`/receipts/${id}`, { method: 'DELETE' }),

  boards: () => request<{ boards: import('./shared/memory-boards').BoardSummary[] }>('/boards'),
  board: (id: string) => request<{ board: import('./shared/memory-boards').BoardView }>(`/boards/${id}`),
  createBoard: (board: import('./shared/memory-boards').BoardInput, key: string) =>
    request<{ board: import('./shared/memory-boards').BoardView }>('/boards', {
      ...json('POST', board),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  updateBoard: (id: string, board: import('./shared/memory-boards').BoardInput, expectedRevision: number) =>
    request<{ board: import('./shared/memory-boards').BoardView }>(
      `/boards/${id}`,
      json('PUT', { board, expectedRevision }),
    ),
  removeBoard: (id: string, expectedRevision: number) =>
    request<void>(`/boards/${id}`, json('DELETE', { expectedRevision })),
  gallery: (kind: 'items' | 'logs', id: string) =>
    request<{ gallery: import('./shared/photo-gallery').PhotoGallery }>(`/${kind}/${id}/photos`),
  changeGallery: (
    kind: 'items' | 'logs',
    id: string,
    input: import('zod').infer<typeof import('./shared/photo-gallery').galleryPatch>,
  ) =>
    request<{ gallery: import('./shared/photo-gallery').PhotoGallery }>(
      `/${kind}/${id}/photos`,
      json('PUT', input),
    ),
  addGalleryPhoto: (kind: 'items' | 'logs', id: string, assetId: string, blob: Blob, revision: number) =>
    request<{ gallery: import('./shared/photo-gallery').PhotoGallery }>(`/${kind}/${id}/photos/${assetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type, 'X-Worth-Gallery-Revision': String(revision) },
      body: blob,
    }),
  removeGalleryPhoto: (kind: 'items' | 'logs', id: string, assetId: string, revision: number) =>
    request<{ gallery: import('./shared/photo-gallery').PhotoGallery }>(
      `/${kind}/${id}/photos/${assetId}`,
      json('DELETE', { expectedRevision: revision }),
    ),

  calendar: (
    filter: import('./shared/activity-calendar').CalendarFilter,
    cursor = '',
    signal?: AbortSignal,
  ) =>
    request<import('./shared/activity-calendar').ActivityCalendar>(
      `/calendar?${new URLSearchParams({ month: filter.month, day: filter.day, archived: filter.includeArchived ? '1' : '0', ...(cursor ? { after: cursor } : {}) })}`,
      { signal },
    ),
  connections: () =>
    request<{ connections: import('./shared/connections').ConnectionView[] }>('/connections'),
  connection: (id: string) =>
    request<{ connection: import('./shared/connections').ConnectionView }>(`/connections/${id}`),
  createConnection: (body: import('./shared/connections').ConnectionInput, key: string) =>
    request<{ connection: import('./shared/connections').ConnectionView }>('/connections', {
      ...json('POST', body),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  updateConnection: (id: string, reason: string, expectedRevision: number) =>
    request<{ connection: import('./shared/connections').ConnectionView }>(
      `/connections/${id}`,
      json('PUT', { reason, expectedRevision }),
    ),
  removeConnection: (id: string, expectedRevision: number) =>
    request<void>(`/connections/${id}`, json('DELETE', { expectedRevision })),
  tasteHistory: (listId: string, cursor = '', until = '', signal?: AbortSignal) =>
    request<HistoryPage>(
      `/lists/${listId}/history?${new URLSearchParams({ cursor, ...(until ? { until } : {}) })}`,
      { signal },
    ),
  tasteEvent: (id: string) =>
    request<{ event: import('./shared/taste-history').TasteEvent }>(`/history/${id}`),
  historyNote: (id: string, body: import('zod').infer<typeof import('./shared/taste-history').historyNote>) =>
    request<{ event: import('./shared/taste-history').TasteEvent }>(`/history/${id}/note`, json('PUT', body)),
  retrospective: (filter: import('./shared/retrospective').RetrospectiveFilter, signal?: AbortSignal) =>
    request<import('./shared/retrospective').Retrospective>(
      `/retrospective?${new URLSearchParams({ from: filter.from, to: filter.to, list: filter.listId, archived: filter.includeArchived ? '1' : '0', startOffset: String(filter.startOffset), endOffset: String(filter.endOffset) })}`,
      { signal },
    ),
  inbox: () => request<{ entries: import('./shared/inbox').InboxEntry[] }>('/inbox'),
  inboxEntry: (id: string) => request<{ entry: import('./shared/inbox').InboxEntry }>(`/inbox/${id}`),
  createInbox: (item: import('./shared/inbox').InboxPayload, key: string) =>
    request<{ entry: import('./shared/inbox').InboxEntry }>('/inbox', {
      ...json('POST', { item }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  updateInbox: (id: string, item: import('./shared/inbox').InboxPayload, expectedRevision: number) =>
    request<{ entry: import('./shared/inbox').InboxEntry }>(
      `/inbox/${id}`,
      json('PUT', { item, expectedRevision }),
    ),
  deleteInbox: (id: string) => trashRecord('inbox', id, `/inbox/${id}`),
  uploadInboxPhoto: (id: string, blob: Blob, key: string, revision: number) =>
    request<{ entry: import('./shared/inbox').InboxEntry }>(`/inbox/${id}/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type,
        'Idempotency-Key': key,
        'X-Worth-Inbox-Revision': String(revision),
      },
      body: blob,
    }),
  deleteInboxPhoto: (id: string, revision: number, photoId: string) =>
    request<{ entry: import('./shared/inbox').InboxEntry }>(`/inbox/${id}/photo`, {
      method: 'DELETE',
      headers: { 'X-Worth-Inbox-Revision': String(revision), 'X-Worth-Photo-Id': photoId },
    }),
  fileInbox: (id: string, targetListId: string, expectedRevision: number, key: string) =>
    request<{ item: Item; logId?: string | null }>(`/inbox/${id}/file`, {
      ...json('POST', { targetListId, expectedRevision }),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  templates: () => request<{ templates: import('./shared/templates').CollectionTemplate[] }>('/templates'),
  createTemplate: (body: import('./shared/templates').CollectionTemplate) =>
    request<{ template: import('./shared/templates').CollectionTemplate }>('/templates', json('POST', body)),
  deleteTemplate: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
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
  restoreTrash: async (entries: TrashReference[]) => {
    const result = await request<{ restored: number }>('/trash/restore', json('POST', { entries }));
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('worth:restored', { detail: entries }));
    return result;
  },
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
  preferences: () => request<Preferences>('/preferences'),
  memories: (filter: MemoryFilter, signal?: AbortSignal) =>
    request<MemoryPage>(
      `/memories?${new URLSearchParams(Object.entries(filter).map(([key, value]) => [key, String(value)]))}`,
      { signal },
    ),
  createExperience: (listId: string, body: ExperienceInput, key: string) =>
    request<{ item: Item; log: Log }>(`/lists/${listId}/experiences`, {
      ...json('POST', body),
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    }),
  lists: () => request<{ lists: ListSummary[] }>('/lists'),
  archivedLists: () => request<{ lists: ListSummary[] }>('/lists?archived=1'),
  list: (id: string) => request<{ list: ListDetail }>(`/lists/${id}`),
  createList: (body: {
    name: string;
    kind: 'collection' | 'activity';
    description: string;
    artwork?: CollectionArt | null;
    detailFields?: string[];
  }) => request<{ list: ListDetail }>('/lists', json('POST', body)),
  updateList: (
    id: string,
    body: { name?: string; description?: string; artwork?: CollectionArt | null; archived?: boolean },
  ) => request<{ list: ListDetail }>(`/lists/${id}`, json('PATCH', body)),
  deleteList: (id: string) => trashRecord('list', id, `/lists/${id}`),
  item: (id: string) => request<{ item: Item }>(`/items/${id}`),
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
  createRoutine: (
    listId: string,
    body: { title: string; exercises: string[]; targets?: import('./shared/activity-plans').RoutineTarget[] },
    operationId?: string,
  ) =>
    request<{ routine: WorkoutRoutine }>(`/lists/${listId}/routines`, {
      ...json('POST', body),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  updateRoutine: (
    id: string,
    body: {
      title: string;
      exercises: string[];
      targets?: import('./shared/activity-plans').RoutineTarget[];
      expectedRevision?: number;
    },
  ) => request<{ routine: WorkoutRoutine }>(`/routines/${id}`, json('PUT', body)),
  deleteRoutine: (id: string, revision?: number) =>
    request<void>(`/routines/${id}${revision === undefined ? '' : `?revision=${revision}`}`, {
      method: 'DELETE',
    }),
  updateExerciseAliases: (id: string, body: import('./shared/activity-plans').ExerciseAliases) =>
    request<{ list: ListDetail }>(
      `/lists/${id}/exercise-aliases`,
      json('PUT', { expectedRevision: body.revision, groups: body.groups }),
    ),
  workouts: (listId: string) => request<{ workouts: WorkoutSession[] }>(`/lists/${listId}/workouts`),
  createWorkout: (
    listId: string,
    body: { title: string; happenedOn: string; routineId?: string; expectedRoutineRevision?: number },
    operationId?: string,
  ) =>
    request<{ workout: WorkoutSession }>(`/lists/${listId}/workouts`, {
      ...json('POST', body),
      headers: {
        'Content-Type': 'application/json',
        ...(operationId ? { 'Idempotency-Key': operationId } : {}),
      },
    }),
  updateWorkout: (
    id: string,
    body: {
      expectedRevision?: number;
      targets?: import('./shared/activity-plans').RoutineTarget[];
      title?: string;
      happenedOn?: string;
      status?: 'active' | 'finished';
      plannedExercises?: string[];
      skippedExercises?: string[];
    },
  ) => request<{ workout: WorkoutSession }>(`/workouts/${id}`, json('PATCH', body)),
  deleteWorkout: (id: string, revision?: number) =>
    request<void>(`/workouts/${id}${revision === undefined ? '' : `?revision=${revision}`}`, {
      method: 'DELETE',
    }),
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
  search: (query: string, signal?: AbortSignal, filter: { scope?: SearchScope; offset?: number } = {}) => {
    const params = new URLSearchParams({ q: query });
    if (filter.scope && filter.scope !== 'all') params.set('scope', filter.scope);
    if (filter.offset) params.set('offset', String(filter.offset));
    return request<SearchPage>(`/search?${params}`, { signal });
  },
  uploadPhoto: (kind: 'items' | 'logs', id: string, blob: Blob, key: string) =>
    request<{ hasPhoto: boolean }>(`/${kind}/${id}/photo`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type, 'Idempotency-Key': key },
      body: blob,
    }),
  uploadListCover: (id: string, blob: Blob, revision: number) =>
    request<{ hasCoverPhoto: boolean; revision: number }>(`/lists/${id}/cover`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type, 'X-Worth-Cover-Revision': String(revision) },
      body: blob,
    }),
  deleteListCover: (id: string, revision: number) =>
    request<void>(`/lists/${id}/cover`, {
      method: 'DELETE',
      headers: { 'X-Worth-Cover-Revision': String(revision) },
    }),
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
  exercise?: boolean;
  measurements?: import('./shared/activity-plans').MeasurementDraft[];
  expectedRevision?: number;
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
