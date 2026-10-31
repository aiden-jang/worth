import type { Item } from './models';
import { emptyItemContext, type ItemContext } from './item-context';

export const brandFieldNames = [
  'brand',
  'maker',
  'company',
  'brand / maker',
  'brand or maker',
  'manufacturer',
];
const fieldKey = (name: string) => name.trim().toLowerCase();
export const brandKey = (value: string) => value.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
function isBrandField(name: string) {
  return brandFieldNames.includes(fieldKey(name));
}
function isProductField(name: string) {
  return isBrandField(name) || fieldKey(name) === 'size';
}
export function detailField(context: ItemContext | undefined, kind: 'brand' | 'size') {
  if (kind === 'brand') {
    const namedBrand = context?.fields.find(({ name }) => fieldKey(name) === 'brand');
    if (namedBrand) return namedBrand;
  }
  return context?.fields.find(({ name }) =>
    kind === 'brand' ? isBrandField(name) : fieldKey(name) === 'size',
  );
}
export function itemBrand(context: ItemContext | undefined) {
  return detailField(context, 'brand')?.value.trim() ?? '';
}
export function itemIdentity(item: Item) {
  return [itemBrand(item.context), item.context?.version, detailField(item.context, 'size')?.value]
    .filter(Boolean)
    .join(' · ');
}
export function setDetailField(context: ItemContext, kind: 'brand' | 'size', value: string): ItemContext {
  const current = detailField(context, kind);
  return {
    ...context,
    fields: current
      ? context.fields.flatMap((field) =>
          field === current ? (value ? [{ ...field, value }] : []) : [field],
        )
      : value
        ? [...context.fields, { name: kind === 'brand' ? 'Brand' : 'Size', value }]
        : context.fields,
  };
}
export function collectionDetailProfile(name: string): 'product' | 'place' | 'general' {
  const key = name.trim().toLowerCase();
  if (
    [
      'skincare',
      'haircare',
      'makeup',
      'fragrance',
      'food & snacks',
      'clothing & gear',
      'drinks',
      'cars',
    ].includes(key)
  )
    return 'product';
  if (['places', 'experiences', 'restaurants', 'cafes'].includes(key)) return 'place';
  return 'general';
}
export function hasProductDetails(context: ItemContext | undefined) {
  return Boolean(
    context &&
    (context.fields.some(({ name }) => isProductField(name)) ||
      context.purchase.price !== null ||
      context.purchase.currency),
  );
}
export function hasItemDetails(type: string | undefined, context: ItemContext | undefined) {
  return Boolean(type || (context && JSON.stringify(context) !== JSON.stringify(emptyItemContext)));
}
export function itemDetailSuggestions(items: Item[], kind: 'brand' | 'type' | 'variant') {
  const values = items.map((item) =>
    kind === 'brand' ? itemBrand(item.context) : kind === 'type' ? item.type : (item.context?.version ?? ''),
  );
  return [
    ...new Map(values.filter((value) => value.trim()).map((value) => [brandKey(value), value])).values(),
  ].sort((a, b) => a.localeCompare(b));
}
export function pricePaid(context: ItemContext | undefined) {
  if (context?.purchase.price === null || context?.purchase.price === undefined) return '';
  const { price, currency } = context.purchase;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
  } catch {
    return String(price) + ' ' + currency;
  }
}
