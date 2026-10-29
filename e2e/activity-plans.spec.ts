import { activityTools } from './navigation';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, type State } from './fixtures';
import type { WorkoutRoutine, WorkoutSession, Log } from '../src/shared/models';
import { routineInput, workoutInput, workoutPatch, logInput } from '../src/shared/validation';
import { aliasInput, blankRoutineTarget } from '../src/shared/activity-plans';
const listId = '11111111-1111-4111-8111-111111111111';
async function capture(page: Page, name: string, project: string, selector?: string) {
  if (!process.env.WORTH_ACTIVITY_PLANS_QA) return;
  if (selector) await page.locator(selector).first().scrollIntoViewIfNeeded();
  await mkdir(process.env.WORTH_ACTIVITY_PLANS_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_ACTIVITY_PLANS_QA}/${name}-${project}.png` });
}
async function setup(page: Page, archive: State) {
  archive.list.kind = 'activity';
  archive.list.name = 'Training notes';
  archive.list.rankedIds = [];
  archive.list.itemCount = 0;
  archive.items = [];
  archive.logs = [];
  archive.list.exerciseAliases = [];
  archive.list.exerciseAliasRevision = 0;
  const routines: WorkoutRoutine[] = [],
    workouts: WorkoutSession[] = [],
    logs: Log[] = [];
  const receipts = new Map<string, string>(),
    removed = new Set<string>();
  let lose = false;
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace('/api', ''),
      method = req.method(),
      reply = (json: unknown, status = 200) => route.fulfill({ json, status });
    if (path === `/lists/${listId}` && method === 'GET')
      return reply({ list: { ...archive.list, logCount: logs.length } });
    if (path === `/lists/${listId}/exercise-aliases`) {
      const parsed = aliasInput.safeParse(req.postDataJSON());
      if (!parsed.success) return reply({ message: parsed.error.issues[0].message }, 400);
      const value = parsed.data;
      if (
        value.expectedRevision !== archive.list.exerciseAliasRevision &&
        JSON.stringify(value.groups) !== JSON.stringify(archive.list.exerciseAliases)
      )
        return reply(
          { error: 'ALIASES_CHANGED', message: 'These aliases changed elsewhere. Check saved groups.' },
          409,
        );
      if (value.expectedRevision === archive.list.exerciseAliasRevision) {
        archive.list.exerciseAliases = value.groups;
        archive.list.exerciseAliasRevision!++;
      }
      archive.writes.push({ path, body: value });
      return reply({ list: archive.list });
    }
    const resource =
      path === `/lists/${listId}/routines`
        ? 'routine'
        : path === `/lists/${listId}/workouts`
          ? 'workout'
          : null;
    if (resource) {
      if (method === 'GET') return reply(resource === 'routine' ? { routines } : { workouts });
      const key = req.headers()['idempotency-key'] ?? crypto.randomUUID(),
        raw = req.postDataJSON();
      if (removed.has(key)) return reply({ error: 'PLAN_REMOVED', message: 'This plan was removed.' }, 410);
      const body = resource === 'routine' ? routineInput.parse(raw) : workoutInput.parse(raw),
        hash = JSON.stringify(body);
      if (receipts.has(key)) {
        if (receipts.get(key) !== hash)
          return reply({ error: 'OPERATION_CHANGED', message: 'This retry differs.' }, 409);
        return resource === 'routine'
          ? reply({ routine: routines.find((row) => row.id === key) }, 201)
          : reply({ workout: workouts.find((row) => row.id === key) }, 201);
      }
      if (resource === 'routine') {
        const input = routineInput.parse(body);
        routines.push({
          id: key,
          listId,
          title: input.title,
          exercises: input.exercises,
          targets: input.targets ?? [],
          revision: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        const input = workoutInput.parse(body),
          source = routines.find((row) => row.id === input.routineId);
        if (
          source &&
          input.expectedRoutineRevision !== undefined &&
          source.revision !== input.expectedRoutineRevision
        )
          return reply({ error: 'PLAN_CHANGED', message: 'The routine changed. Check the saved plan.' }, 409);
        workouts.unshift({
          id: key,
          listId,
          title: input.title || source?.title || 'Workout',
          happenedOn: input.happenedOn,
          plannedExercises: [...(source?.exercises ?? [])],
          targets: structuredClone(source?.targets ?? []),
          skippedExercises: [],
          status: 'active',
          revision: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      receipts.set(key, hash);
      archive.writes.push({ path, body: { ...body, key } });
      if (lose) {
        lose = false;
        return route.abort('failed');
      }
      return resource === 'routine'
        ? reply({ routine: routines.at(-1) }, 201)
        : reply({ workout: workouts[0] }, 201);
    }
    if (path.startsWith('/routines/')) {
      const row = routines.find((value) => value.id === path.split('/')[2]);
      if (!row) return reply({ message: 'Routine not found.' }, 404);
      if (method === 'DELETE') {
        removed.add(row.id);
        routines.splice(routines.indexOf(row), 1);
        return route.fulfill({ status: 204 });
      }
      const input = routineInput.parse(req.postDataJSON());
      if (input.expectedRevision !== row.revision)
        return reply(
          { error: 'PLAN_CHANGED', message: 'This plan changed elsewhere. Your draft is kept.' },
          409,
        );
      Object.assign(row, {
        title: input.title,
        exercises: input.exercises,
        targets: input.targets ?? row.targets,
        revision: (row.revision ?? 0) + 1,
        updatedAt: Date.now(),
      });
      archive.writes.push({ path, body: input });
      return reply({ routine: row });
    }
    if (path.startsWith('/workouts/')) {
      const row = workouts.find((value) => value.id === path.split('/')[2]);
      if (!row) return reply({ message: 'Workout not found.' }, 404);
      const input = workoutPatch.parse(req.postDataJSON());
      if (input.expectedRevision !== row.revision)
        return reply(
          { error: 'PLAN_CHANGED', message: 'This workout changed elsewhere. Your draft is kept.' },
          409,
        );
      Object.assign(row, input, { revision: (row.revision ?? 0) + 1, updatedAt: Date.now() });
      archive.writes.push({ path, body: input });
      return reply({ workout: row });
    }
    if (path === `/lists/${listId}/logs`) {
      if (method === 'GET') return reply({ logs });
      const input = logInput.parse(req.postDataJSON()),
        id = req.headers()['idempotency-key'] ?? crypto.randomUUID();
      let row = logs.find((row) => row.id === id);
      if (!row) {
        row = {
          ...input,
          id,
          listId,
          revision: 0,
          hasPhoto: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        logs.push(row);
      }
      archive.writes.push({ path, body: input });
      return reply({ log: row }, 201);
    }
    if (path.startsWith('/logs/') && method === 'PATCH') {
      const row = logs.find((row) => row.id === path.split('/')[2]);
      if (!row) return reply({ message: 'Log not found.' }, 404);
      const raw = req.postDataJSON(),
        input = logInput.parse(raw);
      if (raw.expectedRevision !== undefined && raw.expectedRevision !== row.revision)
        return reply({ message: 'This entry changed elsewhere.' }, 409);
      Object.assign(row, input, { revision: (row.revision ?? 0) + 1, updatedAt: Date.now() });
      archive.writes.push({ path, body: input });
      return reply({ log: row });
    }
    return route.fallback();
  });
  return {
    routines,
    workouts,
    logs,
    loseNext: () => {
      lose = true;
    },
  };
}
function seedRoutine(routines: WorkoutRoutine[]) {
  routines.push({
    id: crypto.randomUUID(),
    listId,
    title: 'A small loop',
    exercises: ['Run'],
    targets: [
      {
        ...blankRoutineTarget('Run'),
        durationSeconds: 600,
        distance: 2,
        distanceUnit: 'mi',
        restSeconds: 75,
        note: 'A reference, not results.',
      },
    ],
    revision: 0,
    createdAt: 1,
    updatedAt: 1,
  });
}

test('routine targets copy into future workouts while recorded measurements remain explicit', async ({
  page,
  archive,
}, info) => {
  const state = await setup(page, archive);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/lists/${listId}`);
  await activityTools(page, 'Routines');
  await page.getByRole('button', { name: 'New routine', exact: true }).click();
  const routine = page.getByRole('dialog', { name: 'Your usual lineup', exact: true });
  await routine.getByLabel('Name', { exact: true }).fill('A small loop');
  await routine.getByLabel('Exercises', { exact: true }).fill('Run');
  await routine.locator('summary').filter({ hasText: 'Target plans' }).click();
  await routine.getByRole('checkbox', { name: 'Plan for Run', exact: true }).check();
  await routine.getByRole('spinbutton', { name: 'Run planned duration seconds', exact: true }).fill('600');
  await routine.getByRole('spinbutton', { name: 'Run planned distance', exact: true }).fill('2');
  await routine.getByLabel('Run planned distance unit', { exact: true }).selectOption('mi');
  await routine.getByRole('spinbutton', { name: 'Run planned rest seconds', exact: true }).fill('75');
  await routine.getByLabel('Plan note for Run', { exact: true }).fill('A reference, not results.');
  await capture(page, 'routine-targets', info.project.name, '.routine-target-card');
  await routine.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(routine).toBeHidden();
  await activityTools(page, 'Routines');
  await page.getByRole('button', { name: 'Start workout from A small loop', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Start a fresh visit', exact: true });
  await expect(start).toContainText('600s duration');
  await capture(page, 'start-review', info.project.name);
  await start.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(start).toBeHidden();
  expect(state.logs).toHaveLength(0);
  expect(state.workouts[0].targets?.[0].durationSeconds).toBe(600);
  await activityTools(page, 'Routines');
  await page.getByRole('button', { name: 'Edit routine A small loop', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit routine', exact: true });
  await edit.getByRole('spinbutton', { name: 'Run planned duration seconds', exact: true }).fill('900');
  await edit.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(edit).toBeHidden();
  expect(state.workouts[0].targets?.[0].durationSeconds).toBe(600);
  expect(state.routines[0].targets?.[0].durationSeconds).toBe(900);
  await page.getByRole('button', { name: 'Log exercise for Run in A small loop', exact: true }).click();
  const exercise = page.getByRole('dialog', { name: 'Log an exercise', exact: true });
  await expect(exercise.getByRole('spinbutton', { name: 'Set 1 reps', exact: true })).toHaveValue('');
  await expect(exercise.getByLabel('Planned target', { exact: true })).toContainText('600s duration');
  await exercise.getByRole('button', { name: 'Remove set 1', exact: true }).click();
  await exercise.locator('summary').filter({ hasText: 'More details' }).click();
  await exercise.locator('summary').filter({ hasText: 'Named measurements' }).click();
  await exercise.getByRole('button', { name: 'Add named measurement', exact: true }).click();
  await exercise.getByLabel('Measurement 1 name', { exact: true }).fill('Duration');
  await exercise.getByLabel('Measurement 1 value', { exact: true }).fill('580');
  await exercise.getByLabel('Measurement 1 unit', { exact: true }).fill('seconds');
  await capture(page, 'actual-measurements', info.project.name, '.measurement-card');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await exercise.getByRole('button', { name: 'Save log', exact: true }).click();
  await expect(exercise).toBeHidden();
  expect(state.logs).toHaveLength(1);
  expect(state.logs[0].exerciseSets).toEqual([]);
  expect(state.logs[0].measurements).toEqual([{ name: 'Duration', value: 580, unit: 'seconds' }]);
  expect(state.workouts[0].targets?.[0].durationSeconds).toBe(600);
  await expect(page.locator('.workout-card')).toContainText('No individual sets recorded');
  await capture(page, 'workout-results', info.project.name, '.workout-card');
});

test('a lost routine start keeps its fixed retry after reload and never duplicates a workout', async ({
  page,
  archive,
}, info) => {
  const state = await setup(page, archive);
  seedRoutine(state.routines);
  await page.goto(`/lists/${listId}`);
  await activityTools(page, 'Routines');
  await page.getByRole('button', { name: 'Start workout from A small loop', exact: true }).click();
  let start = page.getByRole('dialog', { name: 'Start a fresh visit', exact: true });
  state.loseNext();
  await start.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(start).toContainText('This pending save is fixed.');
  await expect(start.getByLabel('Name', { exact: true })).toBeDisabled();
  await capture(page, 'pending-start', info.project.name);
  const key = state.workouts[0].id;
  state.routines[0].targets![0].durationSeconds = 900;
  state.routines[0].revision = 1;
  await page.reload();
  await activityTools(page, 'Routines');
  await page.getByRole('button', { name: 'Start workout from A small loop', exact: true }).click();
  start = page.getByRole('dialog', { name: 'Start a fresh visit', exact: true });
  await expect(start).toContainText('600s duration');
  await expect(start.getByLabel('Name', { exact: true })).toBeDisabled();
  await start.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(start).toBeHidden();
  expect(state.workouts).toHaveLength(1);
  expect(state.workouts[0].id).toBe(key);
  expect(state.workouts[0].targets?.[0].durationSeconds).toBe(600);
});

test('stale routine edits compare the saved plan while keeping the previous draft readable', async ({
  page,
  archive,
}, info) => {
  const state = await setup(page, archive);
  seedRoutine(state.routines);
  await page.goto(`/lists/${listId}`);
  await activityTools(page, 'Routines');
  await page.getByRole('button', { name: 'Edit routine A small loop', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit routine', exact: true });
  await edit.getByLabel('Name', { exact: true }).fill('My unfinished plan');
  state.routines[0].title = 'Changed elsewhere';
  state.routines[0].revision = 1;
  state.routines[0].targets![0].durationSeconds = 900;
  await edit.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(edit).toContainText('This plan changed elsewhere.');
  await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('My unfinished plan');
  await edit.getByRole('button', { name: 'Check saved plan', exact: true }).click();
  await expect(edit).toContainText('Saved plan to compare');
  await expect(edit).toContainText('900s duration');
  await capture(page, 'saved-comparison', info.project.name, '.previous-exercise');
  await edit.getByRole('button', { name: 'Use saved plan', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Replace this draft with the saved plan?', exact: true })
    .getByRole('button', { name: 'Use saved plan', exact: true })
    .click();
  await expect(edit.getByLabel('Name', { exact: true })).toHaveValue('Changed elsewhere');
  await edit.locator('summary').filter({ hasText: 'Previous draft kept for copying' }).click();
  await expect(edit.locator('.plan-draft-copy')).toContainText('My unfinished plan');
  await edit.getByLabel('Name', { exact: true }).fill('Reconciled');
  await edit.getByRole('button', { name: 'Save routine', exact: true }).click();
  await expect(edit).toBeHidden();
  expect(state.routines[0].revision).toBe(2);
  expect(state.routines[0].targets?.[0].durationSeconds).toBe(900);
});

test('exercise aliases group literal measurements and retain original names with unit gaps', async ({
  page,
  archive,
}, info) => {
  const state = await setup(page, archive);
  const base = logInput.parse({
    exercise: true,
    title: 'Jog',
    happenedOn: '2026-10-01',
    measurements: [{ name: 'Distance', value: 0, unit: 'mi' }],
  });
  state.logs.push(
    { ...base, id: crypto.randomUUID(), listId, hasPhoto: false, revision: 0, createdAt: 1, updatedAt: 1 },
    {
      ...base,
      id: crypto.randomUUID(),
      title: 'Easy run',
      measurements: [{ name: 'Distance', value: 2, unit: 'km' }],
      hasPhoto: false,
      listId,
      revision: 0,
      createdAt: 2,
      updatedAt: 2,
    },
  );
  await page.goto(`/lists/${listId}`);
  await activityTools(page, 'Progress & exercise history');
  await page.locator('.exercise-directory:not(.workout-progress) > summary').click();
  await page.getByRole('button', { name: 'Group exercise names', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Same exercise. Different names.', exact: true });
  await editor.getByRole('button', { name: 'Add name group', exact: true }).click();
  await editor.getByLabel('Preferred name for group 1', { exact: true }).fill('Run');
  await editor.getByLabel('Other names for group 1', { exact: true }).fill('Jog\nEasy run');
  await capture(page, 'aliases', info.project.name);
  await editor.getByRole('button', { name: 'Save exercise aliases', exact: true }).click();
  await expect(editor).toBeHidden();
  await page.getByRole('button', { name: 'View history for Run', exact: true }).click();
  const history = page.getByRole('dialog', { name: 'Run', exact: true });
  await history.getByRole('button', { name: 'Distance · mi', exact: true }).click();
  await expect(history).toContainText('Recorded as: Jog');
  await expect(history).toContainText('Recorded as: Easy run');
  await expect(history).toContainText('Gaps have no recorded Distance · mi');
  await expect(history.locator('.exercise-chart-point')).toHaveCount(1);
  await expect(history.locator('.exercise-chart-point')).toHaveAttribute('aria-label', /0 mi/);
  await capture(page, 'alias-history', info.project.name);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
  await history.getByRole('button', { name: 'Close exercise history', exact: true }).click();
  expect(state.logs.map((log) => log.title)).toEqual(['Jog', 'Easy run']);
  await page.getByRole('button', { name: 'Group exercise names', exact: true }).click();
  await editor.getByRole('button', { name: 'Add name group', exact: true }).click();
  await editor.getByLabel('Preferred name for group 2', { exact: true }).fill('Other');
  await editor.getByLabel('Other names for group 2', { exact: true }).fill('JOG');
  await editor.getByRole('button', { name: 'Save exercise aliases', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Each name can belong to one group');
  expect(archive.list.exerciseAliases).toHaveLength(1);
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await editor.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
  }
});

test('an older recovered exercise draft cannot overwrite a newer saved entry', async ({
  page,
  archive,
}, info) => {
  const state = await setup(page, archive),
    id = crypto.randomUUID();
  const input = logInput.parse({
    exercise: true,
    title: 'A timed walk',
    happenedOn: '2026-10-19',
    note: 'Original note',
    measurements: [{ name: 'Duration', value: 0, unit: 'seconds' }],
  });
  state.logs.push({ ...input, id, listId, revision: 0, hasPhoto: false, createdAt: 1, updatedAt: 1 });
  await page.goto(`/lists/${listId}?focus=log:${id}`);
  let editor = page.locator('.activity-editor-dialog');
  await expect(editor).toHaveAccessibleName('A timed walk');
  await editor.getByRole('textbox', { name: 'Private note optional', exact: true }).fill('My pending note');
  await expect(editor.getByRole('status')).toContainText('Draft saved on this device.');
  state.logs[0].note = 'Changed elsewhere';
  state.logs[0].revision = 1;
  await page.reload();
  editor = page.locator('.activity-editor-dialog');
  await expect(editor).toHaveAccessibleName('A timed walk');
  await expect(editor.getByRole('textbox', { name: 'Private note optional', exact: true })).toHaveValue(
    'My pending note',
  );
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('This entry changed elsewhere.');
  expect(state.logs[0].note).toBe('Changed elsewhere');
  expect(state.logs[0].revision).toBe(1);
  await expect(editor.getByRole('textbox', { name: 'Private note optional', exact: true })).toHaveValue(
    'My pending note',
  );
  await capture(page, 'stale-exercise-draft', info.project.name);
  await page.addInitScript(
    ({ listId, id }) => {
      const key = `worth:draft:v1:browser-preview:log:${listId}:${id}`;
      const stored = localStorage.getItem(key);
      if (!stored) throw new Error('Expected the retained exercise draft.');
      const draft = JSON.parse(stored);
      delete draft.form.expectedRevision;
      localStorage.setItem(key, JSON.stringify(draft));
    },
    { listId, id },
  );
  await page.reload();
  editor = page.locator('.activity-editor-dialog');
  await expect(editor).toHaveAccessibleName('A timed walk');
  await expect(editor).toContainText('This older draft has no saved revision.');
  await expect(editor.getByRole('textbox', { name: 'Private note optional', exact: true })).toHaveValue(
    'My pending note',
  );
  await expect(editor.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
  expect(state.logs[0].note).toBe('Changed elsewhere');
  await capture(page, 'legacy-exercise-draft', info.project.name);
});
