import { checkTextPhoto } from './photo-text';
/** Always re-encode displayed pixels; the attachment never keeps original EXIF/XMP. */
export async function prepareReceiptCopy(file: File): Promise<Blob> {
  await checkTextPhoto(file);
  const bitmap = await createImageBitmap(file),
    canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('2d');
    if (!context)
      throw new Error('This browser cannot prepare an attachment. You can save text without a photo.');
    for (const [maxSide, quality] of [
      [3000, 0.94],
      [2400, 0.9],
      [1800, 0.88],
      [1200, 0.84],
    ]) {
      const scale = Math.min(
        1,
        maxSide / Math.max(bitmap.width, bitmap.height),
        Math.sqrt(6000000 / (bitmap.width * bitmap.height)),
      );
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (maxSide === 3000) {
        const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (png && png.size <= 900000) return png;
      }
      const encoded = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (encoded && encoded.size <= 900000) return encoded;
    }
    throw new Error(
      'The attachment copy is still too large. Choose a smaller photo or save the text without it.',
    );
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
