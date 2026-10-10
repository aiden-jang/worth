import type { ItemDecision } from '../shared/models';
import { callAsides, decisionLabel, personalCalls } from '../shared/decisions';

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
      className={`call-face ${selected ? 'call-face-selected' : ''}`}
      viewBox="0 0 120 110"
      fill="none"
      aria-hidden="true"
    >
      {arms && (
        <path
          d={
            value === 'meh'
              ? 'M22 70 12 80 7 65 M98 70 108 80 113 65'
              : 'M22 70 Q9 80 5 65 M98 70 Q111 80 115 65'
          }
          stroke="var(--face-outline, var(--paper))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle
        cx="60"
        cy="53"
        r="43"
        stroke={selected ? 'var(--acid)' : 'var(--face-outline, var(--paper))'}
        strokeWidth="2.5"
      />
      <circle cx="60" cy="53" r="38" fill="var(--face-fill, var(--paper))" />
      <g stroke="var(--face-ink, var(--ink))" strokeWidth="3.5" strokeLinecap="round">
        {value === 'meh' ? (
          <>
            <path d="M37 43h15 M68 43h15" />
            <path d="M50 63h20" />
          </>
        ) : (
          <path d={value === 'favorite' ? 'M48 62 Q60 75 72 62' : 'M48 68 Q60 48 72 68'} />
        )}
      </g>
      <g fill="var(--face-ink, var(--ink))">
        <circle cx="44" cy={value === 'meh' ? 46 : 45} r="3.8" />
        <circle cx="76" cy={value === 'meh' ? 46 : 45} r="3.8" />
      </g>
      <g fill="#d7a092">
        <ellipse cx="35" cy="59" rx="4.5" ry="3.7" />
        <ellipse cx="85" cy="59" rx="4.5" ry="3.7" />
      </g>
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
    <div className="call-choices" role="group" aria-label={label}>
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

export function CallLegend({ illustrated = false }: { illustrated?: boolean }) {
  return (
    <div
      className={illustrated ? 'call-legend call-legend-hero' : 'call-legend'}
      aria-label="Personal calls: Favorite, Meh, Not again"
    >
      <p className="overline">YOUR CALL{illustrated ? ' / EXAMPLE' : ''}</p>
      {personalCalls.map((call) => (
        <div key={call.value} className={`call-legend-entry call-legend-${call.value}`}>
          <CallFace value={call.value} arms={illustrated} selected={illustrated && call.value === 'meh'} />
          <span>{call.label}</span>
          {illustrated && call.value === 'meh' && <small>It was a thing.</small>}
        </div>
      ))}
    </div>
  );
}

export function CategoryDrawing({ kind = 'glass' }: { kind?: 'glass' | 'cup' | 'ticket' | 'tumbler' }) {
  return (
    <svg className="category-drawing" viewBox="0 0 100 110" fill="none" aria-hidden="true">
      <g stroke="var(--paper)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'glass' ? (
          <>
            <path d="M33 12h34l8 31c5 20-8 32-25 32S20 63 25 43z M50 75v22 M35 99q15-8 30 0z" />
          </>
        ) : kind === 'tumbler' ? (
          <>
            <path d="M27 30h46l-5 68H32z M61 10l-9 31 M27 40h46" />
            <path d="m38 72 9-3 3 9-9 3z m12 13 10-4 4 9-10 4z" />
          </>
        ) : kind === 'cup' ? (
          <>
            <path d="M24 32h52l-5 63H29z M20 21h60v12H20z M27 21l3-10h40l3 10" />
          </>
        ) : (
          <g transform="rotate(-18 50 55)">
            <path d="M9 29h82v12q-12 4 0 13v27H9V65q12-4 0-13z M25 37h50 M25 73h50" />
          </g>
        )}
        <path d="M44 57q6 7 12 0" />
      </g>
      <g fill="var(--paper)">
        <circle cx="38" cy="48" r="2.5" />
        <circle cx="62" cy="48" r="2.5" />
      </g>
      <g fill="#d7a092">
        <circle cx="33" cy="55" r="3" />
        <circle cx="67" cy="55" r="3" />
      </g>
    </svg>
  );
}
