import { useEffect, useRef, type ReactNode } from 'react';

const phoneQuery = '(max-width: 680px), (max-width: 1024px) and (pointer: coarse)';
const properties = [
  '--save-viewport-height',
  '--save-viewport-top',
  '--save-viewport-bottom',
  '--save-footer-space',
];

export function DialogSaveFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const footer = ref.current;
    const dialog = footer?.closest('dialog');
    if (!footer || !dialog) return;
    const viewport = window.visualViewport;
    const media = window.matchMedia?.(phoneQuery);
    const requestFrame =
      window.requestAnimationFrame?.bind(window) ??
      ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    const cancelFrame = window.cancelAnimationFrame?.bind(window) ?? window.clearTimeout.bind(window);
    let frame = 0;
    const clear = () => properties.forEach((property) => dialog.style.removeProperty(property));
    const update = () => {
      frame = 0;
      if (!(media?.matches ?? window.innerWidth <= 680)) {
        clear();
        return;
      }
      // Keep the normal layout while someone pinch-zooms and pans it themselves.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      dialog.style.setProperty('--save-viewport-height', height + 'px');
      dialog.style.setProperty('--save-viewport-top', top + 'px');
      dialog.style.setProperty(
        '--save-viewport-bottom',
        Math.max(0, window.innerHeight - top - height) + 'px',
      );
      const footerBox = footer.getBoundingClientRect();
      dialog.style.setProperty('--save-footer-space', footerBox.height + 20 + 'px');
      const active = document.activeElement;
      if (
        !dialog.open ||
        !(active instanceof HTMLElement) ||
        active.closest('dialog') !== dialog ||
        footer.contains(active) ||
        !active.matches(
          'input:not([type=file]):not([type=hidden]), textarea, select, button, a[href], summary, [tabindex]:not([tabindex="-1"])',
        )
      )
        return;
      const box = active.getBoundingClientRect();
      const start = Math.max(top, dialog.getBoundingClientRect().top) + 12;
      const end = Math.min(top + height, footerBox.top) - 12;
      if (box.height > end - start) return;
      if (box.bottom > end) dialog.scrollTop += box.bottom - end;
      else if (box.top < start) dialog.scrollTop -= start - box.top;
    };
    const schedule = () => {
      if (!(media?.matches ?? window.innerWidth <= 680)) {
        clear();
        return;
      }
      if (!frame) frame = requestFrame(update);
    };
    dialog.classList.add('has-dialog-save');
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    dialog.addEventListener('focusin', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(footer);
    return () => {
      if (frame) cancelFrame(frame);
      observer?.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      dialog.removeEventListener('focusin', schedule);
      dialog.classList.remove('has-dialog-save');
      clear();
    };
  }, []);
  return (
    <div ref={ref} className={'dialog-save-footer ' + className}>
      {children}
    </div>
  );
}
