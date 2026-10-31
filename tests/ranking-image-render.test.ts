// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { renderRankingImage } from '../src/shared/ranking-image';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('ranking image lines keep an emoji together at the wrapping boundary', async () => {
  const fillText = vi.fn();
  const ctx = new Proxy(
    {
      fillText,
      measureText: (text: string) => ({ width: Array.from(text).length * 100 }),
    },
    { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
  );
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['png'], { type: 'image/png' })),
  );
  const result = await renderRankingImage({ title: 'A'.repeat(8) + '👩🏽‍💻' + 'B'.repeat(20), entries: [] });
  expect(result.type).toBe('image/png');
  const headingLines = fillText.mock.calls.filter(([, x, y]) => x === 72 && (y === 267 || y === 351));
  expect(headingLines[0]?.[0]).toBe('A'.repeat(8));
  expect(headingLines[1]?.[0]).toMatch(/^👩🏽‍💻B+…$/);
});

test('only static built-in artwork is painted and missing artwork leaves a usable image', async () => {
  const sources: string[] = [];
  let fail = false;
  vi.stubGlobal(
    'Image',
    class {
      set src(value: string) {
        if (value) sources.push(value);
      }
      decode() {
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
      }
    },
  );
  const drawImage = vi.fn();
  const ctx = new Proxy(
    { drawImage, measureText: () => ({ width: 0 }) },
    {
      get: (target, key) => Reflect.get(target, key) ?? (() => {}),
    },
  );
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['png'], { type: 'image/png' })),
  );
  await renderRankingImage({ title: 'Skincare', entries: [] });
  expect(sources).toEqual(['/art/starter-covers/skincare.svg']);
  expect(drawImage).toHaveBeenCalledTimes(1);
  await renderRankingImage({ title: 'Skincare', entries: [], artwork: { object: 'plant', tone: 'clay' } });
  expect(sources.at(-1)).toBe('/art/collection-choices/plant-clay.svg');
  const painted = drawImage.mock.calls.length;
  await renderRankingImage({
    title: 'Personal collection',
    entries: [],
    artwork: { object: '../../api/private', tone: 'sage' } as never,
  });
  expect(drawImage).toHaveBeenCalledTimes(painted);
  expect(sources).toHaveLength(2);
  fail = true;
  expect((await renderRankingImage({ title: 'Drinks', entries: [] })).type).toBe('image/png');
  expect(drawImage).toHaveBeenCalledTimes(painted);
});

test('long ranking headings wrap between words before truncating', async () => {
  const fillText = vi.fn();
  const ctx = new Proxy(
    { fillText, measureText: (text: string) => ({ width: Array.from(text).length * 50 }) },
    { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
  );
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
    callback(new Blob(['png'], { type: 'image/png' })),
  );
  await renderRankingImage({ title: 'The little things I keep coming back to', entries: [] });
  expect(fillText.mock.calls.filter(([, x, y]) => x === 72 && (y === 267 || y === 351))).toEqual([
    ['The little things', 72, 267],
    ['I keep coming bac…', 72, 351],
  ]);
});
