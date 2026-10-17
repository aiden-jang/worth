import { imageDimensions } from './image-dimensions';
const photoTextByteLimit = 10 * 1024 * 1024;
const formats = ['image/jpeg', 'image/png', 'image/webp'];
export async function checkTextPhoto(file: File) {
  if (!formats.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > photoTextByteLimit) throw new Error('Choose an image up to 10 MB.');
  return imageDimensions(new Uint8Array(await file.arrayBuffer()), file.type);
}

export async function prepareTextPhoto(file: File): Promise<Blob> {
  await checkTextPhoto(file);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(
      1,
      3000 / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(6000000 / (bitmap.width * bitmap.height)),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser couldn’t prepare the image. Paste text instead.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
    const png = await encode('image/png');
    if (png && png.size <= 12 * 1024 * 1024) return png;
    const jpeg = await encode('image/jpeg');
    if (jpeg && jpeg.size <= 12 * 1024 * 1024) return jpeg;
    throw new Error('This image is too large to read here. Choose a smaller photo or paste text.');
  } finally {
    bitmap.close();
  }
}
