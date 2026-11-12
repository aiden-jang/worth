import { useLayoutEffect, useRef, type RefObject } from 'react';

export function useModalDialog(
  dialog: RefObject<HTMLDialogElement | null>,
  fallback?: () => HTMLElement | null | undefined,
) {
  const restore = useRef(fallback);
  useLayoutEffect(() => {
    restore.current = fallback;
  });
  useLayoutEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    return () => {
      node?.close();
      // Nested confirmations finish their own focus restoration during cleanup.
      window.setTimeout(() => {
        if (node?.open || document.querySelector('dialog[open]')) return;
        const active = document.activeElement;
        if (active && active !== document.body && active !== opener && !node?.contains(active)) return;
        const target = opener?.isConnected && opener !== document.body ? opener : restore.current?.();
        const heading = document.querySelector<HTMLElement>('main h1');
        if (!target && heading) heading.tabIndex = -1;
        (target ?? heading)?.focus({ preventScroll: true });
      }, 0);
    };
  }, [dialog]);
}
