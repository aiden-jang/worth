import { test, expect } from './fixtures';

for (const [path, title, section] of [
  ['/help', 'A little help', 'Something went sideways?'],
  ['/privacy', 'Privacy', 'Contact and changes'],
  ['/terms', 'Terms', 'Sharing and leaving'],
]) {
  test(`${title} contents links reach the matching section`, async ({ page }) => {
    await page.goto(path);
    await page.getByText('On this page', { exact: true }).click();
    const contents = page.getByRole('navigation', { name: `${title} sections`, exact: true });
    const link = contents.getByRole('link', { name: section, exact: true });
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(`section${href}`)).toContainText(section);
    await expect(page.getByRole('heading', { name: section, exact: true })).toBeInViewport();
  });
}

test('Settings section links keep data controls reachable', async ({ page }) => {
  await page.goto('/settings');
  const contents = page.getByRole('navigation', { name: 'Settings sections' });
  for (const name of [
    'Downloads',
    'Restore',
    'Trash',
    'Offline copy',
    'Device',
    'Deletion',
    'Account & help',
  ]) {
    const link = contents.getByRole('link', { name, exact: true });
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page.locator(`${href} h2`)).toBeInViewport();
  }
});
