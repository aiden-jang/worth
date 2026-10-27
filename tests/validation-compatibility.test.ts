import { expect, test } from 'vitest';
import { itemInput, listPatch, logInput, logPatch, workoutPatch } from '../src/shared/validation';
import { emptyItemContext, itemContextDraft } from '../src/shared/item-context';
import { emptyVisitContext } from '../src/shared/visit-context';

test('partial edits preserve every omitted value rather than filling creation defaults', () => {
  expect(listPatch.parse({ name: 'Renamed' })).toStrictEqual({ name: 'Renamed' });
  expect(logPatch.parse({ note: 'New note' })).toStrictEqual({ note: 'New note' });
  expect(workoutPatch.parse({ status: 'finished' })).toStrictEqual({ status: 'finished' });
  for (const schema of [listPatch, logPatch, workoutPatch]) expect(schema.safeParse({}).success).toBe(false);
});

test('name-only records retain fully parsed optional context and no inferred call', () => {
  expect(itemInput.parse({ title: 'Tea' })).toMatchObject({ context: emptyItemContext, decision: null });
  expect(logInput.parse({ happenedOn: '2026-10-26' })).toMatchObject({ context: emptyVisitContext });
});

test('an unfinished item draft can retain a price before its currency is entered', () => {
  const draft = { ...emptyItemContext, purchase: { ...emptyItemContext.purchase, price: 10 } };
  expect(itemContextDraft.parse(draft)).toEqual(draft);
  expect(itemInput.safeParse({ title: 'Tea', context: draft }).success).toBe(false);
});
