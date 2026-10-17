import { expect, test } from 'vitest';
import {
  connectionInput,
  normalizeConnection,
  hasReplacementCycle,
  connectionDraft,
} from '../src/shared/connections';
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222';
test('connections preserve replacement direction, require a reason, and normalize symmetric pairs', () => {
  expect(connectionInput.safeParse({ fromId: a, toId: a, kind: 'related', reason: '' }).success).toBe(false);
  expect(connectionInput.safeParse({ fromId: a, toId: b, kind: 'replaces', reason: '   ' }).success).toBe(
    false,
  );
  expect(normalizeConnection({ fromId: b, toId: a, kind: 'edition', reason: 'Same book' })).toMatchObject({
    fromId: a,
    toId: b,
  });
  expect(normalizeConnection({ fromId: b, toId: a, kind: 'replaces', reason: 'Switched' })).toMatchObject({
    fromId: b,
    toId: a,
  });
});
test('replacement chains detect cycles without treating ordinary related links as replacements', () => {
  const edge = (fromId: string, toId: string, kind: 'related' | 'replaces' = 'replaces') => ({
    fromId,
    toId,
    kind,
  });
  expect(hasReplacementCycle([edge(a, b), edge(b, 'c'), edge('c', a, 'related')])).toBe(false);
  expect(hasReplacementCycle([edge(a, b), edge(b, 'c'), edge('c', a)])).toBe(true);
  expect(hasReplacementCycle(Array.from({ length: 1000 }, (_, i) => edge(String(i), String(i + 1))))).toBe(
    false,
  );
  expect(connectionDraft.safeParse({ attempt: { key: 'bad' } }).success).toBe(false);
});
