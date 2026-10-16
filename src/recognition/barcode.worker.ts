/// <reference lib="webworker" />
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<{ image: Blob }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    const image = event.data?.image;
    if (!(image instanceof Blob) || !image.size || image.size > 10 * 1024 * 1024)
      throw new Error('Invalid photo');
    bitmap = await createImageBitmap(image);
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width > 10000 ||
      bitmap.height > 10000 ||
      bitmap.width * bitmap.height > 20000000
    )
      throw new Error('Invalid dimensions');
    const scale = Math.min(
      1,
      3000 / Math.max(bitmap.width, bitmap.height),
      Math.sqrt(6000000 / (bitmap.width * bitmap.height)),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale)),
      height = Math.max(1, Math.round(bitmap.height * scale));
    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    for (const angle of [0, 90]) {
      const canvas = new OffscreenCanvas(angle ? height : width, angle ? width : height),
        context = canvas.getContext('2d');
      if (!context) throw new Error('No canvas');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((angle * Math.PI) / 180);
      context.drawImage(bitmap, -width / 2, -height / 2, width, height);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height),
        gray = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let index = 0; index < gray.length; index++) {
        const pixel = index * 4;
        gray[index] = (data[pixel] + data[pixel + 1] * 2 + data[pixel + 2]) >> 2;
      }
      const reader = new MultiFormatReader();
      try {
        const source = new RGBLuminanceSource(gray, canvas.width, canvas.height);
        const result = reader.decode(new BinaryBitmap(new HybridBinarizer(source)), hints);
        scope.postMessage({ code: result.getText() });
        return;
      } catch {
        // A vertical barcode gets a second pass after rotating the local pixels.
      } finally {
        reader.reset();
      }
    }
    scope.postMessage({ error: true });
  } catch {
    scope.postMessage({ error: true });
  } finally {
    bitmap?.close();
  }
};
