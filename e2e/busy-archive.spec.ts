import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { setupLargeArchive } from './large-archive-fixture';
import { activityTools, entryOptions } from './navigation';

// Keep rendering work bounded as one collection and the workout history grow.
test('a busy archive renders current work before older history', async ({ page, archive }, info) => {
  const { gym, workouts } = await setupLargeArchive(page, archive, {
    itemCount: 1000,
    workoutCount: 156,
    oneCollection: true,
  });
  workouts[0].title = 'The first winter workout';
  if (process.env.WORTH_BUSY_QA) await mkdir(process.env.WORTH_BUSY_QA, { recursive: true });
  const observations: Record<string, number> = {};
  const start = performance.now();
  await page.goto(`/lists/${gym.id}`);
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  observations.openWorkoutMs = performance.now() - start;
  observations.closedPastCards = await page.locator('.past-workouts .workout-card').count();
  observations.workoutNodes = await page.locator('*').count();
  expect(observations.closedPastCards).toBe(0);
  if (process.env.WORTH_BUSY_QA)
    await page.screenshot({ path: `${process.env.WORTH_BUSY_QA}/gym-${info.project.name}.png` });
  const past = page.locator('.past-workouts');
  await past.locator('summary').click();
  await expect(past.locator('.workout-card')).toHaveCount(50);
  const firstMore = past.getByRole('button', { name: 'Show more workouts', exact: true });
  await firstMore.click();
  await expect(past.locator('.workout-card')).toHaveCount(100);
  await expect(past.locator('.workout-card h2').nth(50)).toBeFocused();
  await activityTools(page, 'Search past activity');
  await page.getByRole('textbox', { name: 'Search activity', exact: true }).fill('The first winter workout');
  await expect(past.getByRole('heading', { name: 'The first winter workout', exact: true })).toBeVisible();
  await activityTools(page, 'Progress & exercise history');
  await page.locator('.exercise-directory:not(.workout-progress) > summary').click();
  await page.getByRole('button', { name: 'View history for Bench press', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Bench press', exact: true });
  await expect(history).toContainText('156 entries');
  await history.press('Escape');
  await page.goto(`/lists/${archive.list.id}`);
  await expect(page.locator('.collection-index-rows > li').first()).toBeVisible();
  observations.initialCollectionRows = await page.locator('.collection-index-rows > li').count();
  expect(observations.initialCollectionRows).toBe(50);
  if (process.env.WORTH_BUSY_QA)
    await page.screenshot({ path: `${process.env.WORTH_BUSY_QA}/collection-${info.project.name}.png` });
  if (process.env.WORTH_BUSY_QA) {
    await page
      .getByRole('button', { name: 'Show more unranked items', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.WORTH_BUSY_QA}/collection-more-${info.project.name}.png` });
  }
  await page.getByRole('button', { name: 'Show more unranked items', exact: true }).click();
  await expect(page.locator('.collection-index-rows > li')).toHaveCount(100);
  await expect(page.locator('.collection-index-row > button').nth(50)).toBeFocused();
  const search = page.getByRole('textbox', { name: `Search ${archive.list.name}`, exact: true });
  const beforeSearch = performance.now();
  await search.fill('Cafe by the old cinema');
  await expect(page.locator('.collection-index-rows > li')).toHaveCount(1);
  observations.searchMs = performance.now() - beforeSearch;
  if (process.env.WORTH_BUSY_QA) {
    await mkdir(process.env.WORTH_BUSY_QA, { recursive: true });
    await writeFile(
      `${process.env.WORTH_BUSY_QA}/metrics-${info.project.name}.json`,
      JSON.stringify(observations, null, 2),
    );
  }
  await search.fill('');
  await expect(page.locator('.collection-index-rows > li')).toHaveCount(100);
  await page
    .getByRole('group', { name: 'Filter by personal call', exact: true })
    .getByRole('button', { name: /^Favorite/ })
    .click();
  await expect(page.locator('.collection-index-rows > li')).toHaveCount(50);
  await expect(page.locator('.archive-paging')).toContainText('250');
  await entryOptions(page);
  await page.getByRole('button', { name: 'Select items', exact: true }).click();
  await page.getByRole('button', { name: 'Select visible', exact: true }).click();
  await expect(page.locator('.collection-index-rows input[type=checkbox]:checked')).toHaveCount(50);
});

test('a delayed name-only save keeps one retry identity after a lost reply', async ({ page, archive }) => {
  await setupLargeArchive(page, archive, { itemCount: 1000, workoutCount: 156, oneCollection: true });
  archive.failInboxCreateReply = true;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route('**/api/inbox', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submissions++;
    if (submissions === 1) await gate;
    return route.fallback();
  });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Add item', exact: true });
    await dialog.getByLabel('Name', { exact: true }).fill('The tiny midnight bakery');
    await dialog.getByRole('button', { name: /^(Quick save|Save item|Save entry|Save)$/ }).click();
    await expect.poll(() => submissions).toBe(1);
    await expect(dialog.getByLabel('Name', { exact: true })).toBeDisabled();
    await dialog.locator('form').evaluate((node) => {
      const form = node as HTMLFormElement;
      form.requestSubmit();
      form.requestSubmit();
    });
    expect(submissions).toBe(1);
    release();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Add item', exact: true });
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('The tiny midnight bakery');
    await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(archive.inbox.filter((entry) => entry.title === 'The tiny midnight bakery')).toHaveLength(1);
    const writes = archive.writes.filter((write) => write.path === '/inbox');
    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual(writes[1]);
  } finally {
    release();
  }
});
