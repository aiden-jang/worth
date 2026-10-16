const draftLifetime = 7 * 86400000;
export async function cleanDeviceData(owner: string, all = false): Promise<void> {
  const now = Date.now();
  if (all) {
    localStorage.removeItem(`worth:quick-picks:${owner}`);
    sessionStorage.removeItem('worth:incoming-web-share');
  }
  const drafts = `worth:draft:v1:${owner}:`;
  const restore = `worth:restore:${owner}:`;
  const timers = `worth:rest:${owner}:`;
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(drafts) || key.startsWith(restore)) {
      let expired = true;
      try {
        const value = JSON.parse(localStorage.getItem(key) ?? 'null');
        expired = !Number.isFinite(value?.updatedAt) || value.updatedAt <= now - draftLifetime;
      } catch {
        /* Device storage may be unavailable or blocked. */
      }
      if (all || expired) localStorage.removeItem(key);
    } else if (key.startsWith(timers) && (all || Number(localStorage.getItem(key)) <= now))
      localStorage.removeItem(key);
  }
  // Only this account's records are touched, including photos for unopened editors.
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('worth-draft-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('files', 'readwrite');
      const cursor = transaction.objectStore('files').openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        if (
          String(entry.key).startsWith(`${owner}:`) &&
          (all || !Number.isFinite(entry.value?.updatedAt) || entry.value.updatedAt <= now - draftLifetime)
        )
          entry.delete();
        entry.continue();
      };
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
  if (all) window.dispatchEvent(new Event('worth:rest-changed'));
}
