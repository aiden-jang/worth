import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';
import type { Page } from '@playwright/test';
import type { WidgetDevice } from '../src/shared/widgets';
const challenge = 'A'.repeat(43),
  state = 'B'.repeat(43),
  code = 'C'.repeat(43);
const connect = `/widgets/connect?${new URLSearchParams({ challenge, state, platform: 'ios', name: 'Aiden’s iPhone' })}`;
async function capture(page: Page, name: string, project: string) {
  if (!process.env.WORTH_WIDGET_QA) return;
  await mkdir(process.env.WORTH_WIDGET_QA, { recursive: true });
  await page.screenshot({ path: `${process.env.WORTH_WIDGET_QA}/${name}-${project}.png`, fullPage: true });
}
async function axe(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);
}

test('widget approval reviews selected collections and a pending request can be canceled', async ({
  page,
  archive,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const archived = {
    ...list,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Earlier favorites',
    archived: true,
  };
  archive.extraLists = [archived];
  let approved: unknown;
  const canceled: string[] = [];
  await page.route('**/api/widgets/**', async (route) => {
    if (route.request().method() === 'POST') {
      approved = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        json: {
          callback: `com.aidenjang.worth:/widget-callback?code=${code}&state=${state}`,
          requestId: 'request-id',
          expiresAt: Date.now() + 300000,
        },
      });
    }
    canceled.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 204 });
  });
  await page.goto(connect);
  await expect(page.getByRole('heading', { name: 'Connect widgets.', exact: true })).toBeVisible();
  const submit = page.getByRole('button', { name: 'Connect widgets', exact: true });
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Earlier favorites/ })).toBeVisible();
  await page.getByRole('checkbox', { name: /My drinks/ }).check();
  await capture(page, 'approval', info.project.name);
  await axe(page);
  await submit.click();
  expect(approved).toEqual({
    challenge,
    state,
    platform: 'ios',
    name: 'Aiden’s iPhone',
    collectionIds: [list.id],
  });
  await expect(page.getByRole('link', { name: 'Return to Worth companion' })).toHaveAttribute(
    'href',
    `com.aidenjang.worth:/widget-callback?code=${code}&state=${state}`,
  );
  await page.getByRole('button', { name: 'Cancel connection request' }).click();
  await expect(submit).toBeEnabled();
  expect(canceled).toEqual(['/api/widgets/devices/request-id']);
  await expect(page.getByRole('checkbox', { name: /My drinks/ })).toBeChecked();
});

test('widget connection errors preserve choices and reject an altered callback', async ({
  page,
  archive,
}) => {
  void archive;
  let attempt = 0;
  await page.route('**/api/widgets/authorize', async (route) => {
    attempt++;
    return attempt === 1
      ? route.fulfill({ status: 409, json: { message: 'Collection changed. Refresh and retry.' } })
      : route.fulfill({
          status: 201,
          json: { callback: `https://elsewhere.test/?code=${code}&state=${state}`, requestId: 'bad' },
        });
  });
  await page.goto(connect);
  await page.getByRole('checkbox', { name: /My drinks/ }).check();
  await page.getByRole('button', { name: 'Connect widgets', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Collection changed');
  await expect(page.getByRole('checkbox', { name: /My drinks/ })).toBeChecked();
  await page.getByRole('button', { name: 'Connect widgets', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not confirm');
  await expect(page.getByRole('link', { name: 'Return to Worth companion' })).toHaveCount(0);
});

test('widget approval limits selection and wraps long names at narrow widths', async ({ page, archive }) => {
  archive.extraLists = Array.from({ length: 6 }, (_, i) => ({
    ...list,
    id: `22222222-2222-4222-8222-${String(i).padStart(12, '0')}`,
    name: `${i} A very long collection name ${'uninterrupted'.repeat(8)}`,
  }));
  await page.goto(connect);
  const choices = page.getByRole('checkbox');
  await expect(choices).toHaveCount(7);
  for (let i = 0; i < 5; i++) await choices.nth(i).check();
  await expect(choices.nth(5)).toBeDisabled();
  await choices.nth(0).uncheck();
  await expect(choices.nth(5)).toBeEnabled();
  for (const width of [320, 430, 768]) {
    await page.setViewportSize({ width, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('widget request validation and signed-out sign-in keep a reviewed return path', async ({
  page,
  archive,
}, info) => {
  await page.goto('/widgets/connect?challenge=invalid');
  await expect(page.getByRole('heading', { name: 'Start from the companion.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect widgets', exact: true })).toHaveCount(0);
  archive.signedIn = false;
  await page.goto(connect);
  const login = new URL(
    (await page.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href')) ?? '',
  );
  expect([...login.searchParams.values()].some((value) => value.endsWith(connect))).toBe(true);
  await capture(page, 'signin', info.project.name);
  await axe(page);
});

test('widget settings show scoped connected and pending devices with recoverable revocation', async ({
  page,
  archive,
}, info) => {
  void archive;
  let requests = 0,
    fail = true;
  const device: WidgetDevice = {
    id: 'connected',
    name: 'Aiden’s iPhone',
    platform: 'ios',
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    collections: [{ id: list.id, name: list.name }],
  };
  let devices = [device],
    pending = [{ ...device, id: 'pending', name: 'Android tablet', platform: 'android' as const }];
  await page.route('**/api/widgets/**', async (route) => {
    if (route.request().method() === 'GET') {
      requests++;
      return route.fulfill({ json: { devices, requests: pending } });
    }
    if (fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { message: 'Could not revoke. Try again.' } });
    }
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    devices = devices.filter((d) => d.id !== id);
    pending = pending.filter((d) => d.id !== id);
    return route.fulfill({ status: 204 });
  });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings.', exact: true })).toBeVisible();
  expect(requests).toBe(0);
  await page.getByText('Widget connections', { exact: true }).click();
  const settings = page.locator('.widget-connections');
  await expect(settings.getByRole('button', { name: 'Revoke access' })).toBeVisible();
  await settings.scrollIntoViewIfNeeded();
  await capture(page, 'connections', info.project.name);
  await axe(page);
  await settings.getByRole('button', { name: 'Revoke access' }).click();
  await expect(settings.getByRole('alert')).toContainText('Could not revoke');
  await expect(settings.getByText('Aiden’s iPhone', { exact: true })).toBeVisible();
  await settings.getByRole('button', { name: 'Revoke access' }).click();
  await expect(settings.getByText('Aiden’s iPhone', { exact: true })).toHaveCount(0);
  await settings.getByRole('button', { name: 'Cancel request' }).click();
  await expect(settings).toContainText('No widget connections.');
});

test('empty widget collection choices and failed connection loading are actionable', async ({
  page,
  archive,
}) => {
  archive.list.archived = true;
  await page.route('**/api/lists?archived=1', (route) => route.fulfill({ json: { lists: [] } }));
  await page.goto(connect);
  await expect(page.getByRole('link', { name: 'New collection', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect widgets', exact: true })).toBeDisabled();
  let fail = true;
  await page.route('**/api/widgets/devices', (route) =>
    fail
      ? route.fulfill({ status: 503, json: { message: 'Connection list unavailable.' } })
      : route.fulfill({ json: { devices: [], requests: [] } }),
  );
  await page.goto('/settings');
  await page.getByText('Widget connections', { exact: true }).click();
  await expect(page.locator('.widget-connections').getByRole('alert')).toContainText(
    'Connection list unavailable',
  );
  fail = false;
  await page.locator('.widget-connections').getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.widget-connections')).toContainText('No widget connections.');
});
