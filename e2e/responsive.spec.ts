import { entryOptions } from './navigation';
import { test, expect, list } from './fixtures';

for (const width of [320, 390, 430, 768, 1440]) {
  test(`cabinet layouts fit ${width}px and capture the current screens`, async ({ page, archive }, info) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const [name, url, heading] of [
      ['archive', '/', 'Good to keep.'],
      ['directory', '/lists', 'Collections'],
      ['collection', `/lists/${list.id}`, 'My drinks'],
      ['activity', '/lists/activity', 'Gym'],
      ['settings', '/settings', 'Settings.'],
      ['search', '/search', 'Find that thing.'],
      ['patterns', '/patterns', 'Look back.'],
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
      if (process.env.WORTH_CAPTURE_UI && [390, 1440].includes(width))
        await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
      if (name === 'collection') {
        await entryOptions(page);
        await page.getByRole('button', { name: 'Select items', exact: true }).click();
        await page.getByRole('button', { name: 'Select visible', exact: true }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          'selection overflow',
        ).toBeLessThanOrEqual(1);
        const target = await page.locator('.collection-select').first().boundingBox();
        expect(target?.width).toBeGreaterThanOrEqual(44);
        expect(target?.height).toBeGreaterThanOrEqual(44);
        if (process.env.WORTH_CAPTURE_UI && [390, 1440].includes(width))
          await page.screenshot({ path: info.outputPath(`selection-${width}.png`), fullPage: true });
        await page
          .getByRole('region', { name: 'Selected items' })
          .getByRole('button', { name: 'Move to Trash', exact: true })
          .click();
        const dialog = page.getByRole('dialog', { name: 'Move to Trash' });
        expect(
          await dialog.evaluate((node) => node.scrollWidth - node.clientWidth),
          'selection dialog overflow',
        ).toBeLessThanOrEqual(1);
        if (process.env.WORTH_CAPTURE_UI && [390, 1440].includes(width))
          await page.screenshot({ path: info.outputPath(`trash-confirm-${width}.png`), fullPage: false });
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
    }
    archive.signedIn = false;
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your taste. A place to keep it.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
      1,
    );
    if (process.env.WORTH_CAPTURE_UI && [390, 1440].includes(width))
      await page.screenshot({ path: info.outputPath(`landing-${width}.png`), fullPage: true });
  });
}
