import { callAsides, decisionLabel, personalCalls } from '../shared/decisions';
import type { ItemDecision } from '../shared/models';

export function CallFace({
  value,
  selected = false,
  arms = false,
}: {
  value: ItemDecision;
  selected?: boolean;
  arms?: boolean;
}) {
  return (
    <svg
      className={`call-face call-face-${value} ${selected ? 'call-face-selected' : ''}`}
      viewBox="0 0 120 110"
      fill="none"
      aria-hidden="true"
    >
      {arms && (
        <g
          className="call-face-limbs"
          stroke="var(--face-outline, var(--paper))"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            className="call-face-hands"
            d={
              value === 'meh'
                ? 'M19 65q-10 7-13-3 M101 65q10 7 13-3'
                : value === 'favorite'
                  ? 'M22 60Q10 59 9 49 M99 58q10-3 11-13'
                  : 'M20 66q-9 4-10 11 M99 67q9 5 10 11'
            }
          />
          <path className="call-face-feet" d="M44 86v7m-4 2h8 M76 86v7m-4 2h8" />
        </g>
      )}
      <path
        className="call-face-body"
        d={
          value === 'meh'
            ? 'M15 65C12 45 26 27 45 29c11 2 14-5 29-2 19 3 33 20 32 39-1 19-17 24-46 24S18 84 15 65Z'
            : value === 'favorite'
              ? 'M20 60c2-14 10-20 14-30C40 14 54 12 64 18c12-5 24 4 28 18 4 10 13 17 12 30-1 19-20 25-43 25S17 81 20 60Z'
              : 'M16 61c-1-19 13-36 31-37 14-1 22 6 33 7 18 3 25 20 23 36-2 19-19 24-43 23S17 82 16 61Z'
        }
        fill="var(--face-fill, var(--paper))"
        stroke={selected ? 'var(--acid)' : 'var(--face-fill, var(--paper))'}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {arms && value === 'favorite' && (
        <path
          className="call-face-heart"
          d="M101 25c-7-4-9-9-5-11 2-1 4 0 5 2 1-2 3-3 5-2 4 2 2 7-5 11Z"
          fill="var(--face-blush, #bd9986)"
        />
      )}
      <g fill="var(--face-blush, #bd9986)" opacity="0.65">
        <ellipse cx="36" cy="67" rx="4.5" ry="2.6" />
        <ellipse cx="83" cy="67" rx="4.5" ry="2.6" />
      </g>
      <g
        className="call-face-eyes"
        stroke="var(--face-ink, var(--ink))"
        strokeWidth="2.8"
        strokeLinecap="round"
      >
        {value === 'favorite' ? (
          <path d="M44 55q4-5 8 0 M68 55q4-5 8 0" />
        ) : value === 'meh' ? (
          <>
            <path d="m42 54 12 1 m13 0 12-1" />
            <path d="M49 57v2 M71 57v2" />
          </>
        ) : (
          <path d="M49 55v3 M71 58v3" />
        )}
      </g>
      <path
        d={value === 'favorite' ? 'M55 69q6 7 12-1' : value === 'meh' ? 'M55 72h11' : 'M55 74q5-4 11-2'}
        stroke="var(--face-ink, var(--ink))"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CallBadge({ value, selected = false }: { value: ItemDecision; selected?: boolean }) {
  return (
    <span className={`call-badge call-badge-${value}`} role="img" aria-label={decisionLabel(value)}>
      <CallFace value={value} selected={selected} />
      <span>{decisionLabel(value)}</span>
    </span>
  );
}

export function CallChoices({
  value,
  onChange,
  disabled = false,
  label = 'Your call',
  aside = false,
}: {
  value: ItemDecision | null;
  onChange: (value: ItemDecision | null) => void;
  disabled?: boolean;
  label?: string;
  aside?: boolean;
}) {
  return (
    <div className="call-choices" data-choice={value ?? 'none'} role="group" aria-label={label}>
      {personalCalls.map((call) => (
        <button
          key={call.value}
          type="button"
          aria-pressed={value === call.value}
          aria-description={value === call.value ? 'Select again to clear this call.' : undefined}
          disabled={disabled}
          className={value === call.value ? 'active' : ''}
          onClick={() => onChange(value === call.value ? null : call.value)}
        >
          <CallFace value={call.value} selected={value === call.value} />
          <span>
            {call.label}
            {aside && value === call.value && <small>{callAsides[call.value]}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}
