import { Fragment, useState } from 'react';
import { hasVisitContext, visitReactionLabel, type VisitContext as Context } from '../shared/visit-context';

export function VisitContextFields({
  value,
  onChange,
}: {
  value: Context;
  onChange: (value: Context) => void;
}) {
  const [open, setOpen] = useState(hasVisitContext(value));
  return (
    <details
      className="record-extras visit-context-fields"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        This visit <span>optional · private</span>
      </summary>
      <p>Details for this visit only. Your overall call and ranking stay unchanged.</p>
      <div className="date-pair">
        <label>
          Visit location
          <input
            maxLength={120}
            value={value.location}
            onChange={(e) => onChange({ ...value, location: e.target.value })}
          />
        </label>
        <label>
          Visit version or edition
          <input
            maxLength={120}
            value={value.version}
            onChange={(e) => onChange({ ...value, version: e.target.value })}
          />
        </label>
      </div>
      <label>
        Order or setup
        <textarea
          rows={3}
          maxLength={500}
          value={value.order}
          onChange={(e) => onChange({ ...value, order: e.target.value })}
          placeholder="What you ordered or used this time"
        />
      </label>
      <label>
        Visit reaction
        <select
          value={value.reaction ?? ''}
          onChange={(e) => onChange({ ...value, reaction: (e.target.value as Context['reaction']) || null })}
        >
          <option value="">No reaction</option>
          <option value="favorite">Favorite this time</option>
          <option value="meh">Meh this time</option>
          <option value="would_not_again">Not again this time</option>
        </select>
      </label>
    </details>
  );
}
export function VisitContextReadout({ value }: { value: Context | undefined }) {
  if (!hasVisitContext(value) || !value) return null;
  return (
    <details className="visit-context-readout">
      <summary>Visit details</summary>
      <dl>
        {[
          ['Location', value.location],
          ['Version / edition', value.version],
          ['Order / setup', value.order],
          ['This visit', value.reaction ? visitReactionLabel(value.reaction) : ''],
        ]
          .filter(([, text]) => text)
          .map(([label, text]) => (
            <Fragment key={label}>
              <dt>{label}</dt>
              <dd>{text}</dd>
            </Fragment>
          ))}
      </dl>
    </details>
  );
}
