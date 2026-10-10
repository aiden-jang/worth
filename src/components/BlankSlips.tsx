/** Faceless paper art keeps an undecided item separate from a deliberately neutral call. */
export function BlankSlips({ className = 'collection-empty-illustration' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 180 156" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <rect
          x="38"
          y="23"
          width="93"
          height="118"
          rx="12"
          transform="rotate(-12 38 23)"
          fill="var(--blank-back, #292a23)"
        />
        <rect
          x="43"
          y="13"
          width="93"
          height="118"
          rx="12"
          transform="rotate(7 43 13)"
          fill="#eae5d5"
          stroke="#cbc9b8"
        />
        <path d="m63 44 50 6m-52 11 32 4" stroke="#aaa99b" />
        <path d="m65 88 22 3" stroke="#67695b" />
      </g>
      <path d="M145 32v16m-8-8h16" stroke="#e8dc9d" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
