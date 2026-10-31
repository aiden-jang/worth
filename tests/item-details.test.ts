import { expect, test } from 'vitest';
import { itemContext, emptyItemContext } from '../src/shared/item-context';
import {
  collectionDetailProfile,
  detailField,
  itemBrand,
  pricePaid,
  setDetailField,
} from '../src/shared/item-details';
import { quickEntryDraft } from '../src/shared/quick-entry';
import { experienceInput } from '../src/shared/memories';

test('brand shortcuts reuse an existing company detail without losing unrelated fields or another alias', () => {
  const context = itemContext.parse({
    fields: [
      { name: 'Company', value: 'Harbor' },
      { name: 'Origin', value: 'Seoul' },
      { name: 'Maker', value: 'A collaborator' },
    ],
  });
  const updated = setDetailField(context, 'brand', 'Harbor Studio');
  expect(updated.fields).toEqual([
    { name: 'Company', value: 'Harbor Studio' },
    { name: 'Origin', value: 'Seoul' },
    { name: 'Maker', value: 'A collaborator' },
  ]);
  expect(itemBrand(updated)).toBe('Harbor Studio');
  expect(detailField(setDetailField(updated, 'size', '50 ml'), 'size')?.value).toBe('50 ml');
  expect(context.fields[0].value).toBe('Harbor');
  expect(
    itemBrand({ ...context, fields: [...context.fields, { name: 'Brand', value: 'The product brand' }] }),
  ).toBe('The product brand');
});

test('product profiles do not make places into products and zero is a real optional price', () => {
  expect(collectionDetailProfile('Skincare')).toBe('product');
  expect(collectionDetailProfile('Places')).toBe('place');
  expect(collectionDetailProfile('My personal collection')).toBe('general');
  expect(pricePaid(undefined)).toBe('');
  expect(pricePaid(itemContext.parse({ purchase: { price: 0, currency: 'USD' } }))).toMatch(/0\.00/);
  expect(itemContext.safeParse({ purchase: { price: 12 } }).success).toBe(false);
});

test('older quick drafts remain readable and product drafts keep optional price and currency unfinished', () => {
  const old = {
    listId: 'inbox',
    title: 'Lotion',
    itemId: null,
    note: '',
    decision: null,
    wantToTry: false,
    experienced: false,
    happenedOn: '2026-10-31',
    pending: null,
  };
  expect(quickEntryDraft.safeParse(old).success).toBe(true);
  const context = {
    ...emptyItemContext,
    purchase: { ...emptyItemContext.purchase, price: 12, currency: '' },
  };
  expect(quickEntryDraft.parse({ ...old, type: 'Lotion', context }).context?.purchase.price).toBe(12);
});

test('a dated new product can keep private details while an existing-name visit cannot overwrite them', () => {
  const input = {
    itemId: null,
    title: 'Lotion',
    happenedOn: '2026-10-31',
    itemContext: { fields: [{ name: 'Brand', value: 'Harbor' }] },
  };
  expect(experienceInput.parse(input).itemContext?.fields[0].value).toBe('Harbor');
  expect(
    experienceInput.safeParse({ ...input, itemId: '11111111-1111-4111-8111-111111111111' }).success,
  ).toBe(false);
});
