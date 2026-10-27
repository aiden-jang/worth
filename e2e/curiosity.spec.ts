import { mkdir, readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import { archiveFile } from '../src/shared/portability';
import { today } from '../src/format';
import type { Page } from '@playwright/test';

async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_FUN_QA) return;
  await mkdir(process.env.WORTH_FUN_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_FUN_QA}/${name}-${project}.png`, fullPage: true });
}

test('a memory draw reaches beyond the first page, avoids an immediate repeat and preserves keyboard focus', async ({
  page,
  archive,
}, info) => {
  const sources = Array.from({ length: 51 }, (_, i) => ({
    id: `entry-${i}`,
    itemId: null,
    listId: list.id,
    listName: 'Little outings',
    title: i === 50 ? 'The little bookshop' : `An afternoon ${i + 1}`,
    date: i === 50 ? '2025-04-12' : today(),
    kind: 'activity',
    note: i === 50 ? 'Found the essay collection I was looking for.' : 'Coffee, then a wander.',
    location: i === 50 ? 'West Village' : '',
    order: '',
    reaction: null,
    hasPhoto: false,
  }));
  const reads: URL[] = [];
  await page.route('**/api/memories?*', (route) => {
    const url = new URL(route.request().url());
    reads.push(url);
    const offset = Number(url.searchParams.get('offset'));
    if (url.searchParams.get('mode') === 'saved')
      return route.fulfill({ json: { total: 0, records: [], nextOffset: null } });
    if (url.searchParams.get('from'))
      return route.fulfill({ json: { total: 1, records: [sources[0]], nextOffset: null } });
    return route.fulfill({
      json: {
        total: sources.length,
        records: sources.slice(offset, offset + 50),
        nextOffset: offset + 50 < sources.length ? offset + 50 : null,
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const shelf = page.getByRole('region', { name: 'Memory shelf', exact: true });
  await expect(shelf.getByRole('heading', { name: 'An afternoon 1', exact: true })).toBeVisible();
  await page.evaluate(() => {
    Math.random = () => 0.999;
  });
  const button = shelf.getByRole('button', { name: 'Pull a memory', exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(shelf.getByRole('heading', { name: 'The little bookshop', exact: true })).toBeVisible();
  const another = shelf.getByRole('button', { name: 'Another memory', exact: true });
  await expect(another).toBeFocused();
  await expect(shelf).toContainText('West Village');
  await expect(shelf).toContainText('Found the essay collection');
  await expect(shelf.getByRole('link', { name: 'Open memory →', exact: true })).toHaveAttribute(
    'href',
    `/lists/${list.id}?focus=log:entry-50`,
  );
  expect(reads.some((url) => url.searchParams.get('offset') === '50')).toBe(true);
  await capture(page, 'memory-draw', info.project.name);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await another.press('Enter');
  await expect(shelf.getByRole('heading', { name: 'An afternoon 1', exact: true })).toBeVisible();
  expect(archive.writes).toHaveLength(0);
  for (const width of [320, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('saved names can be rediscovered without inventing a visit, and empty or failed draws are usable', async ({
  page,
  archive,
}) => {
  let outcome = 'saved';
  await page.route('**/api/memories?*', (route) => {
    const url = new URL(route.request().url());
    if (outcome === 'failure' && !url.searchParams.get('from'))
      return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
    const saved = outcome === 'saved' && url.searchParams.get('mode') === 'saved';
    return route.fulfill({
      json: {
        total: saved ? 1 : 0,
        nextOffset: null,
        records: saved
          ? [
              {
                id: 'coffee',
                itemId: 'coffee',
                listId: list.id,
                listName: 'My drinks',
                title: 'Coffee',
                note: '',
                date: '2025-01-12',
                kind: 'saved',
                location: '',
                order: '',
                reaction: null,
                hasPhoto: false,
              },
            ]
          : [],
      },
    });
  });
  await page.goto('/');
  const shelf = page.getByRole('region', { name: 'Memory shelf', exact: true });
  await shelf.getByRole('button', { name: 'Pull a memory', exact: true }).click();
  await expect(shelf).toContainText('Saved Jan 12, 2025 (UTC)');
  await expect(shelf.locator('.call-face')).toHaveCount(0);
  await expect(shelf.getByRole('link', { name: 'Open memory →', exact: true })).toHaveAttribute(
    'href',
    `/lists/${list.id}?focus=item:coffee`,
  );
  outcome = 'failure';
  await shelf.getByRole('button', { name: 'Another memory', exact: true }).click();
  await expect(shelf.getByRole('alert')).toContainText('Memories couldn’t load');
  outcome = 'empty';
  await shelf.getByRole('button', { name: /memory/ }).click();
  await expect(shelf.getByRole('heading', { name: 'A little empty in here.', exact: true })).toBeVisible();
  expect(archive.writes).toHaveLength(0);
});

test('Excel downloads preserve names, dates, zero and bodyweight in a native workbook', async ({
  page,
}, info) => {
  const gym = '22222222-2222-4222-8222-222222222222',
    item = crypto.randomUUID(),
    visit = crypto.randomUUID(),
    exercise = crypto.randomUUID(),
    workout = crypto.randomUUID();
  const file = archiveFile.parse({
    schemaVersion: 10,
    exportedAt: '2026-10-27T12:30:00.000Z',
    photosExcluded: true,
    lists: [
      {
        id: list.id,
        name: 'Things I tried',
        description: '',
        kind: 'collection',
        rankedIds: [item],
        updatedAt: 1,
      },
      { id: gym, name: 'Gym', description: '', kind: 'activity', rankedIds: [], updatedAt: 1 },
    ],
    items: [
      {
        id: item,
        listId: list.id,
        title: '=A name, not a formula',
        type: '',
        decision: 'favorite',
        note: 'Small place. Very good noodles.',
        context: { location: 'Brooklyn' },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    logs: [
      {
        id: visit,
        listId: list.id,
        itemId: item,
        title: '',
        unit: '',
        happenedOn: '2026-10-01',
        context: { reaction: 'meh', order: 'Miso ramen' },
        note: 'Try the other broth next time.',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: exercise,
        listId: gym,
        workoutId: workout,
        title: 'Bench press',
        note: '',
        unit: '',
        exercise: true,
        happenedOn: '2026-10-02',
        exerciseSets: [
          { reps: 8, weight: 0 },
          { reps: 6, weight: null },
        ],
        measurements: [{ name: 'Rest', value: 0, unit: 'seconds' }],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    workoutSessions: [
      {
        id: workout,
        listId: gym,
        title: 'Push day',
        happenedOn: '2026-10-02',
        status: 'finished',
        plannedExercises: ['Bench press'],
        skippedExercises: [],
        targets: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    workoutRoutines: [
      {
        id: crypto.randomUUID(),
        listId: gym,
        title: 'Push',
        exercises: ['Bench press'],
        targets: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    inbox: [{ id: crypto.randomUUID(), revision: 0, title: 'A little café', createdAt: 1, updatedAt: 1 }],
  });
  await page.route('**/api/export/records', (route) => route.fulfill({ json: file }));
  await page.goto('/settings');
  await page.getByRole('heading', { name: 'Take a copy.', exact: true }).scrollIntoViewIfNeeded();
  await capture(page, 'export-options', info.project.name);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel (.xlsx)', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^worth-records-.*\.xlsx$/);
  const path = await download.path();
  const parts = unzipSync(new Uint8Array(await readFile(path!)));
  expect(strFromU8(parts['xl/workbook.xml'])).toContain('Exercise sets');
  expect(strFromU8(parts['xl/worksheets/sheet1.xml'])).toContain('=A name, not a formula');
  expect(strFromU8(parts['xl/worksheets/sheet1.xml'])).not.toContain('<f>');
  expect(strFromU8(parts['xl/worksheets/sheet3.xml'])).toContain('r="F2"><v>0</v>');
  expect(strFromU8(parts['xl/worksheets/sheet3.xml'])).toContain('r="F3"/');
  if (process.env.WORTH_FUN_QA && info.project.name === 'desktop')
    await download.saveAs(`${process.env.WORTH_FUN_QA}/worth-fixture.xlsx`);
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON (.json)', exact: true }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
