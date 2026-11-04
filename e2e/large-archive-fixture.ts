import type { Page } from '@playwright/test';
import type { State } from './fixtures';
import { largeArchive } from '../tests/fixtures/large-archive';
import { archiveFile } from '../src/shared/portability';
import { logInput, workoutPatch } from '../src/shared/validation';
import type { ListDetail, SearchResult } from '../src/shared/models';

export async function setupLargeArchive(
  page: Page,
  archive: State,
  options?: Parameters<typeof largeArchive>[0],
) {
  const file = largeArchive(options);
  const lists: ListDetail[] = file.lists.map((list) => ({
    ...list,
    hasCoverPhoto: false,
    rankRevision: 0,
    itemCount: file.items.filter((item) => item.listId === list.id).length,
    logCount: file.logs.filter((log) => log.listId === list.id).length,
    favoriteCount: file.items.filter((item) => item.listId === list.id && item.decision === 'favorite')
      .length,
    rankedCount: list.rankedIds.length,
  }));
  archive.list = lists[0];
  archive.extraLists = lists.slice(1);
  archive.items = file.items.map((item) => ({ ...item, hasPhoto: false, logCount: 1, lastLoggedOn: null }));
  archive.logs = file.logs.map((log) => ({ ...log, hasPhoto: false, revision: 0 }));
  archive.inbox = file.inbox;
  const gym = lists.find((list) => list.kind === 'activity')!;
  const workouts = file.workoutSessions.map((workout) => ({ ...workout, revision: 0 }));
  let failedPageAttempts = 2;
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/api', '');
    if (path === '/overview')
      return route.fulfill({
        json: {
          lists: lists.filter((list) => !list.archived),
          recent: [],
          ranked: [],
          favorites: [],
          notAgain: [],
          lastTimes: [],
        },
      });
    if (path === '/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase(),
        scope = url.searchParams.get('scope') ?? 'all',
        offset = Number(url.searchParams.get('offset') ?? 0);
      if (failedPageAttempts > 0 && offset > 0) {
        failedPageAttempts--;
        return route.fulfill({ status: 503, json: { message: 'Temporary search interruption' } });
      }
      const results: SearchResult[] = [
        ...archive.items
          .map((item) => ({
            ...item,
            listName: lists.find((list) => list.id === item.listId)!.name,
            kind: 'item' as const,
            itemId: null,
            detail: item.note,
          }))
          .reverse(),
        ...archive.logs
          .map((log) => ({
            ...log,
            listName: lists.find((list) => list.id === log.listId)!.name,
            kind: 'log' as const,
            detail: log.happenedOn,
            exercise: Boolean(log.exercise || log.exerciseSets?.length),
          }))
          .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn)),
      ].filter((record) => record.title.toLowerCase().includes(q));
      const groups = ['item', 'log'].map((kind) =>
        results.filter(
          (record) =>
            record.kind === kind &&
            (scope === 'all' ||
              scope === (kind === 'item' ? 'items' : 'logs') ||
              (scope === 'exercises' && record.exercise)),
        ),
      );
      return route.fulfill({
        json: {
          results: groups.flatMap((group) => group.slice(offset, offset + 40)),
          nextOffset: groups.some((group) => group.length > offset + 40) ? offset + 40 : null,
        },
      });
    }
    if (path === `/lists/${gym.id}/workouts`) return route.fulfill({ json: { workouts } });
    if (path === `/lists/${gym.id}/routines`) return route.fulfill({ json: { routines: [] } });
    if (path.startsWith('/workouts/')) {
      const workout = workouts.find((workout) => workout.id === path.split('/')[2])!;
      Object.assign(workout, workoutPatch.parse(request.postDataJSON()));
      workout.revision++;
      return route.fulfill({ json: { workout } });
    }
    if (path.startsWith('/lists/') && path.endsWith('/logs')) {
      const listId = path.split('/')[2];
      if (request.method() === 'GET')
        return route.fulfill({ json: { logs: archive.logs.filter((log) => log.listId === listId) } });
      const log = {
        ...logInput.parse(request.postDataJSON()),
        id: crypto.randomUUID(),
        listId,
        hasPhoto: false,
        revision: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      archive.logs.push(log);
      return route.fulfill({ status: 201, json: { log } });
    }
    if (path === '/export/records') return route.fulfill({ json: file });
    if (path === '/import') {
      const body = archiveFile.parse(request.postDataJSON());
      archive.writes.push({ path, body });
      return route.fulfill({ status: 201, json: { ids: body.lists.map((list) => list.id) } });
    }
    return route.fallback();
  });
  return { file, gym, workouts };
}
