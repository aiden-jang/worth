import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  clearIncomingCapture,
  readIncomingCapture,
  stageIncomingCapture,
} from '../src/shared/incoming-capture';

const value = { title: 'A private find', text: 'A private note', url: '' };
beforeEach(() => clearIncomingCapture());
afterEach(() => {
  vi.restoreAllMocks();
  clearIncomingCapture();
});

test('private handoffs are hidden while signed out and cannot cross accounts', () => {
  stageIncomingCapture(value, 'account-a');
  expect(readIncomingCapture().incoming).toBeNull();
  expect(readIncomingCapture('account-a').incoming).toEqual(value);
  expect(readIncomingCapture('account-b').incoming).toBeNull();
  expect(sessionStorage.getItem('worth:incoming-web-share')).toBeNull();
});
test('external shares can cross sign-in once, then bind to the selected account', () => {
  stageIncomingCapture(value);
  expect(readIncomingCapture().incoming).toEqual(value);
  expect(readIncomingCapture('account-a').incoming).toEqual(value);
  expect(JSON.parse(sessionStorage.getItem('worth:incoming-web-share')!).accountId).toBe('account-a');
  expect(readIncomingCapture('account-b').incoming).toBeNull();
});
test('blocked storage keeps a private handoff in this document without weakening its owner', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  expect(stageIncomingCapture(value, 'account-a')).toBe(false);
  expect(readIncomingCapture('account-a')).toEqual({ incoming: value, storageFailed: true });
  expect(readIncomingCapture('account-b').incoming).toBeNull();
});
test('expiration and explicit clearing discard the in-memory handoff too', () => {
  const now = Date.now();
  stageIncomingCapture(value, 'account-a');
  vi.spyOn(Date, 'now').mockReturnValue(now + 15 * 60 * 1000 + 1);
  expect(readIncomingCapture('account-a').incoming).toBeNull();
  stageIncomingCapture(value, 'account-a');
  clearIncomingCapture();
  expect(readIncomingCapture('account-a').incoming).toBeNull();
});
