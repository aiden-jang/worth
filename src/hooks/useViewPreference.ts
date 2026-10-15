import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const remembered = new Map<string, unknown>();

// Tab memory keeps browsing context without putting private search terms in URLs or storage.
export function useViewPreference<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const read = () => (remembered.has(key) ? (remembered.get(key) as T) : initial);
  const [state, setState] = useState(() => ({ key, value: read() }));
  const value = state.key === key ? state.value : read();
  useEffect(() => {
    remembered.set(key, value);
    if (remembered.size > 500) remembered.delete(remembered.keys().next().value!);
  }, [key, value]);
  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setState((current) => {
        const previous =
          current.key === key ? current.value : remembered.has(key) ? (remembered.get(key) as T) : initial;
        return { key, value: typeof next === 'function' ? (next as (value: T) => T)(previous) : next };
      }),
    [key, initial],
  );
  return [value, update];
}
