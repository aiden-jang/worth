import type { ReactNode } from 'react';
import type { ItemDecision } from '../shared/models';
import { callAsides, decisionLabel } from '../shared/decisions';
import { CallChoices, CallFace } from './PersonalCall';
import { BlankSlips } from './BlankSlips';

export function OpinionSlip({
  title,
  headingLevel = 'h3',
  type,
  rank,
  decision,
  onChange,
  disabled = false,
  example = false,
  className = '',
  presentation = 'display',
  children,
}: {
  title: string;
  headingLevel?: 'h2' | 'h3';
  type: string;
  rank?: number;
  decision: ItemDecision | null;
  onChange?: (decision: ItemDecision | null) => void;
  disabled?: boolean;
  example?: boolean;
  className?: string;
  presentation?: 'display' | 'editor' | 'preview';
  children?: ReactNode;
}) {
  const Heading = headingLevel;
  return (
    <section className={`opinion-slip ${className}`} aria-label={`Your call for ${title}`}>
      <div className="opinion-slip-top">
        <p className="overline">YOUR CALL{example ? ' / EXAMPLE' : ''}</p>
        {presentation === 'display' && <span>{rank ? String(rank).padStart(2, '0') : 'UNRANKED'}</span>}
        {presentation === 'preview' && rank && <span>#{String(rank).padStart(2, '0')}</span>}
      </div>
      {presentation !== 'editor' && <Heading className="opinion-slip-title">{title}</Heading>}
      {presentation !== 'editor' && type && <p className="opinion-slip-type">{type}</p>}
      <div className="opinion-slip-verdict" aria-live="polite">
        {decision ? (
          <CallFace key={decision} value={decision} arms />
        ) : (
          <BlankSlips className="undecided-slips" />
        )}
        <strong>{decision ? `${decisionLabel(decision)}.` : 'Undecided.'}</strong>
        <span>{decision ? callAsides[decision] : 'No opinion required.'}</span>
      </div>
      {presentation !== 'preview' && onChange && (
        <CallChoices
          value={decision}
          onChange={onChange}
          disabled={disabled}
          label={`Your call for ${title}`}
        />
      )}
      {children}
    </section>
  );
}
