import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, type State } from './fixtures';
import type { ActivityCalendar, CalendarEntry } from '../src/shared/activity-calendar';
import { emptyItemContext } from '../src/shared/item-context';
const day = '2026-11-03';
async function setup(page: Page, state: State) {
  let fail = false;
  const entries: CalendarEntry[] = [
    {
      id: state.items[0].id,
      kind: 'revisit',
      day,
      originalDay: '2026-10-17',
      title: 'Coffee',
      listId: list.id,
      listName: list.name,
      archived: false,
    },
    {
      id: 'logged',
      kind: 'visit',
      day,
      originalDay: null,
      title: 'An actual visit',
      listId: list.id,
      listName: list.name,
      archived: false,
    },
  ];
  await page.route('**/api/calendar?*', (route) => {
    expect(route.request().method()).toBe('GET');
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('archived')).toMatch(/^[01]$/);
    const month = params.get('month')!,
      selected = params.get('day')!;
    if (fail)
      return route.fulfill({
        status: 503,
        json: { message: 'Calendar unavailable. Your plans are unchanged.' },
      });
    const result: ActivityCalendar = {
      filter: { month, day: selected, includeArchived: params.get('archived') === '1' },
      days:
        month === '2026-11'
          ? [
              {
                day,
                planned: entries.filter((e) => e.kind === 'revisit').length,
                visits: entries.filter((e) => e.kind === 'visit').length,
                activities: entries.filter((e) => e.kind === 'activity').length,
              },
            ]
          : [],
      entries: selected === day ? (params.has('after') ? entries.slice(50) : entries.slice(0, 50)) : [],
      next:
        selected === day && !params.has('after') && entries.length > 50
          ? 'revisit:11111111-1111-4111-8111-111111111111'
          : null,
    };
    return route.fulfill({ json: result });
  });
  return {
    entries,
    fail(value: boolean) {
      fail = value;
    },
  };
}
async function show(page: Page) {
  await page.getByLabel('Month', { exact: true }).fill('2026-11');
  await page.getByRole('button', { name: 'Show calendar', exact: true }).click();
  await page.getByRole('button', { name: /^2026-11-03:/ }).click();
}
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_CALENDAR_QA) return;
  await mkdir(process.env.WORTH_CALENDAR_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.screenshot({ path: `${process.env.WORTH_CALENDAR_QA}/${name}-${project}.png` });
}

test('calendar distinguishes plans from logs and keeps month choices deliberate', async ({
  page,
  archive,
}, info) => {
  await setup(page, archive);
  await page.goto('/patterns');
  await page.locator('.recall-more > summary').click();
  await page.getByRole('link', { name: 'Activity calendar →', exact: true }).click();
  await show(page);
  await expect(page.getByRole('region', { name: 'Selected day', exact: true })).toContainText(
    'Planned revisit',
  );
  await expect(page.getByRole('region', { name: 'Selected day', exact: true })).toContainText('Logged visit');
  await expect(page.getByRole('region', { name: 'Selected day', exact: true })).toContainText(
    'Originally 2026-10-17; snoozed to 2026-11-03.',
  );
  await expect(page.getByRole('heading', { name: day, exact: true })).toBeFocused();
  await page.evaluate(() => scrollTo(0, 0));
  await capture(page, 'month', info.project.name);
  await page
    .getByRole('region', { name: 'Month calendar', exact: true })
    .evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await capture(page, 'days', info.project.name);
  await page.getByRole('region', { name: 'Selected day', exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'agenda', info.project.name);
  await page.getByRole('link', { name: 'Choose another day', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'November 2026', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your choices changed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'November 2026', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show calendar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'December 2026', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Selected day', exact: true })).toContainText(
    'No saved plans or logs',
  );
  expect(archive.writes).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel('Month', { exact: true })).toHaveValue('2026-12');
  await expect(page.getByRole('region', { name: 'Month calendar', exact: true })).toHaveCount(0);
});

test('revisit dates and snooze save through normal revision-checked context without changing calls or queue', async ({
  page,
  archive,
}, info) => {
  archive.items[0].context = { ...emptyItemContext, revisit: { on: '2026-10-17', snoozedUntil: null } };
  await page.goto(`/lists/${list.id}?focus=item:coffee`);
  const editor = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await editor.locator('summary').filter({ hasText: 'A little more context' }).click();
  await editor.locator('summary').filter({ hasText: 'Plan a revisit' }).click();
  await editor.getByLabel('Snooze until (optional)', { exact: true }).fill(day);
  await editor.getByLabel('Snooze until (optional)', { exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'snooze', info.project.name);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByText('Saved.', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/lists/${list.id}$`));
  expect(archive.items[0].context.revisit).toEqual({ on: '2026-10-17', snoozedUntil: day });
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.items[0].revisitQueued).toBeFalsy();
  await page.goto(`/lists/${list.id}?focus=item:coffee`);
  const again = page.getByRole('dialog', { name: 'Coffee', exact: true });
  await again.locator('summary').filter({ hasText: 'A little more context' }).click();
  await again.locator('summary').filter({ hasText: 'Plan a revisit' }).click();
  await again.getByRole('button', { name: 'Clear snooze', exact: true }).click();
  await expect(again.getByLabel('Revisit on', { exact: true })).toHaveValue('2026-10-17');
  await expect(again.getByLabel('Snooze until (optional)', { exact: true })).toHaveValue('');
});

test('calendar failures, paging, long names and narrow layouts retain a readable accessible alternative', async ({
  page,
  archive,
}, info) => {
  const fixture = await setup(page, archive);
  fixture.entries.push(
    ...Array.from({ length: 53 }, (_, i) => ({
      ...fixture.entries[0],
      id: crypto.randomUUID(),
      title: i === 52 ? 'Last saved plan' : `A long named place ${'farther along the road '.repeat(8)} ${i}`,
    })),
  );
  await page.goto('/patterns/calendar');
  await show(page);
  await expect(page.getByRole('region', { name: 'Selected day', exact: true }).locator('li')).toHaveCount(50);
  await page.getByRole('button', { name: 'Next 50 entries', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected day', exact: true }).locator('li')).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Last saved plan →', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Selected day', exact: true })).toContainText(
    '5 of 55 entries on this page',
  );
  await expect(new AxeBuilder({ page }).analyze()).resolves.toMatchObject({ violations: [] });
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.setViewportSize(
    info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  );
  fixture.fail(true);
  await page.getByRole('button', { name: 'Refresh this day', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Calendar unavailable');
  await expect(
    page.getByRole('region', { name: 'Selected day', exact: true }).getByRole('alert'),
  ).toBeInViewport();
  await capture(page, 'failure', info.project.name);
  fixture.fail(false);
  await page.getByRole('button', { name: 'Try calendar again', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(archive.writes).toHaveLength(0);
});
