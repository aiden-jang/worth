import type { ReactNode } from 'react';
import type { ItemDecision } from '../shared/models';
import { callAsides, decisionLabel } from '../shared/decisions';
import { CallChoices, CallFace } from './PersonalCall';

export function OpinionSlip({
  title,
  type,
  rank,
  decision,
  onChange,
  disabled = false,
  example = false,
  className = '',
  children,
}: {
  title: string;
  type: string;
  rank?: number;
  decision: ItemDecision | null;
  onChange: (decision: ItemDecision | null) => void;
  disabled?: boolean;
  example?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`opinion-slip ${className}`} aria-label={`Your call for ${title}`}>
      <div className="opinion-slip-top">
        <p className="overline">YOUR CALL{example ? ' / EXAMPLE' : ''}</p>
        <span>{rank ? String(rank).padStart(2, '0') : 'UNRANKED'}</span>
      </div>
      <h3>{title}</h3>
      {type && <p className="opinion-slip-type">{type}</p>}
      <div className="opinion-slip-verdict" aria-live="polite">
        {decision && <CallFace key={decision} value={decision} arms />}
        <strong>{decision ? `${decisionLabel(decision)}.` : 'Undecided.'}</strong>
        <span>{decision ? callAsides[decision] : 'No opinion required.'}</span>
      </div>
      <CallChoices
        value={decision}
        onChange={onChange}
        disabled={disabled}
        label={`Your call for ${title}`}
      />
      {children}
    </section>
  );
}
