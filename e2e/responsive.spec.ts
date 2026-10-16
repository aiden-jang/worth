import { test, expect, list } from './fixtures';

for (const width of [320, 390, 430, 768, 1440]) {
  test(`cabinet layouts fit ${width}px and capture the current screens`, async ({ page, archive }, info) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [name, url, heading] of [
      ['archive', '/', 'The archive.'],
      ['directory', '/lists', 'Lists'],
      ['collection', `/lists/${list.id}`, 'My drinks'],
      ['activity', '/lists/activity', 'Gym'],
      ['settings', '/settings', 'Settings.'],
      ['search', '/search', 'Find that thing.'],
      ['patterns', '/patterns', 'Patterns'],
    ]) {
      await page.goto(url);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      if (name === 'collection')
        await page.getByRole('button', { name: 'Coffee Drink', exact: true }).click();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `${name} overflow`,
      ).toBeLessThanOrEqual(1);
      if ([390, 1440].includes(width))
        await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
    }
    archive.signedIn = false;
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your taste. A place to keep it.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    if ([390, 1440].includes(width))
      await page.screenshot({ path: info.outputPath(`landing-${width}.png`), fullPage: true });
  });
}
