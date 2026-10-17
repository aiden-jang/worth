import { imageDimensions } from './image-dimensions';
export async function preparePhoto(file: File): Promise<Blob> {
  const maxBytes = 900_000;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a photo up to 20 MB.');
  imageDimensions(new Uint8Array(await file.arrayBuffer()), file.type);
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This photo could not be prepared. Try another one.');
  }

  try {
    for (const [maxSide, quality] of [
      [1200, 0.78],
      [950, 0.68],
      [750, 0.55],
    ]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (compressed && compressed.size <= maxBytes) return compressed;
    }
    throw new Error('This photo is still too large. Try a smaller one.');
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
