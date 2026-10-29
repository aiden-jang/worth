import { activityTools, entryOptions } from './navigation';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list, type State } from './fixtures';
import type { Page } from '@playwright/test';
import { experienceInput } from '../src/shared/memories';
import { today } from '../src/format';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_MEMORY_QA) return;
  await mkdir(process.env.WORTH_MEMORY_QA, { recursive: true });
  await page.screenshot({
    path: `${process.env.WORTH_MEMORY_QA}/${name}-${project}.png`,
    fullPage: (await page.locator('dialog[open]').count()) === 0,
  });
}
async function experienceFixture(page: Page, archive: State, lost = true) {
  const receipts = new Map<string, unknown>();
  await page.route('**/api/lists/*/experiences', async (route) => {
    const req = route.request(),
      body = experienceInput.parse(req.postDataJSON()),
      key = req.headers()['idempotency-key'];
    archive.writes.push({ path: '/experiences', body: { ...body, key } });
    if (!receipts.has(key)) {
      const item = body.itemId
        ? archive.items.find((item) => item.id === body.itemId)!
        : {
            ...archive.items[0],
            id: crypto.randomUUID(),
            title: body.title,
            type: body.type,
            decision: null,
            note: '',
            logCount: 1,
          };
      if (!body.itemId) {
        archive.items.push(item);
        archive.list.itemCount++;
      }
      archive.list.logCount++;
      const log = {
        id: crypto.randomUUID(),
        listId: list.id,
        itemId: item.id,
        title: body.title,
        happenedOn: body.happenedOn,
        note: body.note,
        context: body.context,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        amount: null,
        unit: '',
        sets: null,
        reps: null,
        hasPhoto: false,
      };
      archive.logs.push(log);
      receipts.set(key, { item, log });
    }
    if (lost) {
      lost = false;
      return route.fulfill({
        status: 503,
        json: { message: 'Connection interrupted. Retry the fixed save.' },
      });
    }
    return route.fulfill({ status: 201, json: receipts.get(key) });
  });
}

test('dated experiences recover a fixed save without duplicate records or inferred overall calls', async ({
  page,
  archive,
}, info) => {
  await experienceFixture(page, archive);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('button', { name: 'Add experience', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'What did you try?', exact: true });
  await capture(page, 'experience-quick', info.project.name);
  await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Corner ramen');
  await dialog.locator('.experience-extras > summary').filter({ hasText: 'Date and details' }).click();
  await dialog.getByLabel('When', { exact: true }).fill('2025-10-12');
  await dialog.getByRole('textbox', { name: 'Place or neighborhood' }).fill('Brooklyn');
  await dialog.getByRole('textbox', { name: 'What you ordered or tried' }).fill('Miso ramen');
  await dialog
    .getByRole('group', { name: 'This time', exact: true })
    .getByRole('button', { name: 'Favorite', exact: true })
    .click();
  await capture(page, 'experience', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save experience', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Connection interrupted');
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Favorite', exact: true })).toBeDisabled();
  await page.reload();
  await entryOptions(page);
  await page.getByRole('button', { name: 'Add experience', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'What did you try?', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Corner ramen');
  await dialog.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.items.filter((item) => item.title === 'Corner ramen')).toHaveLength(1);
  expect(archive.logs).toHaveLength(1);
  expect(archive.items.at(-1)?.decision).toBeNull();
  expect(archive.logs[0]).toMatchObject({
    happenedOn: '2025-10-12',
    context: { reaction: 'favorite', location: 'Brooklyn' },
  });
  expect(archive.writes.filter((w) => w.path === '/experiences')[0].body).toEqual(
    archive.writes.filter((w) => w.path === '/experiences')[1].body,
  );
  await expect(page.getByLabel('Entry options', { exact: true })).toBeFocused();
  await page.locator('.collection-index-row button').first().click();
  await capture(page, 'collection-compact', info.project.name);
});

test('an experience needs only a name and reactions can be cleared with one tap', async ({
  page,
  archive,
}, info) => {
  await experienceFixture(page, archive, false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('button', { name: 'Add experience', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'What did you try?', exact: true });
  const name = dialog.getByRole('textbox', { name: 'Name', exact: true });
  await expect(name).toBeFocused();
  await expect(dialog.getByLabel('When', { exact: true })).toBeHidden();
  await expect(dialog.getByRole('combobox', { name: 'Record', exact: true })).toBeHidden();
  await expect(dialog.getByRole('textbox', { name: 'Note', exact: true })).toBeHidden();
  const favorite = dialog
    .getByRole('group', { name: 'This time', exact: true })
    .getByRole('button', { name: 'Favorite', exact: true });
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await favorite.click();
  await expect(favorite).toHaveAttribute('aria-pressed', 'false');
  await name.fill('Corner ramen');
  expect(
    (await dialog.getByRole('button', { name: 'Save experience', exact: true }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await capture(page, 'simple-experience', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await name.press('Enter');
  await expect(dialog).toHaveCount(0);
  expect(archive.logs).toHaveLength(1);
  expect(archive.logs[0]).toMatchObject({
    title: 'Corner ramen',
    happenedOn: today(),
    note: '',
    context: { reaction: null, location: '', order: '' },
  });
  expect(archive.items.at(-1)?.decision).toBeNull();
});

test('a quick visit to a saved name preserves its overall call and protects reaction-only drafts', async ({
  page,
  archive,
}) => {
  const existingId = crypto.randomUUID();
  archive.items[0].id = existingId;
  archive.list.rankedIds = [existingId];
  await experienceFixture(page, archive, false);
  await page.goto(`/lists/${list.id}`);
  await entryOptions(page);
  await page.getByRole('button', { name: 'Add experience', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'What did you try?', exact: true });
  await dialog.getByRole('button', { name: 'Meh', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close experience', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Leave this experience?', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await dialog.getByText('Use a saved name', { exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Record', exact: true }).selectOption(existingId);
  await expect(dialog.getByLabel('When', { exact: true })).toBeHidden();
  await dialog.getByRole('button', { name: 'Save experience', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.items).toHaveLength(2);
  expect(archive.items[0].decision).toBe('favorite');
  expect(archive.logs[0]).toMatchObject({ itemId: existingId, context: { reaction: 'meh' } });
});

test('quick activity logging keeps details optional and previous exercise sets stay an explicit choice', async ({
  page,
  archive,
}, info) => {
  archive.list.kind = 'activity';
  archive.list.name = 'Gym';
  archive.items = [];
  await page.route('**/api/lists/*/routines', (route) => route.fulfill({ json: { routines: [] } }));
  await page.route('**/api/lists/*/workouts', (route) => route.fulfill({ json: { workouts: [] } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await page.getByRole('button', { name: 'Add activity', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'What happened?', exact: true });
  await expect(dialog.getByLabel('What', { exact: true })).toBeFocused();
  await expect(dialog.getByLabel('When', { exact: true })).toBeHidden();
  await expect(dialog.getByRole('textbox', { name: 'Private note optional', exact: true })).toBeHidden();
  await dialog.getByRole('textbox', { name: 'What', exact: true }).fill('Evening walk');
  expect(
    (await dialog.getByRole('button', { name: 'Save log', exact: true }).boundingBox())!.height,
  ).toBeGreaterThanOrEqual(44);
  await capture(page, 'simple-activity', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Save log', exact: true }).click();
  await expect(page.locator('.activity-editor-dialog')).toHaveCount(0);
  expect(archive.logs[0]).toMatchObject({ title: 'Evening walk', happenedOn: today(), note: '' });
  archive.logs.push({
    ...archive.logs[0],
    id: crypto.randomUUID(),
    title: 'Bench press',
    happenedOn: '2026-01-01',
    exercise: true,
    exerciseSets: [{ reps: 8, weight: 40 }],
    weightUnit: 'kg',
  });
  await page.reload();
  await page.getByRole('button', { name: 'Add activity', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'What happened?', exact: true });
  await dialog.getByRole('button', { name: 'Exercise', exact: true }).click();
  await dialog.getByLabel('Exercise', { exact: true }).fill('Bench press');
  await expect(dialog.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Use previous sets', exact: true }).click();
  await expect(dialog.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('8');
  await expect(dialog.getByRole('spinbutton', { name: 'Set 1 weight in kg', exact: true })).toHaveValue('40');
  await capture(page, 'simple-exercise', info.project.name);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await dialog.locator('.activity-context > summary').click();
  await dialog.getByLabel('When', { exact: true }).fill('2026-10-01');
  await dialog.locator('.activity-context > summary').click();
  await expect(dialog.locator('.activity-context > summary')).toContainText('Oct 1, 2026');
  await dialog.getByRole('button', { name: 'Save log', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(archive.logs.at(-1)).toMatchObject({
    title: 'Bench press',
    happenedOn: '2026-10-01',
    exerciseSets: [{ reps: 8, weight: 40 }],
    weightUnit: 'kg',
  });
});

test('preferences link to their full supporting records and memory filters keep explicit dates', async ({
  page,
}, info) => {
  await page.route('**/api/preferences', (route) =>
    route.fulfill({
      json: {
        groups: [
          {
            listId: list.id,
            listName: 'My drinks',
            kind: 'collection',
            basis: 'records',
            name: 'Coffee',
            favorite: 6,
            meh: 1,
            notAgain: 1,
            unrated: 3,
          },
          {
            listId: list.id,
            listName: 'My drinks',
            kind: 'type',
            basis: 'visits',
            name: 'Coffee',
            favorite: 1,
            meh: 1,
            notAgain: 0,
            unrated: 0,
          },
        ],
        returns: [
          {
            itemId: 'coffee',
            listId: list.id,
            title: 'Coffee',
            visits: 4,
            favorites: 2,
            lastDate: '2026-10-12',
          },
        ],
      },
    }),
  );
  await page.route('**/api/memories?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        total: 1,
        nextOffset: null,
        records: [
          {
            id: params.get('mode') === 'saved' ? 'coffee' : 'visit',
            itemId: 'coffee',
            listId: list.id,
            listName: 'My drinks',
            title: 'Coffee',
            note: 'Less ice next time.',
            date: '2025-10-12',
            kind: params.get('mode') === 'saved' ? 'saved' : 'visit',
            location: 'Brooklyn',
            order: 'Oat latte',
            reaction: 'favorite',
            hasPhoto: false,
          },
        ],
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/patterns?view=insights');
  await expect(page.getByText('6 of 8')).toBeVisible();
  await expect(page.getByText(/3 without a call/)).toBeVisible();
  await capture(page, 'preferences', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByRole('link', { name: 'See supporting records →' }).nth(1)).toHaveAttribute(
    'href',
    /mode=visits/,
  );
  await page.getByRole('link', { name: 'See supporting records →' }).first().click();
  await expect(page).toHaveURL(/mode=saved/);
  await expect(page.getByText(/when you first saved each name/)).toBeVisible();
  await page.getByRole('button', { name: 'Experiences', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Experiences', exact: true })).toHaveCSS(
    'color',
    'rgb(24, 25, 21)',
  );
  await page.getByRole('searchbox').fill('Brooklyn');
  if (!(await page.locator('.memory-date-options').evaluate((node) => (node as HTMLDetailsElement).open)))
    await page.locator('.memory-date-options > summary').click();
  await page.getByLabel('From', { exact: true }).fill('2025-10-01');
  await page.getByLabel('Through', { exact: true }).fill('2025-10-31');
  await expect(page).toHaveURL(/q=Brooklyn/);
  await expect(page.locator('.memory-timeline')).toContainText('Oat latte');
  await expect(page.locator('.memory-timeline time')).toHaveAttribute('datetime', '2025-10-12');
  await capture(page, 'remember', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel('Through', { exact: true }).fill('2024-10-31');
  await expect(page.getByRole('alert')).toContainText('Choose real dates');
  await expect(page.locator('.memory-timeline > li')).toHaveCount(0);
});

test('workout history recognizes rep progress and complete volume while keeping units separate', async ({
  page,
  archive,
}, info) => {
  await page.route('**/api/lists/*/routines', (route) => route.fulfill({ json: { routines: [] } }));
  archive.list.kind = 'activity';
  archive.list.name = 'Gym';
  archive.items = [];
  archive.list.logCount = 2;
  archive.logs = [8, 10].map((reps, index) => ({
    id: `entry-${index}`,
    listId: list.id,
    itemId: null,
    title: 'Bench press',
    exercise: true,
    happenedOn: today(),
    note: '',
    exerciseSets: [{ reps, weight: 40 }],
    weightUnit: 'kg' as const,
    createdAt: index + 1,
    updatedAt: index + 1,
    amount: null,
    unit: '',
    sets: null,
    reps: null,
    hasPhoto: false,
  }));
  await page.route('**/api/lists/*/workouts', (route) =>
    route.fulfill({
      json: {
        workouts: [
          {
            id: 'done',
            listId: list.id,
            title: 'Push day',
            happenedOn: today(),
            createdAt: 1,
            updatedAt: 1,
            status: 'finished',
          },
          {
            id: 'active',
            listId: list.id,
            title: 'Active',
            happenedOn: today(),
            createdAt: 2,
            updatedAt: 2,
            status: 'active',
          },
        ],
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${list.id}`);
  await activityTools(page, 'Progress & exercise history');
  await page.locator('.workout-progress summary').click();
  await expect(page.locator('.workout-progress')).toContainText('1 finished workout');
  await activityTools(page, 'Progress & exercise history');
  await page.locator('.exercise-directory:not(.workout-progress) > summary').click();
  await page.getByRole('button', { name: 'View history for Bench press', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Bench press', exact: true });
  await expect(history).toContainText('Previous best at this weight in this period: 8 reps.');
  await history.getByRole('button', { name: 'Volume · kg', exact: true }).click();
  await expect(history.locator('.exercise-chart-point')).toHaveCount(2);
  await expect(history.locator('.exercise-chart-point').last()).toHaveAttribute(
    'aria-label',
    /400 kg × reps/,
  );
  await history.getByText('Best recorded sets by rep count', { exact: true }).click();
  await expect(history.locator('.exercise-records')).toContainText('10 reps · 40 kg');
  await history.locator('.editor-head').scrollIntoViewIfNeeded();
  await capture(page, 'workout-history', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('the memory experience reflows at narrow phone and tablet widths', async ({ page }, info) => {
  await page.goto('/patterns/remember');
  for (const width of [320, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Memories.', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await capture(page, `remember-${width}`, info.project.name);
  }
});

test('the monthly keepsake uses dated entries and a recorded reaction', async ({ page }, info) => {
  await page.route('**/api/memories?*', (route) =>
    route.fulfill({
      json: {
        total: 3,
        nextOffset: null,
        records: [
          {
            id: 'visit',
            itemId: 'coffee',
            listId: list.id,
            listName: 'My drinks',
            title: 'Morning coffee',
            note: '',
            date: today(),
            kind: 'visit',
            location: '',
            order: '',
            reaction: 'favorite',
            hasPhoto: false,
          },
        ],
      },
    }),
  );
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Memory shelf' });
  await expect(card).toContainText('3 dated entries this month.');
  await expect(card.getByRole('heading', { name: 'Morning coffee', exact: true })).toBeVisible();
  await capture(page, 'monthly-memory', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await card.getByRole('link', { name: 'Open this month →' }).click();
  await expect(page).toHaveURL(/\/patterns\/remember\?from=/);
});
