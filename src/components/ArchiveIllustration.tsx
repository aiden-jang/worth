/** Neutral archive objects add context without implying a saved memory or opinion. */
export function ArchiveIllustration({ kind }: { kind: 'search' | 'memories' }) {
  return (
    <svg
      className="collection-empty-illustration"
      viewBox="0 0 180 156"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'search' ? (
          <>
            <g transform="rotate(-8 71 85)">
              <rect x="33" y="29" width="76" height="110" rx="10" fill="#eae5d5" stroke="#cbc9b8" />
              <path d="M49 52h43M49 64h29M49 116h19" stroke="#aaa99b" />
              <path d="M49 90h24" stroke="#737566" />
            </g>
            <path d="m125 97 29 30" stroke="#8d7266" strokeWidth="16" />
            <path d="m126 98 28 29" stroke="#c8a89b" strokeWidth="12" />
            <circle cx="107" cy="76" r="32" fill="#d8d9bd" stroke="#737566" />
            <circle cx="107" cy="76" r="24" fill="#eae5d5" stroke="#acaf95" />
            <path d="M94 72h25M94 82h17" stroke="#737566" strokeWidth="2" />
            <path d="M146 29v12m-6-6h12" stroke="#e8dc9d" />
          </>
        ) : (
          <>
            <path
              d="M22 61V46q0-8 8-8h35l12 13h72q9 0 9 9v67q0 9-9 9H31q-9 0-9-9Z"
              fill="#d8d9bd"
              stroke="#acaf95"
            />
            <g transform="rotate(-9 86 69)">
              <rect x="47" y="17" width="79" height="101" rx="6" fill="#eae5d5" stroke="#cbc9b8" />
              <rect x="57" y="28" width="59" height="47" rx="3" fill="#c8a89b" />
              <circle cx="100" cy="42" r="7" fill="#e8dc9d" />
              <path d="m58 74 18-22 15 15 10-10 14 17" stroke="#626456" />
              <path d="M59 88h42m-42 10h24" stroke="#aaa99b" />
            </g>
            <path d="M23 73h133l-8 55q-1 8-10 8H40q-9 0-10-8Z" fill="#d8d9bd" stroke="#acaf95" />
            <rect x="67" y="91" width="48" height="22" rx="5" fill="#eae5d5" stroke="#acaf95" />
            <path d="M78 102h26" stroke="#aaa99b" />
          </>
        )}
      </g>
    </svg>
  );
}
