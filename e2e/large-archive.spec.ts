import { mkdir, readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, type State } from './fixtures';
import { activityTools } from './navigation';
import { largeArchive } from '../tests/fixtures/large-archive';
import { archiveFile } from '../src/shared/portability';
import { logInput, workoutPatch } from '../src/shared/validation';
import type { ListDetail, SearchResult } from '../src/shared/models';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_LARGE_QA) return;
  await mkdir(process.env.WORTH_LARGE_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_LARGE_QA}/${name}-${project}.png` });
}

async function setup(page: Page, archive: State) {
  const file = largeArchive();
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

test('a populated archive keeps quick capture and older search results reachable after a failed page', async ({
  page,
  archive,
}, info) => {
  const { file } = await setup(page, archive);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Keep something.', exact: true });
  await add.getByLabel('Name', { exact: true }).fill('The little late-night bakery');
  await add.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Recent', exact: true })).toContainText(
    'The little late-night bakery',
  );
  await page.getByRole('searchbox').fill('Cafe');
  await page.getByRole('searchbox').press('Enter');
  await page.getByRole('button', { name: 'Items', exact: true }).click();
  const count = page.locator('.search-results').getByRole('status');
  await expect(count).toContainText('SHOWING 40 RESULTS');
  await capture(page, 'large-search', info.project.name);
  await page.getByRole('button', { name: 'Show more results', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('More results couldn’t load');
  await expect(page.getByRole('region', { name: 'Items', exact: true }).getByRole('link')).toHaveCount(40);
  await page.getByRole('button', { name: 'Retry more results', exact: true }).click();
  await expect(count).toContainText('SHOWING 80 RESULTS');
  await expect(
    page.getByRole('region', { name: 'Items', exact: true }).getByRole('link').nth(40),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Show more results', exact: true }).click();
  await expect(count).toHaveText('90 RESULTS');
  const original = page
    .getByRole('region', { name: 'Items', exact: true })
    .getByRole('link')
    .filter({ hasText: 'Cafe by the old cinema' });
  await original.click();
  await expect(page).toHaveURL(new RegExp(`focus=item:${file.items[0].id}`));
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'Cafe by the old cinema',
  );
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Items', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('textbox', { name: 'Search all lists', exact: true }).fill('Bench');
  await page.getByRole('button', { name: 'Exercises', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Exercises', exact: true }).getByRole('link')).toHaveCount(
    40,
  );
  await page.getByRole('textbox', { name: 'Search all lists', exact: true }).fill('Bench breathing');
  await expect(page.getByRole('region', { name: 'Exercises', exact: true })).toContainText('Bench breathing');
  const lists = page.getByRole('button', { name: 'Lists', exact: true });
  await lists.focus();
  await lists.press('Enter');
  await expect(page.getByText('No matches with this filter.', { exact: true })).toBeVisible();
  await expect(lists).toBeFocused();
  await page.getByRole('button', { name: 'Search all categories', exact: true }).click();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('months of workouts preserve a resumed draft and keep the original units in progress', async ({
  page,
  archive,
}, info) => {
  const { gym, workouts } = await setup(page, archive);
  const active = workouts.find((workout) => workout.status === 'active')!;
  await page.goto(`/lists/${gym.id}`);
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  let editor = page.getByRole('dialog', { name: 'Log an exercise', exact: true });
  await expect(editor.getByRole('combobox', { name: 'Exercise', exact: true })).toHaveValue('Bench press');
  await expect(editor.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('');
  await editor.getByRole('button', { name: 'Use previous sets', exact: true }).click();
  await expect(editor.getByRole('spinbutton', { name: 'Set 1 weight in kg', exact: true })).toHaveValue(
    '57.5',
  );
  await editor.getByRole('spinbutton', { name: 'Set 1 reps', exact: true }).fill('11');
  await page.reload();
  editor = page.getByRole('dialog', { name: 'Log an exercise', exact: true });
  await expect(editor.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('11');
  await editor.getByLabel('Continue to next exercise after saving').uncheck();
  await editor.getByRole('button', { name: 'Save log', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(archive.logs.filter((log) => log.workoutId === active.id)).toMatchObject([
    { title: 'Bench press', exerciseSets: [{ reps: 11, weight: 57.5 }], weightUnit: 'kg' },
  ]);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toHaveCount(0);
  await activityTools(page, 'Progress & exercise history');
  await page.locator('.exercise-directory:not(.workout-progress) > summary').click();
  await page.getByRole('button', { name: 'View history for Bench press', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Bench press', exact: true });
  await expect(history).toContainText('97 entries');
  await expect(history.getByRole('button', { name: 'Top weight · kg', exact: true })).toBeVisible();
  await expect(history.getByRole('button', { name: 'Top weight · lb', exact: true })).toBeVisible();
  await capture(page, 'large-progress', info.project.name);
  await history.locator('.exercise-chart-point').first().click();
  await expect(history.locator('.exercise-history-entries article:focus')).toHaveCount(1);
  await history.locator('.exercise-chart-point').last().click();
  await expect(history.locator('.exercise-history-entries article:focus')).toContainText('11 reps');
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('a populated archive downloads usable JSON and Excel and requires restore preview', async ({
  page,
  archive,
}, info) => {
  const { file } = await setup(page, archive);
  await page.goto('/settings');
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON (.json)', exact: true }).click();
  const json = await readFile((await (await download).path())!, 'utf8');
  expect(archiveFile.parse(JSON.parse(json))).toEqual(file);
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel (.xlsx)', exact: true }).click();
  const excel = unzipSync(new Uint8Array(await readFile((await (await download).path())!)));
  expect(strFromU8(excel['xl/worksheets/sheet1.xml'])).toContain('Cafe by the old cinema');
  expect(strFromU8(excel['xl/worksheets/sheet1.xml']).match(/<row\b/g)).toHaveLength(361);
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'my-archive.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.locator('.restore-preview')).toContainText('360 items · 694 logs · 97 visits');
  expect(archive.writes.filter((write) => write.path === '/import')).toHaveLength(0);
  await capture(page, 'large-restore-preview', info.project.name);
  await page.getByRole('button', { name: 'Restore previewed data', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('25 lists');
  expect(archive.writes.filter((write) => write.path === '/import')).toHaveLength(1);
});
