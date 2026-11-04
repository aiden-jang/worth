import { useId, useState } from 'react';
import type { Item } from '../shared/models';
import type { ItemContext } from '../shared/item-context';
import {
  collectionDetailProfile,
  detailField,
  hasProductDetails,
  itemDetailSuggestions,
  setDetailField,
} from '../shared/item-details';

export function ItemDetailsFields({
  collectionName = '',
  type,
  context,
  items = [],
  onChange,
}: {
  collectionName?: string;
  type: string;
  context: ItemContext;
  items?: Item[];
  onChange: (type: string, context: ItemContext) => void;
}) {
  const id = useId();
  const profile = collectionDetailProfile(collectionName);
  const [expanded, setExpanded] = useState(false);
  const product = profile === 'product' || hasProductDetails(context) || expanded;
  const suggestions = (kind: 'brand' | 'type' | 'variant') => (
    <datalist id={id + kind}>
      {itemDetailSuggestions(items, kind).map((value) => (
        <option value={value} key={value} />
      ))}
    </datalist>
  );
  return (
    <fieldset className={'item-detail-fields' + (product ? ' product-item-fields' : '')}>
      <legend className="sr-only">
        {product ? 'Product details (optional)' : 'Item details (optional)'}
      </legend>
      <label>
        <span>Type</span>
        <input
          aria-label="Type"
          maxLength={60}
          value={type}
          list={id + 'type'}
          placeholder={typeExample(collectionName)}
          onChange={(event) => onChange(event.target.value, context)}
        />
        {suggestions('type')}
      </label>
      {product && (
        <label>
          <span>Brand</span>
          <input
            aria-label="Brand or maker"
            maxLength={240}
            value={detailField(context, 'brand')?.value ?? ''}
            list={id + 'brand'}
            disabled={context.fields.length >= 12 && !detailField(context, 'brand')}
            onChange={(event) => onChange(type, setDetailField(context, 'brand', event.target.value))}
          />
          {suggestions('brand')}
        </label>
      )}
      {(product || profile === 'general' || context.version) && (
        <label className="item-detail-variant">
          <span>{product ? 'Variant' : 'Version or edition'}</span>
          <input
            aria-label={product ? 'Variant' : 'Version or edition'}
            maxLength={120}
            value={context.version}
            list={id + 'variant'}
            placeholder={product ? 'Flavor, shade or model' : 'e.g. Second edition'}
            onChange={(event) => onChange(type, { ...context, version: event.target.value })}
          />
          {suggestions('variant')}
        </label>
      )}
      {product && (
        <label className="item-detail-size">
          <span>Size</span>
          <input
            aria-label="Size"
            maxLength={240}
            value={detailField(context, 'size')?.value ?? ''}
            placeholder="e.g. 50 ml"
            disabled={context.fields.length >= 12 && !detailField(context, 'size')}
            onChange={(event) => onChange(type, setDetailField(context, 'size', event.target.value))}
          />
        </label>
      )}
      {product &&
        context.fields.length >= 12 &&
        (!detailField(context, 'brand') || !detailField(context, 'size')) && (
          <p className="item-details-hint">
            All 12 custom details are in use. Remove one in More context to add another.
          </p>
        )}
      {profile === 'place' && (
        <label>
          <span>Location</span>
          <input
            aria-label="Location"
            maxLength={120}
            value={context.location}
            placeholder="A place or neighborhood"
            onChange={(event) => onChange(type, { ...context, location: event.target.value })}
          />
        </label>
      )}
      {product && (
        <div className="date-pair item-detail-price">
          <label>
            <span>Price paid</span>
            <input
              aria-label="Price paid"
              type="number"
              inputMode="decimal"
              min="0"
              max="1000000000"
              step="any"
              value={context.purchase.price ?? ''}
              onChange={(event) =>
                onChange(type, {
                  ...context,
                  purchase: {
                    ...context.purchase,
                    price: event.target.value === '' ? null : Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            <span>Currency</span>
            <input
              aria-label="Currency"
              maxLength={3}
              value={context.purchase.currency}
              placeholder="USD"
              onChange={(event) =>
                onChange(type, {
                  ...context,
                  purchase: { ...context.purchase, currency: event.target.value.toUpperCase() },
                })
              }
            />
          </label>
        </div>
      )}
      {!product && (
        <button type="button" className="item-details-more" onClick={() => setExpanded(true)}>
          Add product details
        </button>
      )}
    </fieldset>
  );
}

function typeExample(name: string) {
  const examples: Record<string, string> = {
    skincare: 'e.g. Moisturizer',
    haircare: 'e.g. Shampoo',
    makeup: 'e.g. Lip tint',
    fragrance: 'e.g. Eau de parfum',
    'food & snacks': 'e.g. Chocolate',
    'clothing & gear': 'e.g. Jacket',
    drinks: 'e.g. Wheat beer',
    cars: 'e.g. Coupe',
    places: 'e.g. Cafe',
    restaurants: 'e.g. Korean BBQ',
    cafes: 'e.g. Coffee shop',
  };
  return examples[name.trim().toLowerCase()] ?? 'e.g. Coffee, book, film';
}
