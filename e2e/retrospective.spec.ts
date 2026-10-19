import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, list, mockArchive } from './fixtures';
import type { Retrospective, RetrospectiveFilter } from '../src/shared/retrospective';

test.use({ timezoneId: 'America/New_York' });
async function capture(page: Page, name: string, project: string, target?: string) {
  if (!process.env.WORTH_RETRO_QA) return;
  await mkdir(process.env.WORTH_RETRO_QA, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.activeElement as HTMLElement | null)?.blur();
  });
  if (target)
    await page
      .locator(target)
      .evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  else await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${process.env.WORTH_RETRO_QA}/${name}-${project}.png` });
}
function period(url: URL): RetrospectiveFilter {
  return {
    from: url.searchParams.get('from')!,
    to: url.searchParams.get('to')!,
    listId: url.searchParams.get('list')!,
    includeArchived: url.searchParams.get('archived') === '1',
    startOffset: Number(url.searchParams.get('startOffset')),
    endOffset: Number(url.searchParams.get('endOffset')),
  };
}
function recap(filter: RetrospectiveFilter): Retrospective {
  return {
    period: filter,
    scopeName: filter.listId ? list.name : 'All lists and Inbox',
    readAt: '2026-11-02T12:00:00Z',
    counts: { kept: 2, revisits: 1, activity: 1 },
    kept: [
      {
        id: 'coffee',
        listId: list.id,
        listName: list.name,
        archived: false,
        kind: 'item',
        title: 'Coffee',
        note: 'PRIVATE kept note',
        createdAt: Date.parse('2026-10-15T12:00:00Z'),
        happenedOn: null,
      },
      {
        id: 'unfiled-test',
        listId: null,
        listName: 'Inbox',
        archived: false,
        kind: 'inbox',
        title: 'An unfiled find',
        note: '',
        createdAt: Date.parse('2026-10-14T12:00:00Z'),
        happenedOn: null,
      },
    ],
    logs: [
      {
        id: 'visit-example',
        listId: list.id,
        listName: list.name,
        archived: false,
        kind: 'visit',
        title: 'Coffee',
        note: 'PRIVATE visit note',
        createdAt: Date.parse('2026-11-02T12:00:00Z'),
        happenedOn: '2026-10-20',
      },
      {
        id: 'activity-example',
        listId: list.id,
        listName: 'Movement',
        archived: false,
        kind: 'activity',
        title: 'A walk',
        note: '',
        createdAt: Date.parse('2026-11-02T12:00:00Z'),
        happenedOn: '2026-10-10',
      },
    ],
  };
}
async function choosePeriod(page: Page, from = '2026-10-01', to = '2026-10-31') {
  await page.getByRole('textbox', { name: 'From', exact: true }).fill(from);
  await page.getByRole('textbox', { name: 'Through', exact: true }).fill(to);
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('a chosen period reads real groups without writes or inferred old calls, and notes require a choice', async ({
  page,
  archive,
}, info) => {
  const requests: RetrospectiveFilter[] = [];
  await page.route('**/api/retrospective?**', (route) => {
    const filter = period(new URL(route.request().url()));
    requests.push(filter);
    return route.fulfill({ json: recap(filter) });
  });
  await page.goto('/patterns');
  await page.getByRole('link', { name: 'Look back over a period →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Look back.', exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  await choosePeriod(page);
  await capture(page, 'period', info.project.name);
  await page.getByRole('button', { name: 'Show this period', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Oct 1, 2026 – Oct 31, 2026', exact: true })).toBeFocused();
  expect(requests).toEqual([
    {
      from: '2026-10-01',
      to: '2026-10-31',
      listId: '',
      includeArchived: false,
      startOffset: 240,
      endOffset: 240,
    },
  ]);
  await expect(page.getByRole('region', { name: 'Period totals', exact: true })).toContainText('Kept2');
  await expect(page.getByText('PRIVATE kept note', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'An unfiled find', exact: false })).toHaveAttribute(
    'href',
    '/inbox?focus=unfiled-test',
  );
  await capture(page, 'results', info.project.name, '.retro-results');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('checkbox', { name: 'Show private notes in this recap', exact: true }).check();
  await expect(page.getByText('PRIVATE visit note', { exact: true })).toBeVisible();
  await capture(page, 'notes', info.project.name, '.retro-groups');
  expect(archive.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Last month', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Oct 1, 2026 – Oct 31, 2026', exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Refresh this period', exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toEqual(requests[0]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Look back.', exact: true })).toBeVisible();
  await expect(page.locator('.retro-results')).toHaveCount(0);
  expect(requests).toHaveLength(2);
});

test('read failures retry, incomplete periods stay editable and empty results do not become achievements', async ({
  page,
  archive,
}, info) => {
  let fail = true,
    requests = 0;
  await page.route('**/api/retrospective?**', (route) => {
    requests++;
    const filter = period(new URL(route.request().url()));
    return fail
      ? route.fulfill({
          status: 503,
          json: { error: 'UNAVAILABLE', message: 'This period is temporarily unavailable.' },
        })
      : route.fulfill({
          json: { ...recap(filter), counts: { kept: 0, revisits: 0, activity: 0 }, kept: [], logs: [] },
        });
  });
  await page.goto('/patterns/look-back');
  await choosePeriod(page, '2026-10-31', '2026-10-01');
  await page.getByRole('button', { name: 'Show this period', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose real start/end dates');
  expect(requests).toBe(0);
  await choosePeriod(page);
  await page.getByRole('button', { name: 'Show this period', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable', { timeout: 12000 });
  fail = false;
  await page.getByRole('button', { name: 'Try this period again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A quiet page.', exact: true })).toBeVisible();
  await capture(page, 'empty', info.project.name, '.retro-results');
  expect(archive.writes).toHaveLength(0);
});

test('scoped and archived periods preserve the last applied read and fit long narrow content', async ({
  page,
  archive,
}, info) => {
  const archivedList = {
    ...list,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'An earlier collection with a very long name '.repeat(2),
    archived: true,
  };
  archive.extraLists.push(archivedList);
  const requests: RetrospectiveFilter[] = [];
  await page.route('**/api/retrospective?**', (route) => {
    const filter = period(new URL(route.request().url()));
    requests.push(filter);
    const value = recap(filter);
    value.counts.kept = 55;
    value.kept = Array.from({ length: 50 }, (_, index) => ({
      ...value.kept[0],
      id: `long-${index}`,
      title: 'A very long remembered find '.repeat(5),
      listName: archivedList.name,
      archived: true,
    }));
    return route.fulfill({ json: value });
  });
  await page.goto('/patterns/look-back');
  await choosePeriod(page);
  await page.getByRole('checkbox', { name: 'Include archived collections', exact: true }).check();
  await page
    .getByRole('combobox', { name: 'List to look back on', exact: true })
    .selectOption(archivedList.id);
  await page.getByRole('button', { name: 'Show this period', exact: true }).click();
  await expect(
    page.getByText('Showing the latest 50 of 55. Narrow the period to see other records.', { exact: true }),
  ).toBeVisible();
  expect(requests[0]).toMatchObject({ listId: archivedList.id, includeArchived: true });
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize(
    info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  );
  await page.getByRole('textbox', { name: 'From', exact: true }).fill('2026-10-03');
  await expect(
    page.getByText('These controls changed. Show this period to update the recap below.', { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  await capture(page, 'long-records', info.project.name, '.retro-groups');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByRole('button', { name: 'Show this period', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Refresh this period', exact: true })).toBeDisabled();
  expect(archive.writes).toHaveLength(0);
});

test('account recovery removes pending retrospective results and keeps controls with their original account', async ({
  page,
  archive,
}) => {
  let reached = false,
    release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/retrospective?**', async (route) => {
    const filter = period(new URL(route.request().url()));
    reached = true;
    await hold;
    try {
      await route.fulfill({ json: recap(filter) });
    } catch {
      /* The original page/read was closed. */
    }
  });
  try {
    await page.goto('/patterns/look-back');
    await choosePeriod(page, '2020-01-01', '2020-01-20');
    await page.getByRole('button', { name: 'Show this period', exact: true }).click();
    await expect.poll(() => reached).toBe(true);
    await page.route('**/api/me', (route) =>
      route.fulfill({
        json: {
          user: { id: 'another-retro-account', email: 'another@example.test', displayName: 'Another' },
        },
      }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event('worth:account-changed')));
    await page.getByRole('button', { name: 'Reload Worth', exact: true }).click();
    release();
    await expect(page.getByRole('textbox', { name: 'From', exact: true })).not.toHaveValue('2020-01-01');
    await expect(page.locator('.retro-results')).toHaveCount(0);
    expect(archive.writes).toHaveLength(0);
  } finally {
    release();
  }
});

test('an applied calendar survives a device-zone change and midnight clock gaps use real boundaries', async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    timezoneId: undefined,
    viewport: info.project.name === 'phone' ? { width: 390, height: 780 } : { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    await mockArchive(page);
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });
    const requests: RetrospectiveFilter[] = [];
    await page.route('**/api/retrospective?**', (route) => {
      const filter = period(new URL(route.request().url()));
      requests.push(filter);
      return route.fulfill({ json: recap(filter) });
    });
    await page.goto('http://127.0.0.1:34320/patterns/look-back');
    await choosePeriod(page);
    await page.getByRole('button', { name: 'Show this period', exact: true }).click();
    const date = page.getByRole('region', { name: 'Newly kept', exact: true }).locator('time').first();
    await expect(date).toHaveText('Oct 15, 2026');
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: '' });
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Pacific/Auckland' });
    await page.getByRole('checkbox', { name: 'Show private notes in this recap', exact: true }).check();
    await expect(date).toHaveText('Oct 15, 2026');
    await expect(page.getByText(/Saved dates in Eastern Time/)).toBeVisible();
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: '' });
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Santiago' });
    await choosePeriod(page, '2026-09-06', '2026-09-06');
    await page.getByRole('button', { name: 'Show this period', exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toMatchObject({
      from: '2026-09-06',
      to: '2026-09-06',
      startOffset: 240,
      endOffset: 180,
    });
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: '' });
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'Pacific/Apia' });
    await choosePeriod(page, '2011-12-30', '2011-12-30');
    await page.getByRole('button', { name: 'Show this period', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Choose real start/end dates');
    expect(requests).toHaveLength(2);
  } finally {
    await context.close();
  }
});

test('blocked device storage does not prevent a private period read', async ({ page, archive }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.route('**/api/retrospective?**', (route) =>
    route.fulfill({ json: recap(period(new URL(route.request().url()))) }),
  );
  await page.goto('/patterns/look-back');
  await choosePeriod(page);
  await page.getByRole('button', { name: 'Show this period', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Newly kept', exact: true })).toContainText(
    'An unfiled find',
  );
  await expect(
    page.getByText('Draft could not be saved on this device. Keep this page open.', { exact: true }),
  ).toBeVisible();
  expect(archive.writes).toHaveLength(0);
});
