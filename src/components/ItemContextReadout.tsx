import { Fragment } from 'react';
import { emptyItemContext, type ItemContext } from '../shared/item-context';

export function ItemContextReadout({ value }: { value: ItemContext | undefined }) {
  if (!value || JSON.stringify(value) === JSON.stringify(emptyItemContext)) return null;
  const details = [
    ['Why saved', value.whySaved],
    ['Recommended by', value.recommendedBy],
    ['Recommendation', value.recommendation],
    ['After trying it', value.followUp],
    ['Location', value.location],
    ['Version / edition', value.version],
    ...value.fields.map((field) => [field.name, field.value]),
    ['Purchased', value.purchase.boughtOn],
    ['Price paid', value.purchase.price === null ? '' : `${value.purchase.price} ${value.purchase.currency}`],
    ['Return deadline', value.purchase.returnBy],
    [
      'Ownership',
      value.purchase.status === 'unspecified'
        ? ''
        : ({ using: 'Still using', stored: 'Stored', passed_on: 'Passed on', returned: 'Returned' } as const)[
            value.purchase.status
          ],
    ],
    [
      'Loan',
      value.loan.direction === 'none' ? '' : value.loan.direction === 'borrowed' ? 'Borrowed' : 'Lent',
    ],
    ['Person', value.loan.person],
    ['Loan started', value.loan.startedOn],
    ['Return by', value.loan.returnBy],
    ['Returned on', value.loan.returnedOn],
  ].filter(([, text]) => text);
  return (
    <details className="context-readout">
      <summary>Saved context</summary>
      {value.sourceUrl && (
        <p>
          <a href={value.sourceUrl} target="_blank" rel="noopener noreferrer">
            Source link ↗
          </a>
        </p>
      )}
      <dl>
        {details.map(([label, text], index) => (
          <Fragment key={index}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </Fragment>
        ))}
      </dl>
      {!!value.labels.length && <p>Labels: {value.labels.join(' · ')}</p>}
      <div className="personal-stamps">
        {value.stamps.map((stamp) => (
          <span key={stamp}>{stamp}</span>
        ))}
      </div>
    </details>
  );
}
