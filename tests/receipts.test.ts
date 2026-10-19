// @vitest-environment node
import { expect, test } from 'vitest';
import {
  receiptInput,
  receiptDraft,
  receiptPayload,
  emptyReceipt,
  receiptLineSuggestions,
  exportReceiptReferences,
  receiptDigest,
  type SavedReceipt,
} from '../src/shared/receipts';
const item = '11111111-1111-4111-8111-111111111111',
  list = '22222222-2222-4222-8222-222222222222';
const body = () =>
  receiptInput.parse({
    ...emptyReceipt().current,
    name: 'Reviewed receipt',
    day: null,
    lines: receiptLineSuggestions('COFFEE 4.00\nTAX 0.30\nTOTAL 4.30'),
  });
test('receipt suggestions remain literal and unlinked without inferring prices, taxes, dates or record choices', () => {
  const input = body();
  expect(input.lines.map((l) => [l.label, l.amount, l.mapping])).toEqual([
    ['COFFEE 4.00', '', { mode: 'none' }],
    ['TAX 0.30', '', { mode: 'none' }],
    ['TOTAL 4.30', '', { mode: 'none' }],
  ]);
  expect(receiptLineSuggestions('x'.repeat(241))).toEqual([]);
  expect(receiptLineSuggestions(Array.from({ length: 50 }, (_, i) => `${i}`).join('\n'))).toHaveLength(30);
});
test('receipt drafts retain incomplete record choices but saves require real dates, names and distinct create identities', () => {
  expect(
    receiptInput.safeParse({ ...emptyReceipt().current, name: 'Name without a reviewed receipt', day: null })
      .success,
  ).toBe(false);
  const draft = emptyReceipt();
  draft.current.name = 'Keep';
  draft.current.day = '2026-02-';
  draft.current.lines = [
    { ...body().lines[0], label: '', mapping: { mode: 'create', itemId: item, listId: '', title: '' } },
  ];
  expect(receiptDraft.safeParse(draft).success).toBe(true);
  expect(() => receiptPayload(draft.current)).toThrow();
  const input = body();
  expect(receiptInput.safeParse({ ...input, day: '2026-02-29' }).success).toBe(false);
  input.lines[0].mapping = { mode: 'create', itemId: item, listId: list, title: 'Coffee' };
  input.lines[1].mapping = { mode: 'create', itemId: item, listId: list, title: 'Coffee again' };
  expect(receiptInput.safeParse(input).success).toBe(false);
});
test('receipt backups keep entered text and creation provenance while remapping only live record links', () => {
  const input = body();
  input.lines[0].mapping = { mode: 'create', itemId: item, listId: list, title: 'Coffee' };
  const saved: SavedReceipt = { ...input, id: crypto.randomUUID(), createdAt: 1 };
  const kept = exportReceiptReferences(saved, new Set([item]));
  expect(kept.lines[0]).toMatchObject({
    mapping: { mode: 'existing', itemId: item },
    createdHere: true,
    createdName: 'Coffee',
    label: 'COFFEE 4.00',
  });
  const missing = exportReceiptReferences(saved, new Set());
  expect(missing.lines[0]).toMatchObject({
    mapping: { mode: 'none' },
    referenceMissing: true,
    createdHere: true,
    createdName: 'Coffee',
  });
  expect(saved.lines[0].mapping.mode).toBe('create');
});
test('receipt attachment identity binds exact bytes', async () => {
  const a = await receiptDigest(new Blob(['reviewed'])),
    b = await receiptDigest(new Blob(['changed']));
  expect(a).toMatch(/^[a-f0-9]{64}$/);
  expect(a).not.toBe(b);
  expect(await receiptDigest(new Blob(['reviewed']))).toBe(a);
});
