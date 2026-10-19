import type { IncomingCapture } from './web-capture';

const key = 'worth:incoming-web-share';
const lifetime = 15 * 60 * 1000;
type StagedCapture = { value: IncomingCapture; expires: number; accountId?: string };
// A null tombstone prevents a failed storage removal from reopening a dismissed share in this document.
let memory: { snapshot: StagedCapture; stored: boolean } | null | undefined;

function valid(value: unknown): value is StagedCapture {
  if (!value || typeof value !== 'object') return false;
  const record = value as StagedCapture,
    incoming = record.value;
  return (
    !!incoming &&
    typeof incoming === 'object' &&
    typeof incoming.title === 'string' &&
    incoming.title.length <= 1000 &&
    typeof incoming.text === 'string' &&
    incoming.text.length <= 16000 &&
    typeof incoming.url === 'string' &&
    incoming.url.length <= 4000 &&
    Number.isFinite(record.expires) &&
    record.expires > Date.now() &&
    record.expires <= Date.now() + lifetime &&
    (record.accountId === undefined ||
      (typeof record.accountId === 'string' && record.accountId.length > 0 && record.accountId.length <= 200))
  );
}
function persist(snapshot: StagedCapture) {
  memory = { snapshot, stored: false };
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
    memory.stored = true;
    return true;
  } catch {
    return false;
  }
}
export function stageIncomingCapture(value: IncomingCapture, accountId?: string) {
  return persist({ value, accountId, expires: Date.now() + lifetime });
}
export function clearIncomingCapture() {
  memory = null;
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
export function readIncomingCapture(accountId?: string): {
  incoming: IncomingCapture | null;
  storageFailed: boolean;
} {
  if (memory === undefined) {
    try {
      const snapshot: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
      if (valid(snapshot)) memory = { snapshot, stored: true };
      else {
        const cleared = clearIncomingCapture();
        return { incoming: null, storageFailed: !cleared };
      }
    } catch {
      memory = null;
      return { incoming: null, storageFailed: true };
    }
  }
  if (!memory) return { incoming: null, storageFailed: false };
  if (!valid(memory.snapshot)) {
    const cleared = clearIncomingCapture();
    return { incoming: null, storageFailed: !cleared };
  }
  if (memory.snapshot.accountId && memory.snapshot.accountId !== accountId) {
    // Signed-out pages cannot preview private handoffs. A different account discards only the handoff.
    const stored = memory.stored;
    if (accountId) clearIncomingCapture();
    return { incoming: null, storageFailed: !stored };
  }
  if (accountId && !memory.snapshot.accountId) persist({ ...memory.snapshot, accountId });
  return { incoming: memory.snapshot.value, storageFailed: !memory.stored };
}
