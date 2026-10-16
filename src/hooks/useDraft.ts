import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

// Account and list scope prevent a shared device from restoring someone else's draft.
export function useDraft<T>(name: string, initial: T, validate: (value: unknown) => value is T) {
  const client = useQueryClient();
  const owner = client.getQueryData<{ user?: { id: string } }>(['me'])?.user?.id;
  const key = owner ? `worth:draft:v1:${owner}:${name}` : null;
  const read = () => {
    try {
      const value = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null;
      if (value && value.updatedAt > Date.now() - 7 * 86400000 && validate(value.form)) return value;
      if (key) localStorage.removeItem(key);
      return null;
    } catch {
      return null;
    }
  };
  const [loaded] = useState(read);
  const [form, setForm] = useState<T>(loaded?.form ?? initial);
  const operationId = useRef<string>(
    typeof loaded?.operationId === 'string' ? loaded.operationId : crypto.randomUUID(),
  );
  const savedId = useRef<string | null>(typeof loaded?.savedId === 'string' ? loaded.savedId : null);
  const cleared = useRef(false);
  const baseline = useRef(initial);
  const initialForm = useRef(initial);
  const [status, setStatus] = useState(loaded ? 'Draft restored from this device.' : '');
  const latest = useRef(form);
  latest.current = form;
  const persist = useCallback(() => {
    if (!key || cleared.current) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          form: latest.current,
          operationId: operationId.current,
          savedId: savedId.current,
          updatedAt: Date.now(),
        }),
      );
      setStatus('Draft saved on this device.');
    } catch {
      setStatus('Draft could not be saved on this device. Keep this page open.');
    }
  }, [key]);
  useEffect(() => {
    if (loaded && JSON.stringify(form) === JSON.stringify(loaded.form) && !savedId.current) return;
    if (cleared.current && JSON.stringify(form) === JSON.stringify(baseline.current)) return;
    if (JSON.stringify(form) === JSON.stringify(initialForm.current) && !loaded) return;
    cleared.current = false;
    persist();
  }, [form, loaded, persist]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (!cleared.current && JSON.stringify(latest.current) !== JSON.stringify(initialForm.current)) {
        persist();
        event.preventDefault();
      }
    };
    const hide = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('beforeunload', leave);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [key, persist]);
  function clear(next: T = latest.current) {
    baseline.current = next;
    cleared.current = true;
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Device storage may be unavailable or blocked. */
      }
    }
    setStatus('');
  }
  function rememberSaved(id: string) {
    savedId.current = id;
    persist();
  }
  return {
    form,
    setForm: setForm as Dispatch<SetStateAction<T>>,
    clear,
    status,
    savedId,
    operationId,
    rememberSaved,
  };
}
