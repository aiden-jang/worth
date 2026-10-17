import { expect, test } from 'vitest';
import { checkTextPhoto } from '../src/shared/photo-text';
import { imageDimensions } from '../src/shared/image-dimensions';

function png(width: number, height: number) {
  const bytes = new Uint8Array(32),
    view = new DataView(bytes.buffer);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
test('photo text bounds reject oversized dimensions before image decoding', () => {
  expect(imageDimensions(png(800, 600), 'image/png')).toEqual({ width: 800, height: 600 });
  for (const [width, height] of [
    [0, 600],
    [10001, 3],
    [5000, 5000],
    [0xffffffff, 0xffffffff],
  ])
    expect(() => imageDimensions(png(width, height), 'image/png')).toThrow();
  expect(() => imageDimensions(png(800, 600), 'image/jpeg')).toThrow();
  expect(() => imageDimensions(new TextEncoder().encode('<svg>not a PNG</svg>'), 'image/png')).toThrow();
});
test('JPEG and WebP dimensions are read without decoding pixels', () => {
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 8, 8, 2, 88, 3, 32, 0]);
  expect(imageDimensions(jpeg, 'image/jpeg')).toEqual({ width: 800, height: 600 });
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode('RIFF'), 0);
  webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
  webp.set([31, 3, 0, 87, 2, 0], 24);
  expect(imageDimensions(webp, 'image/webp')).toEqual({ width: 800, height: 600 });
  webp[20] = 2;
  expect(() => imageDimensions(webp, 'image/webp')).toThrow('still image');
  expect(() => imageDimensions(jpeg.slice(0, -4), 'image/jpeg')).toThrow();
});
test('unsupported file types and byte limits fail before reading the file', async () => {
  await expect(checkTextPhoto(new File(['x'], 'not.svg', { type: 'image/svg+xml' }))).rejects.toThrow('JPEG');
  await expect(checkTextPhoto(new File([], 'empty.png', { type: 'image/png' }))).rejects.toThrow('10 MB');
  await expect(
    checkTextPhoto(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })),
  ).rejects.toThrow('10 MB');
});
