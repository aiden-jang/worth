import AxeBuilder from '@axe-core/playwright';
import { test, expect, list } from './fixtures';

test('main pages identify their browser tabs after leaving a collection', async ({ page }) => {
  await page.goto(`/lists/${list.id}`);
  await expect(page).toHaveTitle('My drinks · worth');
  for (const [path, title] of [
    ['/', 'Home'],
    ['/lists', 'Collections'],
    ['/lists?kind=collection', 'Collections'],
    ['/lists?kind=activity', 'Activity'],
    ['/patterns', 'Look back'],
    ['/search', 'Search'],
    ['/settings', 'Settings'],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(`${title} · worth`);
  }
});

test('mobile navigation returns focus on Escape and resets across a desktop resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  await toggle.click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Search' })
    .focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.mobile-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
});

test('closing Add on a phone restores its persistent button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Keep something.' });
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeFocused();
});

test('global dialogs have names and keyboard navigation can skip the repeated rail', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good to keep.', exact: true })).toBeVisible();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('?');
  const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(shortcuts).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog', { name: 'Keep something.' })).toBeVisible();
});
