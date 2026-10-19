import { expect, test } from 'vitest';
import { coverCollage, fitCollageFrame, type CollageFrame } from '../src/shared/cover-collage';
const frame: CollageFrame = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'items',
  recordId: '22222222-2222-4222-8222-222222222222',
  photoId: '33333333-3333-4333-8333-333333333333',
  name: 'Saved source',
  caption: 'My caption',
  x: 10,
  y: 10,
  width: 50,
  height: 50,
};
test('collage frames fit the cover and retain separate immutable source references', () => {
  const moved = fitCollageFrame(frame, 'x', 90);
  expect(moved.x).toBe(50);
  expect(moved.photoId).toBe(frame.photoId);
  const widened = fitCollageFrame(moved, 'width', 100);
  expect(widened.width).toBe(50);
  const lowered = fitCollageFrame(frame, 'y', 100);
  expect(lowered.y).toBe(50);
  expect(fitCollageFrame(lowered, 'height', 100).height).toBe(50);
  expect(coverCollage.safeParse({ frames: [moved], background: 'sage' }).success).toBe(true);
  expect(coverCollage.safeParse({ frames: [{ ...frame, x: 90 }], background: 'sage' }).success).toBe(false);
  expect(coverCollage.safeParse({ frames: [frame, frame], background: 'sage' }).success).toBe(false);
  expect(
    coverCollage.safeParse({ frames: [{ ...frame, caption: 'x'.repeat(81) }], background: 'sage' }).success,
  ).toBe(false);
  expect(
    coverCollage.safeParse({ frames: [{ ...frame, url: 'https://external.test' }], background: 'sage' })
      .success,
  ).toBe(false);
  expect(
    coverCollage.safeParse({
      frames: Array.from({ length: 7 }, (_, i) => ({
        ...frame,
        id: `${i}1111111-1111-4111-8111-111111111111`,
      })),
      background: 'dark',
    }).success,
  ).toBe(false);
});

import { afterEach, vi } from 'vitest';
import { privateCollageImage } from '../src/shared/collage-export';
const path = '/api/items/22222222-2222-4222-8222-222222222222/photos/33333333-3333-4333-8333-333333333333';
afterEach(() => vi.unstubAllGlobals());
test('collage image reads bind the account and refuse external or unbounded image sources', async () => {
  const bytes = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pJ8AAAAASUVORK5CYII='),
    (c) => c.charCodeAt(0),
  );
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  await expect(privateCollageImage('https://external.test/photo', 'owner', signal)).rejects.toThrow(
    'saved private',
  );
  expect(fetcher).not.toHaveBeenCalled();
  const image = await privateCollageImage(path, 'owner', signal);
  expect(image.size).toBe(bytes.length);
  expect(fetcher).toHaveBeenCalledWith(
    path,
    expect.objectContaining({ credentials: 'include', headers: { 'X-Worth-Account': 'owner' } }),
  );
  fetcher.mockResolvedValue(
    new Response(new Uint8Array(900001), { headers: { 'Content-Type': 'image/png' } }),
  );
  await expect(privateCollageImage(path, 'owner', signal)).rejects.toThrow('type or size');
  const oversized = bytes.slice();
  new DataView(oversized.buffer).setUint32(16, 10001);
  fetcher.mockResolvedValue(new Response(oversized, { headers: { 'Content-Type': 'image/png' } }));
  await expect(privateCollageImage(path, 'owner', signal)).rejects.toThrow('20 megapixels');
});
test('collage image account mismatches trigger the shared boundary without treating unrelated failures as account switches', async () => {
  const changed = vi.fn();
  window.addEventListener('worth:account-changed', changed);
  try {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'COVER_CHANGED' }), { status: 409 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(privateCollageImage(path, 'owner', new AbortController().signal)).rejects.toThrow(
      'unavailable',
    );
    expect(changed).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: 'ACCOUNT_CHANGED' }), { status: 409 }));
    await expect(privateCollageImage(path, 'owner', new AbortController().signal)).rejects.toThrow(
      'unavailable',
    );
    expect(changed).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener('worth:account-changed', changed);
  }
});
