import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test, expect, item, list } from './fixtures';
import { collectionOptions } from './navigation';

for (const custom of [false, true]) {
  test(`ranking image previews and shares the same private-photo-free PNG with ${custom ? 'chosen artwork and a long title' : 'starter artwork'}`, async ({
    page,
    archive,
  }, info) => {
    archive.list.name = custom
      ? 'The little things I keep coming back to — collected over a very long while'
      : 'Skincare';
    archive.list.artwork = custom ? { object: 'plant', tone: 'clay' } : null;
    const names = [
      'The moisturizer I keep coming back to when every other one disappoints',
      'Daily sunscreen — light finish, no white cast',
      'Gentle cleanser for the end of a long day',
      '👩🏽‍💻 Desk-side hand cream',
      'A very small bottle with an unnecessarily long name',
    ];
    archive.items = names.map((title, index) => ({
      ...item,
      id: `pick-${index}`,
      title,
      type: ['Moisturizer', 'Sunscreen', 'Cleanser', 'Cream', 'Serum'][index]!,
      note: 'PRIVATE note stays in the archive',
      startedOn: '2026-10-14',
      logCount: 3,
    }));
    archive.list.rankedIds = archive.items.map(({ id }) => id);
    archive.list.itemCount = archive.list.rankedCount = archive.items.length;
    await page.addInitScript(() => {
      const blobs = new Map<string, Blob>();
      const createObjectURL = URL.createObjectURL.bind(URL);
      const revokeObjectURL = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = createObjectURL(blob);
        blobs.set(url, blob as Blob);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        blobs.delete(url);
        revokeObjectURL(url);
      };
      Object.assign(window, { rankingImageBlobs: blobs });
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async ({ files }: ShareData) => {
          const file = files![0]!;
          const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
          Object.assign(window, {
            rankingImageShared: {
              name: file.name,
              type: file.type,
              hash: Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''),
            },
          });
        },
      });
    });
    await page.goto(`/lists/${list.id}`);
    await collectionOptions(page);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: archive.list.name });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText('PRIVATE');
    const save = dialog.getByRole('button', { name: 'Save ranking image', exact: true });
    await expect(save).toBeEnabled();
    if (process.env.WORTH_RANKING_IMAGE_QA) {
      await mkdir(process.env.WORTH_RANKING_IMAGE_QA, { recursive: true });
      await page.screenshot({
        path: `${process.env.WORTH_RANKING_IMAGE_QA}/${custom ? 'chosen' : 'starter'}-${info.project.name}-dialog.png`,
      });
    }
    const preview = dialog.getByText('Preview image', { exact: true });
    await preview.focus();
    await page.keyboard.press('Enter');
    const image = dialog.getByRole('img', { name: `Ranking image for ${archive.list.name}` });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1080);
    const pixels = await image.evaluate(async (node: HTMLImageElement) => {
      const blobs = Reflect.get(window, 'rankingImageBlobs') as Map<string, Blob>;
      const blob = await blobs.get(node.src)!.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', blob);
      const canvas = document.createElement('canvas');
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(node, 0, 0);
      return {
        hash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
        artworkColor: Array.from(ctx.getImageData(828, 68, 1, 1).data),
      };
    });
    expect(pixels.artworkColor).toEqual(custom ? [205, 176, 164, 255] : [190, 199, 173, 255]);
    const downloadEvent = page.waitForEvent('download');
    await save.click();
    const download = await downloadEvent;
    const bytes = await readFile((await download.path())!);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pixels.hash);
    await dialog.getByRole('button', { name: 'Share ranking image', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, 'rankingImageShared')))
      .toEqual({
        name: download.suggestedFilename(),
        type: 'image/png',
        hash: pixels.hash,
      });
    expect(archive.writes).toEqual([]);
    for (const width of info.project.name === 'desktop' && custom
      ? [1440, 320, 430, 768]
      : [page.viewportSize()!.width]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 780 });
      await image.scrollIntoViewIfNeeded();
      expect((await image.boundingBox())!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      if (process.env.WORTH_RANKING_IMAGE_QA) {
        await mkdir(process.env.WORTH_RANKING_IMAGE_QA, { recursive: true });
        await page.screenshot({
          path: `${process.env.WORTH_RANKING_IMAGE_QA}/${custom ? 'chosen' : 'starter'}-${info.project.name}-${width}.png`,
        });
      }
    }
    if (process.env.WORTH_RANKING_IMAGE_QA)
      await writeFile(
        `${process.env.WORTH_RANKING_IMAGE_QA}/${custom ? 'chosen' : 'starter'}-${info.project.name}-export.png`,
        bytes,
      );
  });
}
