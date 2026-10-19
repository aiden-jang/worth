// @vitest-environment node
import { beforeAll, expect, test, vi } from 'vitest';
import { offlineOperation, offlineVault, type OfflineVault } from '../src/shared/offline';
import { sealVault, unsealVault, vaultKey, vaultSalt } from '../src/shared/offline-vault';
vi.setConfig({ testTimeout: 30000 });
let key: CryptoKey, salt: string;
const owner = 'offline-owner',
  epoch = crypto.randomUUID(),
  recordId = crypto.randomUUID();
const value: OfflineVault = {
  snapshot: {
    owner,
    epoch,
    savedAt: 1,
    lists: [],
    records: [
      {
        id: recordId,
        kind: 'inbox',
        listId: null,
        title: 'PRIVATE OFFLINE FIND',
        note: 'PRIVATE OFFLINE NOTE',
        updatedAt: 1,
        date: null,
        decision: null,
        rank: null,
      },
    ],
  },
  queue: [],
};
beforeAll(async () => {
  salt = vaultSalt();
  key = await vaultKey('A separate offline phrase', salt);
});
test('offline copies use nonextractable keys, fresh IVs and authenticated owner metadata', async () => {
  expect(key.extractable).toBe(false);
  await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  const a = await sealVault(owner, key, salt, value),
    b = await sealVault(owner, key, salt, value);
  expect(a.iv).not.toBe(b.iv);
  expect(a.cipher).not.toBe(b.cipher);
  expect(a.stamp).not.toBe(b.stamp);
  expect(JSON.stringify(a)).not.toContain('PRIVATE OFFLINE');
  expect(await unsealVault(a, key)).toEqual(value);
  for (const tampered of [
    { ...a, owner: 'another-owner' },
    { ...a, savedAt: 2 },
    { ...a, stamp: crypto.randomUUID() },
    { ...a, cipher: (a.cipher[0] === 'A' ? 'B' : 'A') + a.cipher.slice(1) },
  ])
    await expect(unsealVault(tampered, key)).rejects.toThrow('saved encrypted copy is kept');
  await expect(sealVault('another-owner', key, salt, value)).rejects.toThrow('another account');
});
test('wrong passphrases preserve the encrypted copy and queue scope is validated before encryption', async () => {
  const e = await sealVault(owner, key, salt, value),
    before = JSON.stringify(e),
    wrong = await vaultKey('Another offline phrase', salt);
  await expect(unsealVault(e, wrong)).rejects.toThrow('saved encrypted copy is kept');
  expect(JSON.stringify(e)).toBe(before);
  const op = offlineOperation.parse({
    id: crypto.randomUUID(),
    epoch,
    kind: 'capture',
    recordKind: null,
    recordId: null,
    title: 'Next find',
    note: '',
    expectedNote: null,
    expectedUpdatedAt: null,
  });
  expect(offlineVault.safeParse({ ...value, queue: [op, op] }).success).toBe(false);
  expect(offlineVault.safeParse({ ...value, queue: [{ ...op, epoch: crypto.randomUUID() }] }).success).toBe(
    false,
  );
  expect(offlineOperation.safeParse({ ...op, kind: 'note' }).success).toBe(false);
  await expect(vaultKey('short', salt)).rejects.toThrow('12–200');
});
