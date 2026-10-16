const photoTextByteLimit = 10 * 1024 * 1024;
const formats = ['image/jpeg', 'image/png', 'image/webp'];
const ascii = (bytes: Uint8Array, from: number, count: number) =>
  String.fromCharCode(...bytes.subarray(from, from + count));

/** Read dimensions before decoding, including highly compressed oversized images. */
export function photoTextDimensions(bytes: Uint8Array, type: string): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => {
    throw new Error('Choose a complete JPEG, PNG or WebP image.');
  };
  let width = 0,
    height = 0;
  if (
    type === 'image/png' &&
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    ascii(bytes, 1, 7) === 'PNG\r\n\x1a\n' &&
    ascii(bytes, 12, 4) === 'IHDR'
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) invalid();
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 217 || marker === 218) break;
      if (marker === 216 || (marker >= 208 && marker <= 215) || marker === 1) continue;
      if (at + 2 > bytes.length) invalid();
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) invalid();
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) invalid();
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        break;
      }
      at += length;
    }
  } else if (
    type === 'image/webp' &&
    bytes.length >= 30 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 4) === 'WEBP'
  ) {
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8X') {
      if (bytes[20] & 2) throw new Error('Choose a still image instead of an animated WebP.');
      const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
      width = u24(24) + 1;
      height = u24(27) + 1;
    } else if (chunk === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    } else if (chunk === 'VP8L' && bytes[20] === 47) {
      const packed = view.getUint32(21, true);
      width = (packed & 16383) + 1;
      height = ((packed >>> 14) & 16383) + 1;
    }
  }
  if (!width || !height) invalid();
  if (width > 10000 || height > 10000 || width * height > 20000000)
    throw new Error('Choose an image up to 20 megapixels and 10,000 pixels on either side.');
  return { width, height };
}

export async function checkTextPhoto(file: File) {
  if (!formats.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > photoTextByteLimit) throw new Error('Choose an image up to 10 MB.');
  return photoTextDimensions(new Uint8Array(await file.arrayBuffer()), file.type);
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
