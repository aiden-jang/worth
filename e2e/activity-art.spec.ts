import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { WorkoutSession } from '../src/shared/models';
import { test, expect } from './fixtures';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_ACTIVITY_ART_QA) return;
  await mkdir(process.env.WORTH_ACTIVITY_ART_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_ACTIVITY_ART_QA}/${name}-${project}.png` });
}

test('neutral activity artwork keeps first-log and workout actions usable without inventing opinions', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let workouts: WorkoutSession[] = [];
  await page.route('**/api/lists/activity/workouts', (route) => route.fulfill({ json: { workouts } }));
  await page.goto('/lists/activity');
  const empty = page.locator('.activity-view .cabinet-quiet-state');
  await expect(empty.getByRole('heading', { name: 'Nothing here yet.', exact: true })).toBeVisible();
  await empty.scrollIntoViewIfNeeded();
  await capture(page, 'empty-log', info.project.name);
  await empty.getByRole('button', { name: 'Add first log', exact: true }).click();
  const log = page.getByRole('dialog', { name: 'What happened?', exact: true });
  await expect(log).toBeVisible();
  await log.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(log).toBeHidden();
  await expect(page).toHaveURL(/\/lists\/activity$/);
  workouts = [
    {
      id: '77777777-7777-4777-8777-777777777777',
      listId: 'activity',
      title: 'An unhurried workout',
      happenedOn: '2026-10-16',
      createdAt: 1,
      updatedAt: 1,
      status: 'active',
      plannedExercises: [],
      skippedExercises: [],
    },
  ];
  await page.reload();
  const workout = page.locator('.workout-card');
  await expect(workout).toContainText('0 exercises logged · 0 sets · 0 reps');
  await expect(workout).toContainText('Add the first exercise to this visit.');
  await workout.scrollIntoViewIfNeeded();
  await capture(page, 'empty-workout', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await expect(page.locator('.activity-view .call-face')).toHaveCount(0);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(
    info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  );
  await workout.getByRole('button', { name: 'Add exercise to An unhurried workout', exact: true }).click();
  const exercise = page.getByRole('dialog', { name: 'Log an exercise', exact: true });
  await expect(exercise.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('');
  await exercise.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(exercise).toBeHidden();
  await expect(page).toHaveURL(/\/lists\/activity$/);
  if (info.project.name === 'phone')
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Inbox', exact: true }).click();
  const inbox = page.getByRole('dialog', { name: 'Inbox.', exact: true });
  await inbox.evaluate((node) => {
    node.tabIndex = -1;
    node.focus();
  });
  await expect(inbox).toBeFocused();
  await page.keyboard.press('a');
  await expect(inbox).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  expect(archive.writes).toHaveLength(0);
});
