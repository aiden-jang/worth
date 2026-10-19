import { useEffect, useRef } from 'react';
import { reportAnalytics } from '../analytics/browser';
import type { Page } from '../analytics/schema';
export function usePageAnalytics(page: Page, navigationKey: string = page): void {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current === navigationKey) return;
    previous.current = navigationKey;
    reportAnalytics({ name: 'page_view', page });
  }, [page, navigationKey]);
}
