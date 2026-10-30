import { mkdir } from 'node:fs/promises';
import { test, expect, list } from './fixtures';

test('working pages keep shared type, readable fields and stable cards after navigation', async ({
  page,
  archive,
}, info) => {
  test.setTimeout(60_000);
  const emptyDirectories: Record<string, unknown> = {
    '/boards': { boards: [] },
    '/connections': { connections: [] },
    '/spaces': { spaces: [] },
    '/spaces/archives': { archives: [] },
    '/capsules': { capsules: [] },
    '/receipts': { receipts: [] },
  };
  await page.route('**/api/**', (route) => {
    const key = new URL(route.request().url()).pathname.replace('/api', '');
    return key in emptyDirectories ? route.fulfill({ json: emptyDirectories[key] }) : route.fallback();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const phone = info.project.name === 'phone';
  const routes = [
    ['home', '/'],
    ['directory', '/lists'],
    ['create', '/lists?create=1&kind=collection'],
    ['collection', `/lists/${list.id}`],
    ['activity', '/lists/activity'],
    ['search', '/search'],
    ['inbox', '/inbox'],
    ['look-back', '/patterns'],
    ['insights', '/patterns?view=insights'],
    ['memories', '/patterns/remember'],
    ['settings', '/settings'],
    ['quick', '/quick'],
    ['capture', '/capture'],
    ['read', '/read'],
    ['code', '/code'],
    ['receipts', '/receipts'],
    ['receipt-capture', '/receipts/new'],
    ['boards', '/patterns/boards'],
    ['calendar', '/patterns/calendar'],
    ['summary', '/patterns/look-back'],
    ['connections', '/patterns/connections'],
    ['field-guide', '/patterns/field-guide'],
    ['spaces', '/spaces'],
    ['capsules', '/capsules'],
    ['new-capsule', '/capsules/new'],
  ];
  for (const [name, path] of routes) {
    await page.goto(path);
    await expect(page.locator('main h1')).toHaveCSS('font-size', phone ? '36px' : '48px');
    await page.evaluate(() => document.fonts.ready);
    if (name === 'inbox')
      await expect(page.locator('.main-nav a[href="/inbox"]')).toHaveAttribute('aria-current', 'page');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      `${name} fits the viewport`,
    ).toBeLessThanOrEqual(1);
    if (phone) {
      const undersized = await page.locator('main').evaluate((main) =>
        Array.from(main.querySelectorAll('input, select, textarea'))
          .filter((field) => {
            const rect = field.getBoundingClientRect();
            return (
              rect.width > 2 &&
              rect.height > 2 &&
              !['checkbox', 'radio', 'file', 'hidden', 'range', 'color'].includes(
                (field as HTMLInputElement).type,
              ) &&
              Number.parseFloat(getComputedStyle(field).fontSize) < 16
            );
          })
          .map((field) => (field as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? field.tagName),
      );
      if (name === 'new-capsule')
        await expect(page.getByRole('textbox', { name: 'Capsule name', exact: true })).toHaveCSS(
          'border-radius',
          '12px',
        );
      expect(undersized, `${name} fields avoid small-text phone zoom`).toEqual([]);
    }
    if (process.env.WORTH_WORKSPACE_QA) {
      await mkdir(process.env.WORTH_WORKSPACE_QA, { recursive: true });
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${process.env.WORTH_WORKSPACE_QA}/${name}-${info.project.name}.png` });
    }
  }
  // Lazy pages must not change Home's presentation when returning through the app.
  await page.getByRole('link', { name: 'Home', exact: true }).filter({ visible: true }).click();
  const card = page.locator('.home-collection-grid a').first();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('flex-direction', 'row');
  expect((await card.boundingBox())!.height).toBeLessThan(180);
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: list.name, exact: true })).toBeVisible();
  expect(archive.writes).toHaveLength(0);
});
