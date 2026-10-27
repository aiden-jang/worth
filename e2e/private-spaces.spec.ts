import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, mockArchive, type State } from './fixtures';
import type { Page } from '@playwright/test';
import { sourceReviewHash, type SourceSelection, type SourcePreview } from '../src/shared/record-snapshots';
import type { SpaceView, PairView, SharedArchive } from '../src/shared/private-spaces';
const sourceId = '22222222-2222-4222-8222-222222222222';
function server() {
  return {
    spaces: new Map<string, SpaceView>(),
    invites: new Map<string, { spaceId: string; token: string }>(),
    pairs: new Map<
      string,
      PairView & { choices: Record<string, number>; sealed: string[]; partner: string }
    >(),
    copies: new Map<string, SharedArchive[]>(),
    shareKeys: new Set<string>(),
    loseShare: false,
  };
}
async function setup(page: Page, state: State, user: string, s: ReturnType<typeof server>) {
  state.items[0].id = sourceId;
  state.list.rankedIds = [sourceId];
  state.items[0].decision = null;
  await page.route('**/api/me', (r) =>
    r.fulfill({
      json: { user: { id: user, email: `${user}@example.test`, displayName: user, emailVerified: true } },
    }),
  );
  await page.route('**/api/capsules/source-preview', async (r) => {
    const selection = r.request().postDataJSON() as SourceSelection;
    const data: SourcePreview['data'] = { title: 'Coffee' };
    for (const f of selection.fields) {
      if (f === 'type') data.type = 'Drink';
      if (f === 'note') data.note = 'PRIVATE NOTE';
      if (f === 'decision') data.decision = null;
      if (f === 'rank') data.rank = 1;
      if (f === 'dates') data.dates = { startedOn: null, endedOn: null };
    }
    const preview = { selection, listName: 'My drinks', data, photos: [], previewedAt: Date.now() };
    await r.fulfill({ json: { preview: { ...preview, hash: await sourceReviewHash(preview) } } });
  });
  await page.route('**/api/{spaces,pairs}**', async (r) => {
    const req = r.request(),
      parts = new URL(req.url()).pathname.split('/'),
      area = parts[2],
      id = parts[3],
      action = parts[4],
      method = req.method(),
      body = req.postData() ? req.postDataJSON() : {},
      key = req.headers()['idempotency-key'];
    const reply = (json: unknown, status = 200) => r.fulfill({ json, status });
    const getView = (space: SpaceView): SpaceView => ({
      ...space,
      role:
        user === 'owner'
          ? 'owner'
          : (space.members.find((m) => m.accountId === user && !m.revoked)?.role ?? 'viewer'),
      members: user === 'owner' ? space.members : space.members.filter((m) => m.accountId === user),
    });
    const accessible = (space: SpaceView) =>
      user === 'owner' || space.members.some((m) => m.accountId === user && !m.revoked);
    if (area === 'pairs') {
      const p = s.pairs.get(id)!;
      if (action === 'choice') p.choices[user] = body.choice;
      if (action === 'reveal') p.sealed.push(user);
      return reply({});
    }
    if (id === 'archives') {
      if (method === 'DELETE') {
        s.copies.set(
          user,
          (s.copies.get(user) ?? []).filter((c) => c.id !== action),
        );
        return r.fulfill({ status: 204 });
      }
      return reply({ archives: s.copies.get(user) ?? [] });
    }
    if (id === 'invites') {
      const inv = s.invites.get(action)!;
      const space = s.spaces.get(inv.spaceId)!;
      const grant = space.members.find((m) => m.id === action)!;
      if (body.token !== inv.token || grant.email !== `${user}@example.test` || grant.revoked)
        return reply({ message: 'Invitation unavailable.' }, 404);
      grant.accountId = user;
      space.revision++;
      return reply(getView(space));
    }
    if (!id && method === 'GET')
      return reply({ spaces: [...s.spaces.values()].filter(accessible).map(getView) });
    if (!id && method === 'POST') {
      const old = s.spaces.get(key);
      if (old) return reply(getView(old), 201);
      const space: SpaceView = {
        id: key,
        name: body.name,
        note: '',
        role: 'owner',
        revision: 0,
        entries: [],
        members: [],
      };
      s.spaces.set(key, space);
      return reply(space, 201);
    }
    const space = s.spaces.get(id);
    if (!space || !accessible(space))
      return reply({ error: 'NOT_FOUND', message: 'Shared space unavailable.' }, 404);
    if (action === 'pairs') {
      if (method === 'POST') {
        if (!s.pairs.has(key))
          s.pairs.set(key, {
            id: key,
            title: body.title,
            options: body.options,
            ownChoice: null,
            ownRevision: 0,
            ownRevealed: false,
            partnerRevealed: false,
            result: null,
            choices: {},
            sealed: [],
            partner: body.partnerId,
          });
        space.revision++;
        return reply({}, 201);
      }
      return reply({
        pairs: [...s.pairs.values()]
          .filter((p) => user === 'owner' || p.partner === user)
          .map((p) => ({
            id: p.id,
            title: p.title,
            options: p.options,
            ownChoice: p.choices[user] ?? null,
            ownRevision: p.choices[user] !== undefined ? 1 : 0,
            ownRevealed: p.sealed.includes(user),
            partnerRevealed: p.sealed.some((u) => u !== user),
            result:
              p.sealed.includes('owner') && p.sealed.includes(p.partner)
                ? [
                    { name: 'owner', choice: p.choices.owner },
                    { name: p.partner, choice: p.choices[p.partner] },
                  ]
                : null,
          })),
      });
    }
    if (action === 'archive') {
      const copy: SharedArchive = {
        id: key,
        name: space.name,
        note: space.note,
        entries: space.entries.map(({ id, authorName, listName, data }) => ({
          id,
          authorName,
          listName,
          data,
        })),
        outcomes: [],
        savedAt: Date.now(),
      };
      s.copies.set(user, [...(s.copies.get(user) ?? []).filter((c) => c.id !== key), copy]);
      return reply({ archive: copy }, 201);
    }
    if (action === 'entries' && method === 'POST' && s.shareKeys.has(key)) return reply(getView(space), 201);
    if (method !== 'GET' && body.expectedRevision !== space.revision)
      return reply(
        { error: 'SPACE_CHANGED', message: 'This space changed. Compare your draft with saved details.' },
        409,
      );
    if (action === 'invites') {
      const token = 'secret'.repeat(12),
        grant = {
          id: key,
          email: body.email,
          role: body.role,
          accountId: null,
          expiresAt: Date.now() + 86400000,
          revoked: false,
        };
      space.members.push(grant);
      s.invites.set(key, { spaceId: id, token });
      space.revision++;
      return reply({ inviteId: key, link: `/spaces/invite/${key}#${token}`, space: getView(space) }, 201);
    }
    if (action === 'members') {
      space.members.find((m) => m.id === parts[5])!.revoked = true;
      space.revision++;
      return reply(getView(space));
    }
    if (action === 'entries') {
      if (method === 'DELETE') space.entries = space.entries.filter((e) => e.id !== parts[5]);
      else {
        const data: SourcePreview['data'] = {
          title: 'Coffee',
          type: 'Drink',
          decision: null,
          rank: 1,
          dates: { startedOn: null, endedOn: null },
        };
        if (body.selection.fields.includes('note')) data.note = 'PRIVATE NOTE';
        space.entries.push({ id: key, authorId: user, authorName: user, listName: 'My drinks', data });
        s.shareKeys.add(key);
      }
      space.revision++;
      if (s.loseShare) {
        s.loseShare = false;
        return r.abort('failed');
      }
      return reply(getView(space), 201);
    }
    if (action === 'note') {
      space.note = body.note;
      space.revision++;
      return reply(getView(space));
    }
    if (method === 'DELETE') {
      s.spaces.delete(id);
      return r.fulfill({ status: 204 });
    }
    return reply(getView(space));
  });
}
async function create(page: Page) {
  await page.goto('/spaces');
  await expect(page.getByRole('heading', { name: 'Shared spaces', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Space name', exact: true }).fill('An evening');
  await page.getByRole('button', { name: 'Create private space' }).click();
  await expect(page.getByRole('heading', { name: 'An evening', exact: true })).toBeVisible();
}
async function review(page: Page) {
  await page.getByText('Share selected text from your archive', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Collection or activity', exact: true })
    .selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button', { name: 'Load records and visits' }).click();
  await page.getByRole('button', { name: /Review record Coffee/ }).click();
  const d = page.getByRole('dialog', { name: 'Review this snapshot' });
  await expect(d.getByRole('button', { name: 'Keep reviewed snapshot' })).toBeEnabled();
  await expect(d.getByText('Source photos', { exact: false })).toHaveCount(0);
  await d.getByRole('button', { name: 'Keep reviewed snapshot' }).click();
  await expect(page.getByRole('region', { name: 'Sharing preview' })).toBeVisible();
}
async function capture(page: Page, name: string) {
  if (!process.env.WORTH_CAPTURE_UI) return;
  const directory = `${process.env.WORTH_CAPTURE_UI}/private-spaces`;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}
test('two accounts collaborate with explicit snapshots and reveal only after both seal', async ({
  page,
  archive,
}, info) => {
  const s = server();
  await setup(page, archive, 'owner', s);
  await create(page);
  await review(page);
  await expect(page.getByRole('region', { name: 'Sharing preview' })).not.toContainText('PRIVATE NOTE');
  await page.getByRole('button', { name: 'Share reviewed snapshot' }).click();
  await expect(page.getByRole('region', { name: 'Shared by owner' })).toBeVisible();
  await page.getByText(/Invitations and access ·/).click();
  await page.getByRole('textbox', { name: 'Invited email', exact: true }).fill('member@example.test');
  await page.getByRole('combobox', { name: 'Access', exact: true }).selectOption('editor');
  await page.getByRole('button', { name: 'Create invitation link' }).click();
  const link = await page.getByRole('textbox', { name: 'Invitation link', exact: true }).inputValue();
  const member = await page.context().newPage(),
    memberArchive = await mockArchive(member);
  await setup(member, memberArchive, 'member', s);
  await member.goto(link);
  await member.getByRole('button', { name: 'Accept invitation' }).click();
  await expect(member.getByRole('heading', { name: 'An evening', exact: true })).toBeVisible();
  await member
    .getByRole('textbox', { name: 'Shared note text', exact: true })
    .fill('We can keep this evening here.');
  await member.getByRole('button', { name: 'Save shared note' }).click();
  await page.getByRole('button', { name: 'Refresh shared details' }).click();
  await page.getByText('Start a two-person round', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Round name', exact: true }).fill('Tonight');
  await page.getByRole('textbox', { name: 'First option', exact: true }).fill('Tea');
  await page.getByRole('textbox', { name: 'Second option', exact: true }).fill('Coffee');
  await page
    .getByRole('combobox', { name: 'Choose one accepted member', exact: true })
    .selectOption('member');
  await page.getByRole('button', { name: 'Start round', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tonight', exact: true })).toBeVisible();
  await page
    .getByRole('group', { name: 'Your choice for Tonight' })
    .getByRole('button', { name: 'Coffee', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Reveal my choice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reveal my choice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Seal and reveal' }).click();
  await member.getByRole('button', { name: 'Refresh rounds' }).click();
  await expect(member.getByText('Your partner has revealed.', { exact: false })).toBeVisible();
  await expect(member.getByRole('heading', { name: 'Both revealed.' })).toHaveCount(0);
  await member
    .getByRole('group', { name: 'Your choice for Tonight' })
    .getByRole('button', { name: 'Tea', exact: true })
    .click();
  await member.getByRole('button', { name: 'Reveal my choice', exact: true }).click();
  await member.getByRole('dialog').getByRole('button', { name: 'Seal and reveal' }).click();
  await expect(member.getByRole('heading', { name: 'Both revealed.' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh rounds' }).click();
  await expect(page.getByRole('heading', { name: 'Both revealed.' })).toBeVisible();
  await capture(page, `owner-${info.project.name}`);
  await capture(member, `member-${info.project.name}`);
  expect((await new AxeBuilder({ page: member }).analyze()).violations).toEqual([]);
  await member.getByRole('button', { name: 'Save private copy' }).click();
  await expect(member.getByRole('status').filter({ hasText: 'Private copy saved.' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoke access for member@example.test' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke access', exact: true }).click();
  await member.getByRole('button', { name: 'Refresh shared details' }).click();
  await expect(member.getByRole('alert').filter({ hasText: 'Shared space unavailable.' })).toBeVisible();
  await member.getByRole('link', { name: 'Back to Spaces →' }).click();
  await member.getByText('An evening ·', { exact: false }).click();
  await expect(member.getByText('We can keep this evening here.', { exact: true })).toBeVisible();
  await capture(member, `private-copy-${info.project.name}`);
  await member.close();
});
test('a lost sharing reply restores its fixed preview and retries without another copy', async ({
  page,
  archive,
}) => {
  const s = server();
  await setup(page, archive, 'owner', s);
  await create(page);
  await review(page);
  s.loseShare = true;
  await page.getByRole('button', { name: 'Share reviewed snapshot' }).click();
  await expect(page.getByRole('button', { name: 'Retry exact shared snapshot' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry exact shared snapshot' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry exact shared snapshot' }).click();
  await expect(page.getByRole('region', { name: 'Sharing preview' })).toHaveCount(0);
  expect([...s.spaces.values()][0].entries).toHaveLength(1);
});
test('shared note conflicts retain the device draft and shared screens reflow', async ({
  page,
  archive,
}, info) => {
  const s = server();
  await setup(page, archive, 'owner', s);
  await create(page);
  await page
    .getByRole('textbox', { name: 'Shared note text', exact: true })
    .fill('My unfinished shared note');
  const space = [...s.spaces.values()][0];
  space.note = 'A newer saved note';
  space.revision++;
  await page.getByRole('button', { name: 'Save shared note' }).click();
  await expect(page.getByRole('alert')).toContainText('This space changed');
  await expect(page.getByRole('textbox', { name: 'Shared note text', exact: true })).toHaveValue(
    'My unfinished shared note',
  );
  await page.getByRole('button', { name: 'Refresh shared details' }).click();
  await expect(page.getByRole('heading', { name: 'Current saved note', exact: true })).toBeVisible();
  await expect(page.getByText('A newer saved note', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my text after comparing' }).click();
  await page.getByRole('button', { name: 'Save shared note' }).click();
  await expect(page.getByRole('button', { name: 'Save shared note' })).toBeDisabled();
  if (info.project.name === 'desktop')
    for (const width of [320, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await capture(page, `space-${width}`);
    }
});

test('capsule-only and shared-copy-only files have explicit restore previews', async ({ page }) => {
  const base = {
    schemaVersion: 10,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
  };
  let imported: unknown;
  await page.route('**/api/import', (r) => {
    imported = r.request().postDataJSON();
    return r.fulfill({ status: 201, json: { ids: [] } });
  });
  await page.goto('/settings');
  const capsule = {
    id: crypto.randomUUID(),
    name: 'Only a capsule',
    message: 'Unopened backup letter',
    opening: { day: '2099-01-01', zone: 'UTC', opensAt: Date.parse('2099-01-01T00:00:00Z') },
    entries: [],
    createdAt: Date.now(),
    openedAt: null,
  };
  await page.getByLabel('Choose backup', { exact: false }).setInputFiles({
    name: 'capsules-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...base, capsules: [capsule] })),
  });
  await expect(page.getByRole('region', { name: 'Capsules to restore' })).toContainText('Only a capsule');
  await expect(page.getByRole('region', { name: 'Capsules to restore' })).toContainText(
    'Unopened contents are present',
  );
  await page.getByRole('button', { name: 'Restore previewed data' }).click();
  await expect(page.getByRole('status')).toContainText('1 capsule restored');
  expect(imported).toMatchObject({ capsules: [{ name: 'Only a capsule' }] });
  const copy = {
    id: crypto.randomUUID(),
    name: 'Only a shared copy',
    note: 'Keep privately',
    entries: [],
    outcomes: [],
    savedAt: Date.now(),
  };
  await page.getByLabel('Choose backup', { exact: false }).setInputFiles({
    name: 'shared-only.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...base, sharedArchives: [copy] })),
  });
  await expect(page.getByRole('region', { name: 'Shared copies to restore' })).toContainText(
    'No invitations, live access or unrevealed choices',
  );
  await page.getByRole('button', { name: 'Restore previewed data' }).click();
  await expect(page.getByRole('status')).toContainText('1 shared copy restored');
  expect(imported).toMatchObject({ sharedArchives: [{ name: 'Only a shared copy' }] });
});

test('access ending keeps only unfinished device text available for copying', async ({ page, archive }) => {
  const s = server();
  await setup(page, archive, 'owner', s);
  await create(page);
  await page
    .getByRole('textbox', { name: 'Shared note text', exact: true })
    .fill('My own unfinished contribution');
  await review(page);
  s.spaces.clear();
  await page.getByRole('button', { name: 'Refresh shared details' }).click();
  await expect(page.getByRole('heading', { name: 'Unshared device drafts', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Recovered unshared note', exact: true })).toHaveValue(
    'My own unfinished contribution',
  );
  await expect(page.getByRole('region', { name: 'Device sharing draft' })).toContainText('Coffee');
  await expect(page.getByRole('button', { name: 'Share reviewed snapshot' })).toHaveCount(0);
});
