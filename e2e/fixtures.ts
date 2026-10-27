import { test as base, expect, type Page } from '@playwright/test';
import type { Item, ListDetail, Log, TrashEntry } from '../src/shared/models';
import type { WorkspaceResponse } from '../src/shared/workspace';
import type { CollectionTemplate } from '../src/shared/templates';
import { itemInput } from '../src/shared/validation';
import type { InboxEntry } from '../src/shared/inbox';
import { emptyItemContext } from '../src/shared/item-context';

export const list: ListDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'My drinks',
  kind: 'collection',
  description: '',
  artwork: null,
  itemCount: 2,
  logCount: 0,
  rankedCount: 1,
  favoriteCount: 1,
  hasCoverPhoto: false,
  rankedIds: ['coffee'],
  rankRevision: 1,
  updatedAt: 1791547200000,
};
export const item: Item = {
  id: 'coffee',
  listId: list.id,
  title: 'Coffee',
  type: 'Drink',
  note: 'PRIVATE NOTE',
  decision: 'favorite',
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: list.updatedAt,
  updatedAt: list.updatedAt,
  logCount: 0,
  lastLoggedOn: null,
};
export type State = {
  failInboxCreateReply: boolean;
  failInboxFileReply: boolean;
  inbox: InboxEntry[];
  trashedInbox: InboxEntry[];
  templates: CollectionTemplate[];
  workspace: WorkspaceResponse;
  signedIn: boolean;
  authDown: boolean;
  failShares: boolean;
  failShow: boolean;
  failCapture: boolean;
  failAction: boolean;
  extraLists: ListDetail[];
  trash: TrashEntry[];
  items: Item[];
  logs: Log[];
  list: ListDetail;
  writes: { path: string; body: unknown }[];
};
export async function mockArchive(page: Page): Promise<State> {
  const state: State = {
    failInboxCreateReply: false,
    failInboxFileReply: false,
    inbox: [],
    trashedInbox: [],
    templates: [],
    workspace: { workspace: { rankings: [], views: [] }, revision: 0 },
    signedIn: true,
    authDown: false,
    failShares: false,
    failShow: false,
    failCapture: false,
    failAction: false,
    extraLists: [],
    trash: [],
    logs: [],
    items: [structuredClone(item), { ...item, id: 'tea', title: 'Tea', decision: null, note: '' }],
    list: structuredClone(list),
    writes: [],
  };
  const inboxReceipts = new Map<string, unknown>();
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api', '');
    const method = request.method();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === '/inbox') {
      if (method === 'GET') return reply({ entries: state.inbox });
      const body = request.postDataJSON(),
        key = request.headers()['idempotency-key'];
      state.writes.push({ path, body: { ...body, key } });
      if (inboxReceipts.has(key)) return reply(inboxReceipts.get(key), 201);
      const entry = {
        ...itemInput.parse(body.item),
        id: crypto.randomUUID(),
        revision: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.inbox.unshift(entry);
      inboxReceipts.set(key, { entry });
      if (state.failInboxCreateReply) {
        state.failInboxCreateReply = false;
        return route.abort('failed');
      }
      return reply({ entry }, 201);
    }
    if (path.startsWith('/inbox/')) {
      const id = path.split('/')[2],
        entry = state.inbox.find((find) => find.id === id);
      if (path.endsWith('/file')) {
        const body = request.postDataJSON(),
          key = request.headers()['idempotency-key'];
        state.writes.push({ path, body: { ...body, key } });
        if (inboxReceipts.has(key)) return reply(inboxReceipts.get(key), 201);
        if (!entry || entry.revision !== body.expectedRevision)
          return reply({ message: 'This Inbox find changed elsewhere. Reload before filing.' }, 409);
        const filed = {
          ...itemInput.parse(entry),
          id: crypto.randomUUID(),
          listId: body.targetListId,
          hasPhoto: false,
          logCount: 0,
          lastLoggedOn: null,
          createdAt: entry.createdAt,
          updatedAt: Date.now(),
        };
        state.items.push(filed);
        state.inbox = state.inbox.filter((find) => find.id !== id);
        inboxReceipts.set(key, { item: filed });
        if (state.failInboxFileReply) {
          state.failInboxFileReply = false;
          return route.abort('failed');
        }
        return reply({ item: filed }, 201);
      }
      if (!entry) return reply({ message: 'This find was filed or moved to Trash.' }, 404);
      if (method === 'PUT') {
        const body = request.postDataJSON();
        state.writes.push({ path, body });
        if (entry.revision !== body.expectedRevision)
          return reply(
            { message: 'This Inbox find changed elsewhere. Your draft is still here. Reload before saving.' },
            409,
          );
        Object.assign(entry, itemInput.parse(body.item), {
          revision: entry.revision + 1,
          updatedAt: Date.now(),
        });
      }
      if (method === 'DELETE') {
        state.writes.push({ path, body: null });
        state.trashedInbox.push(entry);
        state.inbox = state.inbox.filter((find) => find.id !== id);
        state.trash.push({
          id,
          kind: 'inbox',
          title: entry.title,
          listId: '',
          listName: 'Inbox',
          trashedAt: Date.now(),
          expiresAt: Date.now() + 30 * 86400000,
        });
        return route.fulfill({ status: 204 });
      }
      return reply({ entry });
    }
    if (path === `/lists/${list.id}/workspace`) {
      if (method === 'PUT') {
        const body = request.postDataJSON();
        state.writes.push({ path, body });
        if (body.expectedRevision !== state.workspace.revision)
          return reply({ message: 'Saved tools changed elsewhere.' }, 409);
        state.workspace = { workspace: body.workspace, revision: state.workspace.revision + 1 };
      }
      return reply(state.workspace);
    }
    if (path === '/templates') {
      if (method === 'POST') {
        const template = request.postDataJSON();
        state.writes.push({ path, body: template });
        if (!state.templates.some((entry) => entry.id === template.id)) state.templates.push(template);
        return reply({ template }, 201);
      }
      return reply({ templates: state.templates });
    }
    if (path.startsWith('/templates/') && method === 'DELETE') {
      const id = path.split('/').pop();
      state.templates = state.templates.filter((entry) => entry.id !== id);
      return route.fulfill({ status: 204 });
    }
    if (path === '/me')
      return reply(
        state.authDown
          ? { message: 'Accounts unavailable' }
          : {
              user: state.signedIn
                ? { id: 'browser-preview', email: 'preview@example.test', displayName: 'Preview' }
                : null,
            },
        state.authDown ? 503 : 200,
      );
    if (path === '/lists/activity')
      return reply({
        list: {
          ...state.list,
          id: 'activity',
          name: 'Gym',
          kind: 'activity',
          itemCount: 0,
          rankedCount: 0,
          favoriteCount: 0,
          rankedIds: [],
        },
      });
    if (path === '/lists/activity/logs') return reply({ logs: [] });
    if (path === '/lists/activity/workouts') return reply({ workouts: [] });
    if (path === '/lists/activity/routines') return reply({ routines: [] });
    if (path === '/trash') return reply({ entries: state.trash });
    if (path === '/trash/restore') {
      const body = request.postDataJSON() as { entries: { kind: string; id: string }[] };
      for (const ref of body.entries)
        if (ref.kind === 'inbox') {
          const entry = state.trashedInbox.find((find) => find.id === ref.id);
          if (entry) state.inbox.unshift(entry);
          state.trashedInbox = state.trashedInbox.filter((find) => find.id !== ref.id);
        }
      state.trash = state.trash.filter((entry) => !body.entries.some((ref) => ref.id === entry.id));
      return reply({ restored: body.entries.length });
    }
    if (path === `/lists/${list.id}/actions`) {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      if (state.failAction) return reply({ message: 'Could not save this selection. Try again.' }, 503);
      for (const entry of state.items.filter((i) => body.itemIds.includes(i.id))) {
        if (body.action === 'want') entry.wantToTry = body.value;
        if (body.action === 'queue') entry.revisitQueued = body.value;
        if (body.action === 'type') entry.type = body.value;
        if (body.action === 'move') entry.listId = body.destinationId;
        if (body.action === 'merge' && entry.id !== body.targetId) entry.mergedIntoId = body.targetId;
        if (body.action === 'trash')
          state.trash.push({
            id: entry.id,
            kind: 'item',
            title: entry.title,
            listId: list.id,
            listName: list.name,
            trashedAt: Date.now(),
            expiresAt: Date.now() + 30 * 86400000,
          });
      }
      if (['move', 'merge', 'trash'].includes(body.action)) {
        state.list.rankedIds = state.list.rankedIds.filter(
          (id) => !body.itemIds.includes(id) || (body.action === 'merge' && id === body.targetId),
        );
        state.list.rankRevision++;
      }
      for (const entry of state.items)
        entry.mergedIds = state.items.filter((i) => i.mergedIntoId === entry.id).map((i) => i.id);
      return reply({ count: body.itemIds.length, action: body.action });
    }
    if (/^\/items\/[^/]+\/merged$/.test(path))
      return reply({ items: state.items.filter((i) => i.mergedIntoId === path.split('/')[2]) });
    if (path.includes('/separate/')) {
      const entry = state.items.find((i) => i.id === path.split('/')[4])!;
      entry.mergedIntoId = null;
      for (const main of state.items)
        main.mergedIds = state.items.filter((i) => i.mergedIntoId === main.id).map((i) => i.id);
      return reply({ item: entry });
    }
    const extraList = state.extraLists.find(
      (l) => path === `/lists/${l.id}` || path.startsWith(`/lists/${l.id}/`),
    );
    if (extraList) {
      if (path.endsWith('/items'))
        return reply({ items: state.items.filter((i) => i.listId === extraList.id && !i.mergedIntoId) });
      if (path.endsWith('/logs')) return reply({ logs: [] });
      return reply({ list: extraList });
    }
    if (path === '/search') return reply({ results: [] });
    if (path === '/lists' && method === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      state.list = {
        ...state.list,
        ...body,
        rankedIds: [],
        itemCount: 0,
        rankedCount: 0,
        favoriteCount: 0,
        logCount: 0,
      };
      state.items = [];
      state.logs = [];
      state.workspace = {
        workspace: { rankings: [], views: [], detailFields: body.detailFields ?? [] },
        revision: 0,
      };
      return reply({ list: state.list }, 201);
    }
    if (path === '/lists') {
      const archived = new URL(request.url()).searchParams.get('archived') === '1';
      return reply({
        lists: [state.list, ...state.extraLists].filter((l) => Boolean(l.archived) === archived),
      });
    }
    if (path === `/lists/${list.id}` && method === 'PATCH') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      Object.assign(state.list, body);
      return reply({ list: state.list });
    }
    if (path === `/lists/${list.id}`)
      return state.failShow
        ? reply({ error: 'UNAVAILABLE', message: 'Temporarily unavailable' }, 503)
        : reply({ list: state.list });
    if (path === `/lists/${list.id}/items` && method === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      if (state.failCapture) return reply({ message: 'Couldn’t save this item. Try again.' }, 503);
      const created: Item = { ...item, ...body, id: 'captured', note: '', decision: null };
      state.items.push(created);
      state.list.itemCount++;
      return reply({ item: created }, 201);
    }
    if (path === `/lists/${list.id}/items`)
      return reply({
        items: state.items.filter(
          (i) =>
            i.listId === list.id &&
            !i.mergedIntoId &&
            !state.trash.some((entry) => entry.kind === 'item' && entry.id === i.id),
        ),
      });
    if (path === `/lists/${list.id}/logs` && method === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      const created = {
        ...body,
        id: crypto.randomUUID(),
        listId: list.id,
        revision: 0,
        hasPhoto: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Log;
      state.logs.push(created);
      return reply({ log: created }, 201);
    }
    if (path === `/lists/${list.id}/logs`) return reply({ logs: state.logs });
    if (path.startsWith('/logs/') && method === 'PATCH') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      const entry = state.logs.find((log) => log.id === path.split('/')[2])!;
      if (body.expectedRevision !== undefined && body.expectedRevision !== (entry.revision ?? 0))
        return reply(
          {
            error: 'LOG_CHANGED',
            message: 'This visit changed elsewhere. Reload the saved visit before trying again.',
          },
          409,
        );
      Object.assign(entry, body, { revision: (entry.revision ?? 0) + 1 });
      return reply({ log: entry });
    }
    if (path.startsWith('/items/') && method === 'PATCH') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      const entry = state.items.find((i) => i.id === path.split('/')[2])!;
      if (
        body.context &&
        JSON.stringify(body.context) !== JSON.stringify(entry.context ?? emptyItemContext)
      ) {
        if (body.expectedContextRevision !== (entry.contextRevision ?? 0))
          return reply(
            {
              error: 'CONTEXT_CHANGED',
              message: 'The context changed elsewhere. Reload saved context before trying again.',
            },
            409,
          );
        entry.contextRevision = (entry.contextRevision ?? 0) + 1;
      }
      Object.assign(entry, body);
      return reply({ item: entry });
    }
    if (path === `/lists/${list.id}/rank`) {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      if (body.expectedRevision !== state.list.rankRevision)
        return reply(
          { error: 'RANK_CHANGED', message: 'This ranking changed elsewhere. Refresh and try again.' },
          409,
        );
      state.list.rankedIds = body.itemIds;
      state.list.rankRevision++;
      return reply({ list: state.list });
    }
    if (path === `/lists/${list.id}/shares`)
      return state.failShares ? reply({ message: 'Link lookup unavailable' }, 503) : reply({ shares: [] });
    if (path === '/overview')
      return reply({
        lists: state.list.archived ? [] : [state.list],
        recent: [],
        ranked: [],
        favorites: [],
        notAgain: [],
        lastTimes: [],
      });
    if (path === '/memories') return reply({ records: [], total: 0, nextOffset: null });
    if (path === '/preferences') return reply({ groups: [], returns: [], rediscover: [] });
    if (path === '/patterns')
      return reply({
        totalRecords: state.items.length,
        totalCollections: 1,
        totalActivities: 0,
        rankedItemCount: 1,
        revisitCount: 0,
        favoriteCount: 1,
        notAgainCount: 0,
        mehCount: 0,
        mostReturned: null,
        newestCollection: state.list,
        lastTouchedCollection: state.list,
        mostKeptCollection: state.list,
        collectionRecency: [],
        callDistribution: [],
        activityMonths: [],
      });
    if (path === '/export/records')
      return reply({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        photosExcluded: true,
        lists: [],
        items: [],
        logs: [],
        workoutSessions: [],
        workoutRoutines: [],
        photos: [],
      });
    if (path === '/public/review')
      return reply({
        share: {
          title: 'My drinks',
          entries: [{ rank: 1, title: 'Coffee', type: 'Drink' }],
          createdAt: list.updatedAt,
        },
      });
    if (path.startsWith('/public/')) return reply({ error: 'SHARE_EXPIRED', message: 'Expired' }, 410);
    throw new Error(`Unexpected browser API: ${method} ${path}`);
  });
  return state;
}
export const test = base.extend<{ archive: State }>({
  archive: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(await mockArchive(page));
      expect(errors, 'uncaught browser errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
