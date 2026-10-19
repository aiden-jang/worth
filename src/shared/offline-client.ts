import { z } from 'zod';
import { offlineSnapshot, type OfflineOperation } from './offline';
class OfflineRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
async function request(path: string, owner?: string, body?: unknown) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(owner ? { 'X-Worth-Account': owner } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  if (!response.ok)
    throw new OfflineRequestError(
      String(
        z.object({ error: z.string().optional() }).passthrough().safeParse(value).data?.error ??
          'REQUEST_FAILED',
      ),
      String(
        z.object({ message: z.string().optional() }).passthrough().safeParse(value).data?.message ??
          'Could not connect to Worth. Your pending saves are kept.',
      ),
    );
  return value;
}
export async function verifiedOfflineOwner(expected: string) {
  const me = z
    .object({
      user: z
        .object({ id: z.string().min(1).max(100) })
        .passthrough()
        .nullable(),
    })
    .parse(await request('/me'));
  if (!me.user)
    throw new OfflineRequestError('SIGN_IN', 'Sign in to Worth before preparing or syncing this copy.');
  if (expected && me.user.id !== expected)
    throw new OfflineRequestError(
      'ACCOUNT_CHANGED',
      'Another account is signed in. This device copy and pending saves stay with their original account. Sign in to that account before syncing.',
    );
  return String(me.user.id);
}
export async function downloadOfflineSnapshot(owner: string) {
  await verifiedOfflineOwner(owner);
  const snapshot = offlineSnapshot.parse(await request('/offline/snapshot', owner));
  if (snapshot.owner !== owner)
    throw new Error('This snapshot belongs to another account. The device copy was kept.');
  return snapshot;
}
export async function syncOfflineOperation(
  owner: string,
  operation: OfflineOperation,
): Promise<{
  record: {
    id: string;
    updatedAt: number;
    note: string;
    title?: string;
    kind?: 'inbox';
    listId?: null;
    date?: null;
    decision?: null;
    rank?: null;
  };
}> {
  const response = z
    .object({
      record: z
        .object({
          id: z.string().uuid(),
          updatedAt: z.number().int().nonnegative(),
          note: z.string().max(4000),
          title: z.string().max(120).optional(),
          kind: z.literal('inbox').optional(),
          listId: z.null().optional(),
          date: z.null().optional(),
          decision: z.null().optional(),
          rank: z.null().optional(),
        })
        .strict(),
    })
    .strict()
    .parse(await request('/offline/sync', owner, operation));
  if (response.record.id !== (operation.kind === 'capture' ? operation.id : operation.recordId))
    throw new Error('Worth returned a different save confirmation. Your pending request is kept.');
  return response;
}
export async function prepareOfflineShell() {
  if (!('serviceWorker' in navigator))
    throw new Error('This browser cannot prepare an offline page. Your archive stays in Worth.');
  const registration = await navigator.serviceWorker.register('/offline/sw.js', { scope: '/offline/' });
  await registration.update();
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error('Offline page preparation took too long. Check your connection and try again.')),
        30000,
      ),
    ),
  ]);
  await confirmPreparedShell(ready);
}

async function confirmPreparedShell(registration: ServiceWorkerRegistration) {
  const channel = new MessageChannel();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Offline page preparation took too long. Your existing device copy is kept.'));
    }, 30000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (event.data?.ok) resolve();
      else
        reject(
          new Error(
            'Could not prepare the offline page. Check your connection and try again. Your existing device copy is kept.',
          ),
        );
    };
    registration.active?.postMessage({ type: 'PREPARE' }, [channel.port2]);
  });
}
