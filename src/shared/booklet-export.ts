import { imageDimensions } from './image-dimensions';
import regularFont from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url';
import mediumFont from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url';
import { bookletHtml, wrapCardText, type BookletData, type RecommendationCard } from './booklet';

async function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read an export image.'));
    reader.readAsDataURL(blob);
  });
}

async function photo(url: string, signal?: AbortSignal): Promise<string> {
  if (!/^\/api\/items\/[^/]+\/photo\?v=\d+$/.test(url))
    throw new Error('Choose a photo from this collection.');
  const response = await fetch(url, {
    credentials: 'include',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('A selected photo is unavailable. Try again, or turn off photos.');
  const blob = await response.blob();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 900000)
    throw new Error('A selected photo has an unsupported type or size.');
  try {
    imageDimensions(new Uint8Array(await blob.arrayBuffer()), blob.type);
  } catch {
    throw new Error(
      'A selected photo is unsupported or exceeds 20 megapixels. Choose a smaller still photo, or turn off photos.',
    );
  }
  const image = new Image();
  const canvas = document.createElement('canvas');
  const cancel = () => {
    image.src = '';
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted();
    image.src = await dataUrl(blob);
    try {
      await image.decode();
    } catch {
      throw new Error('A selected photo could not be opened. Try again, or turn off photos.');
    }
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photo. Turn off photos to continue.');
    // Encode displayed pixels, rather than carrying EXIF/XMP into a shared file.
    for (const side of [1600, 1200, 900]) {
      signal?.throwIfAborted();
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, blob.type, 0.9));
      signal?.throwIfAborted();
      if (
        encoded &&
        ['image/jpeg', 'image/png', 'image/webp'].includes(encoded.type) &&
        encoded.size <= 900000
      )
        return await dataUrl(encoded);
    }
    throw new Error('A selected photo could not fit the export. Choose a smaller photo, or turn off photos.');
  } finally {
    signal?.removeEventListener('abort', cancel);
    image.src = '';
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function prepareBooklet(
  data: BookletData,
  signal?: AbortSignal,
): Promise<{ html: string; data: BookletData }> {
  const fonts = await Promise.all(
    (
      [
        { url: regularFont, weight: 400 },
        { url: mediumFont, weight: 500 },
      ] as const
    ).map(async ({ url, weight }) => {
      const response = await fetch(url, {
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Could not load the booklet font. Try again.');
      return {
        weight,
        data: await dataUrl(new Blob([await response.arrayBuffer()], { type: 'font/woff2' })),
      };
    }),
  );
  const entries = [];
  for (const entry of data.entries)
    entries.push({ ...entry, ...(entry.photo ? { photo: await photo(entry.photo, signal) } : {}) });
  const prepared = { ...data, entries };
  return { html: bookletHtml(prepared, fonts), data: prepared };
}

export async function renderRecommendationCard(
  data: RecommendationCard,
  signal?: AbortSignal,
): Promise<Blob> {
  await document.fonts.ready;
  const image = data.photo ? new Image() : null;
  if (image && data.photo) {
    image.src = await photo(data.photo, signal);
    await image.decode();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image creation is unavailable in this browser.');
  ctx.font = '500 72px "DM Sans", sans-serif';
  const titleRows = wrapCardText(data.title, (text) => ctx.measureText(text).width, 880);
  ctx.font = '400 34px "DM Sans", sans-serif';
  const messageRows = data.message
    ? wrapCardText(data.message, (text) => ctx.measureText(text).width, 880)
    : [];
  ctx.font = '400 26px "DM Sans", sans-serif';
  const recipientRows = data.recipient
    ? wrapCardText(`For ${data.recipient}`, (text) => ctx.measureText(text).width, 880)
    : [];
  const typeRows = data.type ? wrapCardText(data.type, (text) => ctx.measureText(text).width, 880) : [];
  const collectionRows = data.collection
    ? wrapCardText(`From ${data.collection}`, (text) => ctx.measureText(text).width, 880)
    : [];
  canvas.height =
    316 +
    titleRows.length * 84 +
    recipientRows.length * 34 +
    typeRows.length * 34 +
    collectionRows.length * 34 +
    messageRows.length * 46 +
    (image ? 500 : 0);
  ctx.fillStyle = '#181915';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#eae5d5';
  ctx.beginPath();
  ctx.roundRect(40, 40, 1000, canvas.height - 80, 30);
  ctx.fill();
  let y = 120;
  const lines = (rows: string[], font: string, lineHeight: number, color = '#181915') => {
    ctx.font = font;
    ctx.fillStyle = color;
    for (const row of rows) {
      ctx.fillText(row, 100, y);
      y += lineHeight;
    }
  };
  lines(recipientRows, '400 26px "DM Sans", sans-serif', 34, '#626456');
  y += 40;
  lines(titleRows, '500 72px "DM Sans", sans-serif', 84);
  lines(typeRows, '400 26px "DM Sans", sans-serif', 34, '#626456');
  if (image) {
    const ratio = Math.min(880 / image.naturalWidth, 440 / image.naturalHeight);
    const width = image.naturalWidth * ratio,
      height = image.naturalHeight * ratio;
    ctx.drawImage(image, 100 + (880 - width) / 2, y + 20 + (440 - height) / 2, width, height);
    y += 500;
  }
  y += 24;
  lines(messageRows, '400 34px "DM Sans", sans-serif', 46);
  y += 16;
  lines(collectionRows, '400 26px "DM Sans", sans-serif', 34, '#626456');
  ctx.font = '500 26px "DM Sans", sans-serif';
  ctx.fillStyle = '#626456';
  ctx.fillText('worth', 100, canvas.height - 100);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the recommendation card.'))),
      'image/png',
    ),
  );
}

export function saveLocalFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
