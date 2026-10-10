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
      className={`call-face call-face-${value} ${selected ? 'call-face-selected' : ''}`}
      viewBox="0 0 120 110"
      fill="none"
      aria-hidden="true"
    >
      {arms && (
        <path
          d={
            value === 'meh'
              ? 'M21 67q-8 9-12 5l-3-8 M99 67q8 9 12 5l3-8'
              : value === 'favorite'
                ? 'M21 67Q9 80 6 69 M99 64q12-12 14-4'
                : 'M21 70q-10 8-15 0 M99 70q10 8 15 0'
          }
          stroke="var(--face-outline, var(--paper))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <ellipse
        cx="60"
        cy="54"
        rx="43"
        ry="41"
        fill="var(--face-fill, var(--paper))"
        stroke={selected ? 'var(--acid)' : 'var(--face-outline, var(--paper))'}
        strokeWidth="2.5"
      />
      {arms && value === 'favorite' && (
        <path
          className="call-face-heart"
          d="M98 23c-10-6-12-13-7-16 3-2 6-1 7 2 2-3 5-4 8-2 5 3 2 10-8 16Z"
          fill="#d7a092"
        />
      )}
      <g stroke="var(--face-ink, var(--ink))" strokeWidth="3.5" strokeLinecap="round">
        {value === 'meh' ? (
          <>
            <path d="M37 43h15 M68 43h15" />
            <path d="M50 63h20" />
          </>
        ) : (
          <path d={value === 'favorite' ? 'M48 62 Q60 75 72 62' : 'M49 67 Q60 57 71 67'} />
        )}
      </g>
      {value === 'favorite' ? (
        <g
          className="call-face-eyes"
          stroke="var(--face-ink, var(--ink))"
          strokeWidth="3.5"
          strokeLinecap="round"
        >
          <path d="M40 47q4-6 8 0 M72 47q4-6 8 0" />
        </g>
      ) : (
        <g className="call-face-eyes" fill="var(--face-ink, var(--ink))">
          <circle cx="44" cy={value === 'meh' ? 46 : 47} r="3.8" />
          <circle cx="76" cy={value === 'meh' ? 46 : 47} r="3.8" />
        </g>
      )}
      <g fill="#d7a092">
        <ellipse cx="34" cy="60" rx="5.5" ry="4" />
        <ellipse cx="86" cy="60" rx="5.5" ry="4" />
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
