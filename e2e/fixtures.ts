import { test as base, expect, type Page } from '@playwright/test';
import type { Item, ListDetail, TrashEntry } from '../src/shared/models';

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
  signedIn: boolean;
  authDown: boolean;
  failShares: boolean;
  failShow: boolean;
  failCapture: boolean;
  failAction: boolean;
  extraLists: ListDetail[];
  trash: TrashEntry[];
  items: Item[];
  list: ListDetail;
  writes: { path: string; body: unknown }[];
};
export async function mockArchive(page: Page): Promise<State> {
  const state: State = {
    signedIn: true,
    authDown: false,
    failShares: false,
    failShow: false,
    failCapture: false,
    failAction: false,
    extraLists: [],
    trash: [],
    items: [structuredClone(item), { ...item, id: 'tea', title: 'Tea', decision: null, note: '' }],
    list: structuredClone(list),
    writes: [],
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api', '');
    const method = request.method();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
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
    if (path === '/lists') return reply({ lists: [state.list, ...state.extraLists] });
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
    if (path === `/lists/${list.id}/logs`) return reply({ logs: [] });
    if (path.startsWith('/items/') && method === 'PATCH') {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      const entry = state.items.find((i) => i.id === path.split('/')[2])!;
      Object.assign(entry, body);
      return reply({ item: entry });
    }
    if (path === `/lists/${list.id}/rank`) {
      const body = request.postDataJSON();
      state.writes.push({ path, body });
      state.list.rankedIds = body.itemIds;
      state.list.rankRevision++;
      return reply({ list: state.list });
    }
    if (path === `/lists/${list.id}/shares`)
      return state.failShares ? reply({ message: 'Link lookup unavailable' }, 503) : reply({ shares: [] });
    if (path === '/overview')
      return reply({
        lists: [state.list],
        recent: [],
        ranked: [],
        favorites: [],
        notAgain: [],
        lastTimes: [],
      });
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
