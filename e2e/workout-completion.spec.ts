import { mkdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list, type State } from './fixtures';
import type { Log, WorkoutSession } from '../src/shared/models';
import { today } from '../src/format';

async function setup(
  page: Page,
  archive: State,
  { incomplete = false, failFinish = false, failRefresh = false } = {},
) {
  archive.list.kind = 'activity';
  archive.list.name = 'Gym';
  archive.items = [];
  const date = today();
  const workout: WorkoutSession = {
    id: 'visit',
    listId: list.id,
    title: 'Push day',
    happenedOn: date,
    status: 'active',
    revision: 0,
    createdAt: 20,
    updatedAt: 20,
  };
  const base: Log = {
    id: 'current',
    listId: list.id,
    itemId: null,
    title: 'Bench press',
    happenedOn: date,
    workoutId: workout.id,
    exercise: true,
    exerciseSets: [
      { weight: 40, reps: incomplete ? null : 10 },
      { weight: null, reps: 8 },
    ],
    weightUnit: 'kg',
    note: '',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
    hasPhoto: false,
    createdAt: 30,
    updatedAt: 30,
  };
  archive.logs = [
    {
      ...base,
      id: 'prior',
      happenedOn: '2025-01-01',
      workoutId: null,
      createdAt: 1,
      exerciseSets: [{ weight: 40, reps: 8 }],
    },
    base,
  ];
  archive.list.logCount = archive.logs.length;
  let refreshFailed = false;
  await page.route('**/api/lists/*/workouts', (route) =>
    refreshFailed
      ? route.fulfill({ status: 503, json: { message: 'Read interrupted' } })
      : route.fulfill({ json: { workouts: [workout] } }),
  );
  await page.route('**/api/lists/*/routines', (route) => route.fulfill({ json: { routines: [] } }));
  let fail = failFinish;
  await page.route('**/api/workouts/*', async (route) => {
    const patch = route.request().postDataJSON();
    archive.writes.push({ path: '/workouts/visit', body: patch });
    if (fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { message: 'Couldn’t confirm the finish. Try again.' } });
    }
    Object.assign(workout, patch, { revision: (workout.revision ?? 0) + 1 });
    refreshFailed = failRefresh;
    return route.fulfill({ json: { workout } });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/lists/' + list.id);
  return workout;
}

async function capture(page: Page, name: string, project: string) {
  const directory = process.env.WORTH_HIGHLIGHTS_QA;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}-${project}.png`, animations: 'disabled' });
}

test('a confirmed finish reveals actual results and progress, and Review clears history filters', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive, { failFinish: true });
  await page.getByText('Search past activity', { exact: true }).click();
  await page.getByLabel('Search activity', { exact: true }).fill('No matching past workout');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t confirm');
  await expect(page.getByRole('region', { name: 'Workout finished.', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Workout finished.', exact: true });
  await expect(summary.getByRole('heading', { name: 'Workout finished.', exact: true })).toBeFocused();
  await expect(summary.locator('.workout-completion-totals dd')).toHaveText(['1', '2', '18']);
  await expect(summary).toContainText('40 kg × 10 reps');
  await expect(summary).toContainText('Previous recorded best at this weight: 8 reps.');
  await summary.scrollIntoViewIfNeeded();
  await capture(page, 'workout-finished', info.project.name);
  await summary.getByRole('button', { name: 'View progress for Bench press', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Bench press', exact: true });
  await expect(history).toBeVisible();
  await history.getByRole('button', { name: 'Close exercise history', exact: true }).click();
  await expect(summary).toBeVisible();
  await summary.getByRole('button', { name: 'Review workout', exact: true }).click();
  await expect(page.getByLabel('Search activity', { exact: true })).toHaveValue('');
  await expect(page.locator('.past-workouts')).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'Push day', exact: true })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    const rows = await summary
      .locator('.workout-completion-totals dd')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
    expect(rows).toHaveLength(3);
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1);
  }
  await summary.getByRole('button', { name: 'Dismiss workout summary', exact: true }).click();
  await expect(summary).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeFocused();
});

test('incomplete reps stay incomplete and a dismissed summary does not change the saved workout', async ({
  page,
  archive,
}, info) => {
  const workout = await setup(page, archive, { incomplete: true });
  await expect(page.locator('.workout-count').first()).toContainText('Rep counts incomplete');
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Workout finished.', exact: true });
  await expect(summary.locator('.workout-completion-totals dd')).toHaveText(['1', '2', '—']);
  await expect(summary).toContainText('Some individual sets or rep counts weren’t recorded.');
  await expect(summary.getByText('From your saved sets', { exact: true })).toHaveCount(0);
  await summary.scrollIntoViewIfNeeded();
  await capture(page, 'workout-incomplete', info.project.name);
  await summary.getByRole('button', { name: 'Dismiss workout summary', exact: true }).click();
  expect(workout.status).toBe('finished');
  expect(archive.logs.find((log) => log.id === 'current')?.exerciseSets?.[0].reps).toBeNull();
  expect(archive.writes).toHaveLength(1);
});

test('a failed refresh retains the confirmed finish and its source history', async ({ page, archive }) => {
  await setup(page, archive, { failRefresh: true });
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Workout finished.', exact: true });
  await expect(summary).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Your saved view is still here.');
  await expect(summary.locator('.workout-completion-totals dd')).toHaveText(['1', '2', '18']);
  await summary.getByRole('button', { name: 'View progress for Bench press', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Bench press', exact: true });
  await expect(history).toBeVisible();
  await history.getByRole('button', { name: 'Close exercise history', exact: true }).click();
  await summary.getByRole('button', { name: 'Dismiss workout summary', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeFocused();
  expect(archive.writes).toHaveLength(1);
});
