import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';

export function ItemSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLButtonElement>('[aria-label="Close item"]')?.focus();
    return () => node?.close();
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="item-sheet"
      aria-label={`Saved item: ${title}`}
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <button
        type="button"
        className="icon-button item-sheet-close"
        aria-label="Close item"
        onClick={() => dialog.current?.close()}
      >
        <X size={22} />
      </button>
      {children}
    </dialog>,
    document.body,
  );
}
