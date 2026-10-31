import type { Item } from '../shared/models';
import { detailField, itemBrand, pricePaid } from '../shared/item-details';

export function ItemDetailsReadout({ item }: { item: Item }) {
  const facts = [
    ['Brand / maker', itemBrand(item.context)],
    ['Variant / edition', item.context?.version],
    ['Size', detailField(item.context, 'size')?.value],
    ['Location', item.context?.location],
    ['Price paid', pricePaid(item.context)],
  ].filter(([, value]) => value);
  if (!facts.length) return null;
  return (
    <dl className="item-detail-readout">
      {facts.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
