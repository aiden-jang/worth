import { draftLifetime } from '../shared/device-data';
import { useEffect, useRef, useState } from 'react';
import { useAccountId } from './useAccountId';

function storage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('worth-draft-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
type StoredPhoto = {
  file?: File;
  data?: ArrayBuffer;
  name?: string;
  type?: string;
  lastModified?: number;
  updatedAt: number;
  operationId?: string;
};
async function access(key: string, action: 'read' | 'write' | 'delete', file?: File, operationId?: string) {
  if (
    action === 'write' &&
    (!file ||
      !file.size ||
      file.size > 20 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
  )
    throw new Error('Choose a JPEG, PNG or WebP photo up to 20 MB.');
  // Raw bytes survive IndexedDB cloning on browsers that cannot persist a File.
  const value: StoredPhoto | undefined =
    action === 'write' && file
      ? {
          data: await file.arrayBuffer(),
          name: file.name,
          type: file.type,
          lastModified: file.lastModified,
          updatedAt: Date.now(),
          operationId,
        }
      : undefined;
  const db = await storage();
  try {
    return await new Promise<StoredPhoto | undefined>((resolve, reject) => {
      const transaction = db.transaction('files', action === 'read' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('files');
      const request =
        action === 'read' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(value, key);
      transaction.oncomplete = () => resolve(action === 'read' ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export function useDraftPhoto(name: string) {
  const owner = useAccountId();
  const key = owner ? `${owner}:${name}` : null;
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);
  const revision = useRef(0);
  const operationId = useRef<string>(crypto.randomUUID());
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
        const recovered =
          value?.file instanceof File
            ? value.file
            : value?.data instanceof ArrayBuffer &&
                value.data.byteLength > 0 &&
                value.data.byteLength <= 20 * 1024 * 1024 &&
                ['image/jpeg', 'image/png', 'image/webp'].includes(value.type ?? '')
              ? new File([value.data], value.name ?? 'photo', {
                  type: value.type,
                  lastModified: value.lastModified,
                })
              : null;
        if (value && value.updatedAt > Date.now() - draftLifetime && recovered) {
          operationId.current =
            typeof value.operationId === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.operationId)
              ? value.operationId
              : crypto.randomUUID();
          setFile(recovered);
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
    operationId.current = crypto.randomUUID();
    const requestId = operationId.current;
    setFile(next);
    if (!key) return;
    const current = revision.current;
    setStatus(next ? 'Saving photo draft…' : '');
    writes.current = writes.current
      .catch(() => {})
      .then(() => access(key, next ? 'write' : 'delete', next ?? undefined, requestId))
      .then(() => {
        if (current === revision.current) setStatus(next ? 'Photo draft saved on this device.' : '');
      })
      .catch(() => {
        if (current === revision.current)
          setStatus('Photo draft could not be saved on this device. Keep this page open.');
      });
  }
  async function freeze(
    blob: Blob,
    expectedId = operationId.current,
  ): Promise<{ file: File; key: string; stored: boolean }> {
    if (expectedId !== operationId.current)
      throw new Error('The selected photo changed. Review it before uploading.');
    const prepared =
      blob instanceof File ? blob : new File([blob], file?.name ?? 'photo', { type: blob.type });
    revision.current++;
    const current = revision.current,
      requestId = operationId.current;
    setFile(prepared);
    let stored = false;
    if (key) {
      writes.current = writes.current.catch(() => {}).then(() => access(key, 'write', prepared, requestId));
      try {
        await writes.current;
        stored = true;
        if (current === revision.current) setStatus('Photo draft saved on this device.');
      } catch {
        if (current === revision.current)
          setStatus('Photo draft could not be saved on this device. Keep this page open.');
      }
    }
    return { file: prepared, key: requestId, stored };
  }
  return { file, change, freeze, operationId, ready, status, clear: () => change(null) };
}
