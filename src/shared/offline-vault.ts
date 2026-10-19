import { z } from 'zod';
import { offlineVault, type OfflineVault } from './offline';
const envelopeSchema = z
  .object({
    version: z.literal(1),
    owner: z.string().min(1).max(100),
    stamp: z.string().uuid(),
    savedAt: z.number().int().nonnegative(),
    salt: z.string().max(32),
    iv: z.string().max(24),
    cipher: z.string().max(16 * 1024 * 1024),
  })
  .strict();
export type VaultEnvelope = z.infer<typeof envelopeSchema>;
function encode(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
function aad(e: Pick<VaultEnvelope, 'owner' | 'stamp' | 'savedAt' | 'salt'>) {
  return new TextEncoder().encode(
    JSON.stringify({ version: 1, owner: e.owner, stamp: e.stamp, savedAt: e.savedAt, salt: e.salt }),
  );
}
export async function vaultKey(passphrase: string, salt: string) {
  if (passphrase.length < 12 || passphrase.length > 200)
    throw new Error('Use a separate offline passphrase of 12–200 characters. It cannot be recovered.');
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: decode(salt), iterations: 600000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export function vaultSalt() {
  return encode(crypto.getRandomValues(new Uint8Array(16)));
}
export async function sealVault(
  owner: string,
  key: CryptoKey,
  salt: string,
  value: OfflineVault,
): Promise<VaultEnvelope> {
  const validated = offlineVault.parse(value);
  if (validated.snapshot.owner !== owner) throw new Error('This offline archive belongs to another account.');
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    head = { version: 1 as const, owner, stamp: crypto.randomUUID(), savedAt: Date.now(), salt };
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(head) },
    key,
    new TextEncoder().encode(JSON.stringify(validated)),
  );
  return { ...head, iv: encode(iv), cipher: encode(new Uint8Array(cipher)) };
}
export async function unsealVault(envelope: VaultEnvelope, key: CryptoKey) {
  try {
    const e = envelopeSchema.parse(envelope);
    const bytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decode(e.iv), additionalData: aad(e) },
      key,
      decode(e.cipher),
    );
    const value = offlineVault.parse(JSON.parse(new TextDecoder().decode(bytes)));
    if (value.snapshot.owner !== e.owner) throw new Error('Owner mismatch');
    return value;
  } catch {
    throw new Error(
      'Could not unlock this copy. Check the passphrase. A damaged copy also cannot open; the saved encrypted copy is kept.',
    );
  }
}
function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('worth-offline-vaults', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vaults', { keyPath: 'owner' });
    request.onerror = () => reject(new Error('Device storage is unavailable. Your existing copy is kept.'));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function readVault(owner: string): Promise<VaultEnvelope | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('vaults', 'readonly'),
        request = tx.objectStore('vaults').get(owner);
      request.onsuccess = () => {
        try {
          resolve(request.result ? envelopeSchema.parse(request.result) : null);
        } catch {
          reject(new Error('This encrypted device copy is unreadable. It has not been removed.'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function listVaults(): Promise<VaultEnvelope[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('vaults', 'readonly').objectStore('vaults').getAll();
      request.onsuccess = () => {
        try {
          resolve(request.result.map((e) => envelopeSchema.parse(e)));
        } catch {
          reject(new Error('A device copy is unreadable. Existing data is kept.'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
// Encrypt before opening the transaction. The comparison and write share one IDB transaction.
export async function writeVault(envelope: VaultEnvelope, expectedStamp: string | null) {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('vaults', 'readwrite'),
        store = tx.objectStore('vaults'),
        get = store.get(envelope.owner);
      let conflict = false;
      get.onsuccess = () => {
        if ((get.result?.stamp ?? null) !== expectedStamp) {
          conflict = true;
          tx.abort();
        } else {
          try {
            store.put(envelope);
          } catch {
            tx.abort();
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? 'This device copy changed in another tab. Lock and reopen the saved copy before editing. Your current text remains on this page.'
              : 'Could not save the encrypted device copy. Keep this page open; your earlier copy is kept.',
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function deleteVault(owner: string, expectedStamp: string) {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('vaults', 'readwrite'),
        store = tx.objectStore('vaults'),
        get = store.get(owner);
      let conflict = false;
      get.onsuccess = () => {
        if (get.result?.stamp !== expectedStamp) {
          conflict = true;
          tx.abort();
        } else store.delete(owner);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () =>
        reject(
          new Error(
            conflict
              ? 'This copy changed in another tab. Reload before removing it.'
              : 'Could not remove this device copy.',
          ),
        );
    });
  } finally {
    db.close();
  }
}
