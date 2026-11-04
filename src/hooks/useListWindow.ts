import { useEffect, useState } from 'react';

// A display window only: filtering, totals and exports keep the complete source records.
export function useListWindow(scope: string, focusIndex = -1) {
  const [page, setPage] = useState({ scope, count: 50 });
  const current = page.scope === scope ? page.count : 50;
  const count = Math.max(current, focusIndex + 1);
  useEffect(() => {
    if (focusIndex >= current) setPage({ scope, count: focusIndex + 1 });
  }, [scope, current, focusIndex]);
  return { count, showMore: () => setPage({ scope, count: count + 50 }) };
}
