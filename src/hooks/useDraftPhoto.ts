import { draftLifetime } from '../shared/device-data';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

function storage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('worth-draft-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function access(key: string, action: 'read' | 'write' | 'delete', file?: File) {
  const db = await storage();
  try {
    return await new Promise<{ file: File; updatedAt: number } | undefined>((resolve, reject) => {
      const transaction = db.transaction('files', action === 'read' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('files');
      const request =
        action === 'read'
          ? store.get(key)
          : action === 'delete'
            ? store.delete(key)
            : store.put({ file, updatedAt: Date.now() }, key);
      transaction.oncomplete = () => resolve(action === 'read' ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export function useDraftPhoto(name: string) {
  const owner = useQueryClient().getQueryData<{ user?: { id: string } }>(['me'])?.user?.id;
  const key = owner ? `${owner}:${name}` : null;
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);
  const revision = useRef(0);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let live = true;
    if (!key) {
      setReady(true);
      return;
    }
    access(key, 'read')
      .then((value) => {
        if (!live || revision.current) return;
        if (value && value.updatedAt > Date.now() - draftLifetime && value.file instanceof File) {
          setFile(value.file);
          setStatus('Photo restored from this device.');
        } else if (value) void access(key, 'delete').catch(() => {});
      })
      .catch(() => {
        if (live) setStatus('Photo recovery is unavailable on this device. Keep this page open.');
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [key]);
  function change(next: File | null) {
    revision.current++;
    setFile(next);
    if (!key) return;
    const current = revision.current;
    setStatus(next ? 'Saving photo draft…' : '');
    writes.current = writes.current
      .catch(() => {})
      .then(() => access(key, next ? 'write' : 'delete', next ?? undefined))
      .then(() => {
        if (current === revision.current) setStatus(next ? 'Photo draft saved on this device.' : '');
      })
      .catch(() => {
        if (current === revision.current)
          setStatus('Photo draft could not be saved on this device. Keep this page open.');
      });
  }
  return { file, change, ready, status, clear: () => change(null) };
}
