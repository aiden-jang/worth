import type { BoardInput } from '../shared/memory-boards';
export function BoardObject({ kind }: { kind: BoardInput['kind'] }) {
  return (
    <svg className="board-object" viewBox="0 0 120 88" fill="none" aria-hidden="true">
      {kind === 'moment' ? (
        <>
          <path d="m28 13 60 7-7 57-60-7z" fill="#bdc7ad" stroke="#38392f" strokeWidth="2" />
          <path d="m38 8 62 6-6 62-62-6z" fill="#eae5d5" stroke="#38392f" strokeWidth="2" />
          <path d="m44 16 47 5-4 35-47-5z" fill="#bdc7ad" />
          <path d="m42 58 28 3" stroke="#626456" strokeWidth="2" strokeLinecap="round" />
          <circle cx="77" cy="32" r="7" fill="#e8dc9d" />
        </>
      ) : kind === 'shortlist' ? (
        <>
          <path d="M33 9h47l14 15v53H33z" fill="#eae5d5" stroke="#38392f" strokeWidth="2" />
          <path d="M80 9v16h14" stroke="#38392f" strokeWidth="2" strokeLinejoin="round" />
          {[37, 51, 65].map((y) => (
            <g key={y}>
              <circle cx="45" cy={y} r="3" fill="#bdc7ad" />
              <path d={`M55 ${y}h25`} stroke="#626456" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </>
      ) : kind === 'evening' ? (
        <>
          <path
            d="m20 23 78-7 5 48-78 7-1-13a7 7 0 0 0-1-14z"
            fill="#c6a48a"
            stroke="#38392f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m75 19 5 47" stroke="#38392f" strokeWidth="2" strokeDasharray="3 4" />
          <path d="M57 30a14 14 0 1 0 11 21 14 14 0 0 1-11-21Z" fill="#eae5d5" />
        </>
      ) : (
        <>
          <path
            d="m16 18 29-8 29 9 29-8v57l-29 8-29-9-29 8z"
            fill="#e8dc9d"
            stroke="#38392f"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M45 10v57m29-48v57" stroke="#626456" strokeWidth="1.5" />
          <path
            d="M28 52c12-25 27 9 38-8s18-7 25-14"
            stroke="#38392f"
            strokeWidth="2"
            strokeDasharray="3 4"
          />
          <circle cx="28" cy="52" r="4" fill="#bdc7ad" stroke="#38392f" strokeWidth="1.5" />
          <circle cx="91" cy="30" r="4" fill="#eae5d5" stroke="#38392f" strokeWidth="1.5" />
        </>
      )}
    </svg>
  );
}
