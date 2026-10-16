// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { renderRankingImage } from '../src/shared/ranking-image';

afterEach(() => vi.restoreAllMocks());

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
