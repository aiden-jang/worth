/// <reference lib="webworker" />
import { createWorker, OEM } from 'tesseract.js';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<{ image: Blob }>) => {
  if (!event.data || !(event.data.image instanceof Blob) || event.data.image.size > 12 * 1024 * 1024) {
    scope.postMessage({ type: 'error' });
    return;
  }
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    const base = new URL('/ocr/v7/', scope.location.origin);
    worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: new URL('worker.min.js', base).href,
      corePath: new URL('core/', base).href,
      langPath: new URL('lang', base).href,
      workerBlobURL: false,
      legacyCore: false,
      legacyLang: false,
      cacheMethod: 'none',
      logger: (message) =>
        scope.postMessage({
          type: 'progress',
          reading: message.status === 'recognizing text',
          progress: message.progress,
        }),
      errorHandler: () => scope.postMessage({ type: 'error' }),
    });
    const { data } = await worker.recognize(event.data.image);
    scope.postMessage({ type: 'result', text: data.text });
  } catch {
    scope.postMessage({ type: 'error' });
  } finally {
    await worker?.terminate();
  }
};
