import { expect, test } from 'vitest';
import { coverCrop } from '../src/shared/cover-crop';
test('portrait and wide cover crops preserve the shelf ratio and move within the source', () => {
  expect(coverCrop(800, 1600, 50, 100, 1)).toEqual({ x: 0, y: 1100, width: 800, height: 500 });
  expect(coverCrop(3200, 1000, 100, 50, 2)).toEqual({ x: 2400, y: 250, width: 800, height: 500 });
  expect(coverCrop(3200, 1000, 150, -10, 0)).toEqual({ x: 1600, y: 0, width: 1600, height: 1000 });
});
