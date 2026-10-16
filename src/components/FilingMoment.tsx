export function FilingMoment({ count }: { count: number }) {
  return (
    <svg className="filing-moment" viewBox="0 0 56 48" fill="none" aria-hidden="true">
      <path d="M5 20h18l5 4h23v19H5z" fill="#bec7ad" stroke="#34382d" strokeWidth="1.5" />
      <g className="filing-paper">
        {count > 1 && (
          <rect x="18" y="3" width="24" height="28" rx="4" fill="#d8cf9d" transform="rotate(8 18 3)" />
        )}
        <rect x="14" y="2" width="24" height="29" rx="4" fill="#eae5d5" stroke="#626456" />
        <path d="M20 10h12m-12 6h8" stroke="#626456" strokeLinecap="round" />
      </g>
      <path d="M5 29h46l-4 14H9z" fill="#d8cf9d" stroke="#34382d" strokeWidth="1.5" />
    </svg>
  );
}
