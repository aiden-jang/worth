import { useEffect, useRef, useState } from 'react';
import { captureCode } from '../shared/code-capture';
import { checkTextPhoto } from '../shared/photo-text';

export function useBarcode(onCode: (code: string) => void) {
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState('');
  const worker = useRef<Worker | null>(null),
    generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function terminate() {
    worker.current?.terminate();
    worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.terminate();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function stop() {
    generation.current++;
    terminate();
    setBusy(false);
    setStatus('Reading stopped. Your previous code is still here.');
  }
  function reset() {
    generation.current++;
    terminate();
    setBusy(false);
    setStatus('');
    setError('');
  }
  async function read(file: File) {
    const current = ++generation.current;
    terminate();
    setBusy(true);
    setStatus('Reading the barcode on this device…');
    setError('');
    const fail = () => {
      if (current !== generation.current) return;
      generation.current++;
      terminate();
      setBusy(false);
      setStatus('');
      setError(
        'Couldn’t read a supported barcode. Try a clear, close photo with white space around one code, or type the digits.',
      );
    };
    timer.current = setTimeout(fail, 15000);
    try {
      await checkTextPhoto(file);
      if (current !== generation.current) return;
      const next = new Worker(new URL('../recognition/barcode.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = next;
      next.onerror = (event) => {
        event.preventDefault();
        fail();
      };
      next.onmessage = (event: MessageEvent) => {
        if (current !== generation.current) return;
        if (event.data.error || typeof event.data.code !== 'string') {
          fail();
          return;
        }
        try {
          const { code } = captureCode(event.data.code);
          generation.current++;
          terminate();
          setBusy(false);
          onCode(code);
          setStatus('Code read. Check it against the printed digits.');
        } catch {
          fail();
        }
      };
      next.postMessage({ image: file });
    } catch {
      fail();
    }
  }
  return { busy, status, error, read, stop, reset };
}
