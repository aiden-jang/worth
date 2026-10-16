/** Quiet objects for activity, without an opinion, score or implied achievement. */
export function ActivityIllustration({ kind = 'log' }: { kind?: 'log' | 'workout' }) {
  return (
    <svg
      className={`activity-illustration activity-illustration-${kind}`}
      viewBox="0 0 180 156"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'log' ? (
        <>
          <path
            d="M39 29 117 18q12-2 14 11l12 99q1 10-10 12l-78 8q-11 1-13-10L31 43q-1-12 8-14Z"
            fill="#d8d9bd"
            stroke="#acaf95"
            strokeWidth="1.5"
          />
          <path d="m39 30 65-8q10-1 11 10l11 94q1 8-7 9l-65 8Z" fill="#eae5d5" />
          <path
            d="m52 56 42-5m-39 20 31-4m-28 20 36-4"
            stroke="#aaa99b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="m42 34 11 104" stroke="#acaf95" strokeWidth="2" />
          <path
            d="m122 45 12-4 21 72-9 13-9-9Z"
            fill="#e8dc9d"
            stroke="#b4aa79"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="m137 117 9 9 9-13Z" fill="#eae5d5" />
          <path d="m144 123 2 3 3-4" stroke="#626456" strokeWidth="2" />
          <path d="m121 44-2-7q-1-5 4-7l3-1q6-2 7 4l2 7" fill="#c8a89b" />
        </>
      ) : (
        <>
          <path
            d="M103 31h25v15l9 13q4 6 4 15v55q0 13-13 13h-28q-13 0-13-13V74q0-9 5-15l11-13Z"
            fill="#e8dc9d"
            stroke="#b4aa79"
            strokeWidth="1.5"
          />
          <rect x="101" y="19" width="29" height="17" rx="5" fill="#c8a89b" />
          <path d="M107 24v7m8-7v7m8-7v7" stroke="#8d7266" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M88 76h52v43H88" fill="#eae5d5" />
          <path d="M101 88h15m-15 10h23" stroke="#aaa99b" strokeWidth="2" strokeLinecap="round" />
          <rect
            x="26"
            y="92"
            width="80"
            height="49"
            rx="12"
            fill="#d8d9bd"
            stroke="#acaf95"
            strokeWidth="1.5"
          />
          <path d="M27 108h79M35 127h62" stroke="#acaf95" strokeWidth="2" strokeLinecap="round" />
          <path d="M38 94v43m8-43v43" stroke="#eae5d5" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}
