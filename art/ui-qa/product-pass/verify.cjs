const { chromium } = require(process.env.WORTH_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'),
  assert = require('assert/strict');
(async () => {
  const root = require('path').resolve(__dirname);
  fs.mkdirSync(root, { recursive: true });
  const b = await chromium.launch({
    executablePath:
      process.env.WORTH_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--disable-gpu'],
  });
  try {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }),
      p = await c.newPage(),
      errors = [],
      writes = [];
    p.on('dialog', (d) => d.accept());
    p.on('pageerror', (e) => errors.push(e.message));
    const base = process.env.WORTH_PREVIEW_URL || 'http://localhost:34300';
    let routines = [],
      workouts = [],
      logs = [
        {
          id: 'old-bench',
          title: 'Bench press',
          happenedOn: '2026-10-07',
          createdAt: 10,
          weightUnit: 'lb',
          exerciseSets: [
            { reps: 10, weight: 40 },
            { reps: 8, weight: 45 },
          ],
          workoutId: null,
        },
        {
          id: 'old-shoulder',
          title: 'Shoulder press',
          happenedOn: '2026-10-07',
          createdAt: 20,
          weightUnit: 'kg',
          exerciseSets: [{ reps: 8, weight: 15 }],
          workoutId: null,
        },
        {
          id: 'walk',
          title: 'Evening walk',
          happenedOn: '2026-10-08',
          createdAt: 30,
          exerciseSets: [],
          workoutId: null,
        },
      ].map((l) => ({
        listId: 'gym',
        itemId: null,
        note: '',
        amount: null,
        unit: '',
        sets: null,
        reps: null,
        hasPhoto: false,
        updatedAt: 100,
        ...l,
      }));
    let list = {
      id: 'gym',
      name: 'Gym',
      kind: 'activity',
      description: '',
      itemCount: 0,
      rankedCount: 0,
      favoriteCount: 0,
      rankedIds: [],
      rankRevision: 0,
      hasCoverPhoto: false,
      updatedAt: 100,
      artwork: null,
    };
    workouts = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        listId: 'gym',
        title: 'Push day',
        happenedOn: '2026-10-10',
        createdAt: 50,
        updatedAt: 50,
        status: 'active',
        plannedExercises: ['Bench press', 'Shoulder press', 'Row'],
        skippedExercises: [],
      },
    ];
    const template = logs[0];
    logs = [
      {
        id: 'bench-1',
        title: 'Bench press',
        happenedOn: '2026-10-01',
        createdAt: 10,
        weightUnit: 'kg',
        exerciseSets: [
          { reps: 10, weight: 40 },
          { reps: 10, weight: 45 },
        ],
        workoutId: null,
      },
      {
        id: 'bench-2',
        title: 'Bench press',
        happenedOn: '2026-10-07',
        createdAt: 20,
        weightUnit: 'kg',
        exerciseSets: [
          { reps: 8, weight: 45 },
          { reps: 8, weight: 50 },
        ],
        workoutId: null,
      },
      {
        id: 'bench-3',
        title: 'Bench press',
        happenedOn: '2026-10-10',
        createdAt: 60,
        weightUnit: 'kg',
        exerciseSets: [
          { reps: 10, weight: 45 },
          { reps: 8, weight: 47.5 },
        ],
        workoutId: '11111111-1111-4111-8111-111111111111',
      },
    ].map((l) => ({ ...template, ...l }));
    let photoAttempts = 0,
      itemCreates = 0;
    const drinkList = {
        ...list,
        id: 'drinks',
        name: 'Drinks',
        kind: 'collection',
        logCount: 0,
        itemCount: 2,
      },
      items = [
        {
          id: 'coffee',
          listId: 'drinks',
          title: 'Cold brew',
          type: 'Coffee',
          note: 'Citrus finish',
          decision: 'meh',
          createdAt: Date.now(),
          updatedAt: 100,
          logCount: 0,
          lastLoggedOn: null,
          hasPhoto: false,
          startedOn: null,
          endedOn: null,
          revisitQueued: false,
        },
        {
          id: 'tea',
          listId: 'drinks',
          title: 'Tea',
          type: 'Tea',
          note: '',
          decision: null,
          createdAt: Date.now(),
          updatedAt: 100,
          logCount: 2,
          lastLoggedOn: '2026-10-01',
          hasPhoto: false,
          startedOn: null,
          endedOn: null,
          revisitQueued: false,
        },
      ];
    await c.route('**/api/**', async (r) => {
      const q = r.request(),
        path = new URL(q.url()).pathname.replace('/api', ''),
        method = q.method(),
        input = method === 'GET' || path.endsWith('/photo') ? null : q.postDataJSON();
      let data = {};
      if (method !== 'GET') writes.push({ path, method, input });
      if (path === '/me')
        data = { user: { id: 'preview', email: 'preview@example.test', displayName: 'Preview' } };
      else if (path.endsWith('/photo') && method === 'PUT') {
        photoAttempts++;
        if (photoAttempts === 1)
          return r.fulfill({ status: 500, json: { error: 'PHOTO_FAILED', message: 'Upload failed' } });
        data = { hasPhoto: true };
      } else if (path === '/search')
        data = {
          results: [
            {
              id: 'bench-1',
              kind: 'log',
              exercise: true,
              listId: 'gym',
              listName: 'Gym',
              title: 'Bench press',
              detail: '2026-10-01 · Cable machine',
              itemId: null,
            },
            {
              id: 'coffee',
              kind: 'item',
              listId: 'drinks',
              listName: 'Drinks',
              title: 'Cold brew',
              detail: 'Citrus finish',
              itemId: null,
            },
          ],
        };
      else if (path === '/lists') data = { lists: [{ ...list, logCount: logs.length }, drinkList] };
      else if (path === '/lists/drinks') data = { list: drinkList };
      else if (path === '/lists/drinks/items' && method === 'POST') {
        const item = { ...items[0], ...input, id: 'new-photo', decision: null };
        items.push(item);
        itemCreates++;
        data = { item };
      } else if (path === '/lists/drinks/items') data = { items };
      else if (path === '/lists/drinks/logs') data = { logs: [] };
      else if (path.startsWith('/items/')) {
        const item = items.find((i) => i.id === path.split('/')[2]);
        Object.assign(item, input);
        data = { item };
      } else if (path === '/lists/gym') data = { list: { ...list, logCount: logs.length } };
      else if (path === '/lists/gym/routines' && method === 'POST') {
        const routine = {
          ...input,
          id: 'r-' + (routines.length + 1),
          listId: 'gym',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        routines.push(routine);
        data = { routine };
      } else if (path === '/lists/gym/routines') data = { routines };
      else if (path.startsWith('/routines/')) {
        const id = path.split('/')[2];
        if (method === 'DELETE') {
          routines = routines.filter((r) => r.id !== id);
          return r.fulfill({ status: 204 });
        }
        const routine = routines.find((r) => r.id === id);
        Object.assign(routine, input);
        data = { routine };
      } else if (path === '/lists/gym/workouts' && method === 'POST') {
        const workout = {
          ...input,
          plannedExercises: input.routineId
            ? [...routines.find((r) => r.id === input.routineId).exercises]
            : [],
          id: '11111111-1111-4111-8111-' + String(workouts.length + 1).padStart(12, '0'),
          listId: 'gym',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        workouts.unshift(workout);
        data = { workout };
      } else if (path === '/lists/gym/workouts') data = { workouts };
      else if (path.startsWith('/workouts/')) {
        const id = path.split('/')[2],
          workout = workouts.find((w) => w.id === id);
        if (method === 'DELETE') {
          workouts = workouts.filter((w) => w.id !== id);
          logs.forEach((l) => {
            if (l.workoutId === id) l.workoutId = null;
          });
          return r.fulfill({ status: 204 });
        }
        Object.assign(workout, input);
        logs.forEach((l) => {
          if (l.workoutId === id) l.happenedOn = workout.happenedOn;
        });
        data = { workout };
      } else if (path === '/lists/gym/logs' && method === 'POST') {
        const log = {
          ...input,
          id: 'log-' + logs.length,
          listId: 'gym',
          hasPhoto: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        logs.unshift(log);
        data = { log };
      } else if (path === '/lists/gym/logs') data = { logs };
      else if (path.startsWith('/logs/') && method === 'PATCH') {
        const log = logs.find((l) => l.id === path.split('/')[2]);
        Object.assign(log, input);
        data = { log };
      } else if (path === '/overview')
        data = {
          lists: [{ ...list, logCount: logs.length }],
          recent: [],
          ranked: [],
          favorites: [],
          notAgain: [],
          lastTimes: [],
        };
      else throw Error('Unhandled ' + path);
      await r.fulfill({ json: data });
    });
    async function shot(name, w) {
      if (w === 390) {
        for (const width of [320, 430, 768]) {
          await p.setViewportSize({ width, height: 780 });
          assert(
            await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            'page overflow ' + name + ' ' + width,
          );
          assert(
            await p.evaluate(() =>
              [...document.querySelectorAll('dialog[open]')].every((d) => d.scrollWidth <= d.clientWidth),
            ),
            'dialog overflow ' + name + ' ' + width,
          );
        }
      }
      await p.setViewportSize({ width: w, height: w === 1440 ? 900 : 780 });
      await p.evaluate(() => document.fonts.ready);
      await p.evaluate(() => {
        if (!document.querySelector('dialog[open]')) document.activeElement?.blur();
        for (const element of document.querySelectorAll('.app-rail,.app-content,.app-shell'))
          element.scrollTop = 0;
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        scrollTo(0, 0);
        for (const a of document.getAnimations()) a.finish();
        for (const d of document.querySelectorAll('dialog[open]')) d.scrollTop = 0;
      });
      await p.waitForTimeout(250);
      await p.evaluate(() => {
        document.querySelector('.exercise-history-dialog[open] .icon-button')?.focus({ preventScroll: true });
        for (const d of document.querySelectorAll('dialog[open]'))
          d.scrollTo({ top: 0, behavior: 'instant' });
      });
      await p.waitForTimeout(100);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow ' + name);
      await p.screenshot({
        path: root + '/' + name + (w === 1440 ? '-desktop' : '-mobile') + '.png',
        fullPage: (await p.locator('dialog[open]').count()) === 0,
        animations: 'disabled',
      });
      if (name === 'recovered-exercise' || name === 'photo-capture') {
        const target = p.locator(name === 'recovered-exercise' ? '.exercise-sets' : '.draft-photo');
        await target.evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await p.screenshot({
          path: root + '/' + name + '-fields' + (w === 1440 ? '-desktop' : '-mobile') + '.png',
          animations: 'disabled',
        });
        if (name === 'recovered-exercise') {
          await p
            .locator('.next-exercise-choice')
            .evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await p.screenshot({
            path: root + '/' + name + '-save-controls' + (w === 1440 ? '-desktop' : '-mobile') + '.png',
            animations: 'disabled',
          });
        }
      }
    }

    await p.goto(base + '/lists/gym');
    await p.getByRole('button', { name: 'Resume workout', exact: true }).waitFor();
    for (const w of [1440, 390]) await shot('active-workout', w);
    await p.getByRole('button', { name: 'Resume workout', exact: true }).click();
    await p.getByRole('button', { name: 'Activity', exact: true }).click();
    await p.getByLabel('What', { exact: true }).fill('Evening walk draft');
    await p.reload();
    await p.getByLabel('What', { exact: true }).waitFor();
    assert.equal(await p.getByLabel('What', { exact: true }).inputValue(), 'Evening walk draft');
    assert.equal(
      await p.getByRole('button', { name: 'Activity', exact: true }).getAttribute('aria-pressed'),
      'true',
    );
    assert.equal(await p.locator('.exercise-sets').count(), 0);
    await p.getByRole('button', { name: 'Close', exact: true }).click();
    await p.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await p.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    await p.getByRole('button', { name: 'Start rest', exact: true }).click();
    assert((await p.locator('.rest-time').innerText()).startsWith('1:'));
    await p.reload();
    await p.getByRole('button', { name: 'Cancel timer', exact: true }).waitFor();
    await p.getByRole('button', { name: 'Skip Shoulder press for this visit', exact: true }).click();
    await p.getByRole('button', { name: 'Restore', exact: true }).waitFor();
    assert.equal(workouts[0].skippedExercises[0], 'Shoulder press');
    await p.getByRole('button', { name: 'Restore', exact: true }).click();
    await p.getByRole('button', { name: 'Resume workout', exact: true }).click();
    await p.getByLabel('Exercise', { exact: true }).waitFor();
    assert.equal(await p.getByLabel('Exercise', { exact: true }).inputValue(), 'Shoulder press');
    await p.getByRole('spinbutton', { name: 'Set 1 reps', exact: true }).fill('9');
    await p.getByRole('spinbutton', { name: 'Set 1 weight in kg', exact: true }).fill('15');
    await p.getByRole('button', { name: 'Duplicate last set', exact: true }).click();
    assert.equal(await p.getByRole('spinbutton', { name: 'Set 2 reps', exact: true }).inputValue(), '9');
    await p.reload();
    await p.waitForTimeout(2000);
    await p.getByRole('spinbutton', { name: 'Set 2 reps', exact: true }).waitFor();
    assert.equal(await p.getByRole('spinbutton', { name: 'Set 2 reps', exact: true }).inputValue(), '9');
    assert.equal(await p.getByLabel('Exercise', { exact: true }).inputValue(), 'Shoulder press');
    for (const w of [1440, 390]) await shot('recovered-exercise', w);
    await p.getByRole('checkbox', { name: 'Continue to next exercise after saving' }).check();
    await p.getByRole('spinbutton', { name: 'Set 2 reps', exact: true }).focus();
    await p.keyboard.press('Control+Enter');
    await p.waitForFunction(() => document.querySelector('[aria-label="Exercise"]')?.value === 'Row');
    assert.equal(
      logs.filter(
        (l) => l.title === 'Shoulder press' && l.workoutId === '11111111-1111-4111-8111-111111111111',
      ).length,
      1,
    );
    await p.getByRole('spinbutton', { name: 'Set 1 reps', exact: true }).fill('12');
    await p.getByRole('button', { name: 'Save log', exact: true }).click();
    await p.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    await p.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await p.getByRole('button', { name: 'Reopen workout', exact: true }).waitFor();
    assert.equal(workouts[0].status, 'finished');
    for (const w of [1440, 390]) await shot('workout-recap', w);
    await p.getByRole('button', { name: 'Edit workout Push day', exact: true }).click();
    await p.getByLabel('This visit’s lineup').fill('Row\nPull-up\nBench press');
    await p.getByRole('button', { name: 'Move Pull-up up', exact: true }).click();
    assert.equal(await p.getByLabel('This visit’s lineup').inputValue(), 'Pull-up\nRow\nBench press');
    await p.getByRole('button', { name: 'Save workout', exact: true }).click();
    await p.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    assert.deepEqual(workouts[0].plannedExercises, ['Pull-up', 'Row', 'Bench press']);
    await p.goto(base + '/lists/drinks');
    await p.locator('.collection-index-row button').first().click();
    const slip = p
      .locator('.collection-action-tray:visible, .opinion-slip:visible')
      .filter({ has: p.getByRole('button', { name: 'Add to revisit queue', exact: true }) })
      .last();
    await slip.getByRole('button', { name: 'Add to revisit queue', exact: true }).click();
    assert.equal(items[0].decision, 'meh');
    await p.getByRole('button', { name: /^Revisit queue/ }).click();
    assert.equal(await p.locator('.collection-index-row').count(), 1);
    for (const w of [1440, 390]) await shot('revisit-queue', w);
    await p
      .getByRole('button', { name: /^All/ })
      .filter({ hasNot: p.locator('svg') })
      .first()
      .click();
    await p.getByRole('button', { name: 'Filter', exact: true }).click();
    await p.getByLabel('Filter by personal call').selectOption('none');
    assert.equal(await p.locator('.collection-index-row').count(), 1);
    await p.getByLabel('Filter by visit count', { exact: true }).selectOption('again');
    assert((await p.locator('.collection-index-rows').innerText()).includes('Tea'));
    for (const w of [1440, 390]) await shot('collection-filters', w);
    await p.goto(base + '/search');
    await p.getByPlaceholder('An exercise, a note, a good drink…').fill('Cable');
    await p.getByRole('button', { name: /^Exercises/ }).click();
    await p.waitForFunction(() => document.querySelectorAll('.search-group a').length === 1);
    assert.equal(await p.locator('.search-group a').count(), 1);
    assert((await p.locator('.search-group').innerText()).includes('Cable machine'));
    for (const w of [1440, 390]) await shot('exercise-search', w);
    await p.goto(base + '/lists/drinks?new=1');
    await p.getByLabel('Name', { exact: true }).fill('Photo coffee');
    await p.getByLabel('Private note', { exact: false }).first().fill('Save this draft');
    await p.reload();
    await p.getByLabel('Name', { exact: true }).waitFor();
    assert.equal(await p.getByLabel('Name', { exact: true }).inputValue(), 'Photo coffee');
    await p.locator('.draft-photo summary').click();
    await p.getByLabel('Choose photo', { exact: true }).setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZbAAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await p.getByText('Photo draft saved on this device.', { exact: true }).waitFor();
    await p.reload();
    await p.getByText('Photo restored from this device.', { exact: true }).waitFor();
    assert.equal(await p.locator('.draft-photo img').count(), 1);
    for (const w of [1440, 390]) await shot('photo-capture', w);
    await c.setOffline(true);
    await p
      .getByText('You’re offline. Record drafts stay on this device. Reconnect to save to your archive.', {
        exact: true,
      })
      .waitFor({ state: 'attached' });
    assert(await p.getByRole('button', { name: 'Add item', exact: true }).isDisabled());
    await c.setOffline(false);
    await p.getByRole('button', { name: 'Add item', exact: true }).click();
    await p.locator('.form-error').waitFor();
    assert.equal(itemCreates, 1);
    await p.getByRole('button', { name: 'Add item', exact: true }).click();
    await p.waitForFunction(
      () => document.querySelector('.item-editor-dialog h2')?.textContent === 'Photo coffee',
    );
    assert.equal(itemCreates, 1);
    assert.equal(photoAttempts, 2);
    await p.getByRole('button', { name: 'Close', exact: true }).click();
    await p.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    for (const w of [320, 430, 768]) {
      await p.setViewportSize({ width: w, height: 780 });
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow ' + w);
    }
    logs = [];
    workouts = [];
    routines = [];
    await p.goto(base + '/lists/gym');
    await p.getByRole('button', { name: 'New routine', exact: true }).waitFor();
    for (const w of [1440, 390]) await shot('first-activity', w);
    await p.getByRole('button', { name: 'New routine', exact: true }).click();
    await p.getByLabel('Name', { exact: true }).fill('My lineup');
    await p.getByLabel('Exercises', { exact: true }).fill('Row\nPress');
    await p.getByRole('button', { name: 'Move Press up', exact: true }).click();
    assert.equal(await p.getByLabel('Exercises', { exact: true }).inputValue(), 'Press\nRow');
    for (const w of [1440, 390]) await shot('first-routine', w);
    await p.getByRole('button', { name: 'Save routine', exact: true }).click();
    await p.waitForFunction(() => document.querySelectorAll('dialog[open]').length === 0);
    assert.deepEqual(routines[0].exercises, ['Press', 'Row']);
    assert.equal(logs.length, 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      root + '/qa-result.json',
      JSON.stringify(
        {
          errors,
          checks: [
            'resume, persistent rest timer, skip/restore',
            'draft survives workout reload with exact sets and association',
            'duplicate last set and keyboard save',
            'save and next exercise',
            'finish recap and visit-only swap/reorder',
            'queue independent of Meh and ranking',
            'no-call and revisit filters',
            'exercise search and note context',
            'new item draft recovery and photo selection',
            'failed photo retries without duplicate',
            'desktop/mobile screenshots and 320/430/768 overflow',
            'photo draft restored from IndexedDB after reload',
            'offline save disabled with factual connection status',
            'empty activity setup and ordered first routine without seeded logs',
            'Activity/Exercise mode preserved when recovering a workout draft',
          ],
        },
        null,
        2,
      ),
    );
    console.log('Product QA passed');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
