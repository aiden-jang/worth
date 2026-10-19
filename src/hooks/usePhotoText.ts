import { useEffect, useRef, useState } from 'react';
import { prepareTextPhoto } from '../shared/photo-text';

export function usePhotoText(onText: (text: string) => void) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
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
    setProgress(null);
    setStatus('Reading stopped. Your previous text is still here.');
  }
  function reset() {
    generation.current++;
    terminate();
    setBusy(false);
    setProgress(null);
    setStatus('');
    setError('');
  }
  async function read(file: File) {
    const current = ++generation.current;
    terminate();
    setBusy(true);
    setProgress(null);
    setError('');
    setStatus('Preparing the photo on this device…');
    const fail = () => {
      if (current !== generation.current) return;
      generation.current++;
      terminate();
      setBusy(false);
      setProgress(null);
      setStatus('');
      setError(
        'Couldn’t read this photo here. Try a clearer photo, reconnect to load the reading files, or paste text below.',
      );
    };
    timer.current = setTimeout(fail, 120000);
    try {
      const image = await prepareTextPhoto(file);
      if (current !== generation.current) return;
      // Terminating this parent also terminates the library’s nested worker, including initialization.
      const next = new Worker(new URL('../recognition/photo-text.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = next;
      next.onerror = (event) => {
        event.preventDefault();
        fail();
      };
      next.onmessage = (event: MessageEvent) => {
        if (current !== generation.current) return;
        if (event.data.type === 'error') {
          fail();
          return;
        }
        if (event.data.type === 'progress') {
          const value = event.data.progress;
          setProgress(
            event.data.reading && Number.isFinite(value)
              ? Math.max(0, Math.min(1, Math.round(value * 10) / 10))
              : null,
          );
          setStatus(event.data.reading ? 'Reading text on this device…' : 'Loading reading files…');
        }
        if (event.data.type === 'result' && typeof event.data.text === 'string') {
          generation.current++;
          terminate();
          setBusy(false);
          setProgress(null);
          onText(event.data.text);
          setStatus(
            event.data.text.trim()
              ? 'Text read. Check the words before keeping them.'
              : 'No text found. Try a sharper photo or paste text below.',
          );
        }
      };
      next.postMessage({ image });
    } catch {
      fail();
    }
  }
  return { read, stop, reset, busy, progress, status, error };
}
