export function coverCrop(width: number, height: number, x: number, y: number, zoom: number) {
  const size = Math.min(width, height * 1.6) / Math.max(1, Math.min(3, zoom));
  return {
    x: ((width - size) * Math.max(0, Math.min(100, x))) / 100,
    y: ((height - size / 1.6) * Math.max(0, Math.min(100, y))) / 100,
    width: size,
    height: size / 1.6,
  };
}

export async function cropCover(file: File, x: number, y: number, zoom: number): Promise<File> {
  const image = await createImageBitmap(file);
  try {
    const crop = coverCrop(image.width, image.height, x, y, zoom);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.min(1200, Math.round(crop.width)));
    canvas.height = Math.max(1, Math.round(canvas.width / 1.6));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Couldn’t prepare this cover. Try another image.');
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('Couldn’t prepare this cover. Try again.');
    return new File([blob], 'collection-cover.webp', { type: 'image/webp' });
  } finally {
    image.close();
  }
}
