import { imageDimensions } from './image-dimensions';
import { wrapCardText } from './booklet';
import { collageColors, coverCollage, type CoverCollage, type CollageFrame } from './cover-collage';
export async function privateCollageImage(
  path: string,
  owner: string,
  signal: AbortSignal,
  version?: number,
): Promise<Blob> {
  if (
    !/^\/api\/(items|logs)\/[\da-f-]{36}\/photos\/[\da-f-]{36}$/.test(path) &&
    !/^\/api\/lists\/[\da-f-]{36}\/cover$/.test(path)
  )
    throw new Error('Choose a saved private photo.');
  const response = await fetch(path, {
    credentials: 'include',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    headers: {
      'X-Worth-Account': owner,
      ...(version === undefined ? {} : { 'X-Worth-Cover-Revision': String(version) }),
    },
  });
  if (response.status === 409) {
    const failure = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    if (failure?.error === 'ACCOUNT_CHANGED') window.dispatchEvent(new Event('worth:account-changed'));
  }
  if (!response.ok)
    throw new Error(
      path.includes('/lists/')
        ? 'The saved cover changed or is unavailable. Try current cover review again.'
        : 'A selected photo is unavailable. Reload its photos or remove this frame.',
    );
  const blob = await response.blob();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || !blob.size || blob.size > 900000)
    throw new Error('A selected photo has an unsupported type or size.');
  imageDimensions(new Uint8Array(await blob.arrayBuffer()), blob.type);
  signal.throwIfAborted();
  return blob;
}
export function collagePhotoPath(frame: CollageFrame) {
  return `/api/${frame.kind}/${frame.recordId}/photos/${frame.photoId}`;
}
export async function renderCollage(input: CoverCollage, owner: string, signal: AbortSignal): Promise<File> {
  const form = coverCollage.parse(input);
  if (!form.frames.length) throw new Error('Add at least one saved photo.');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not prepare the collage.');
  try {
    await document.fonts.load('22px "DM Sans"');
    signal.throwIfAborted();
    ctx.fillStyle = collageColors[form.background];
    ctx.fillRect(0, 0, 1280, 800);
    for (const frame of form.frames) {
      signal.throwIfAborted();
      const blob = await privateCollageImage(collagePhotoPath(frame), owner, signal);
      const bitmap = await createImageBitmap(blob);
      try {
        signal.throwIfAborted();
        const x = frame.x * 12.8,
          y = frame.y * 8,
          w = frame.width * 12.8,
          h = frame.height * 8;
        ctx.font = '22px "DM Sans", sans-serif';
        const lines = frame.caption
          ? wrapCardText(frame.caption, (t) => ctx.measureText(t).width, w - 24)
          : [];
        if (lines.length > 3)
          throw new Error('A caption needs more room. Widen its frame or shorten it, then prepare again.');
        const textHeight = lines.length ? lines.length * 28 + 20 : 0;
        const photoHeight = h - textHeight,
          scale = Math.min(w / bitmap.width, photoHeight / bitmap.height);
        ctx.fillStyle = '#20211c';
        ctx.fillRect(x, y, w, h);
        ctx.drawImage(
          bitmap,
          x + (w - bitmap.width * scale) / 2,
          y + (photoHeight - bitmap.height * scale) / 2,
          bitmap.width * scale,
          bitmap.height * scale,
        );
        ctx.fillStyle = '#f0ecdf';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => ctx.fillText(line, x + 12, y + photoHeight + 10 + i * 28));
      } finally {
        bitmap.close();
      }
    }
    for (const quality of [0.92, 0.8, 0.65]) {
      signal.throwIfAborted();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      signal.throwIfAborted();
      if (blob && ['image/webp', 'image/png'].includes(blob.type) && blob.size <= 900000)
        return new File([blob], `worth-cover-collage.${blob.type === 'image/webp' ? 'webp' : 'png'}`, {
          type: blob.type,
        });
    }
    throw new Error('This arrangement could not fit the cover limit. Try fewer photos.');
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
