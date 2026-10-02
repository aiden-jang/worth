import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';

export function ConfirmDialog({
  eyebrow = 'CONFIRM',
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onClose,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => node.close();
  }, []);

  return createPortal(
    <dialog
      className="confirm-dialog"
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="confirm-inner">
        <header className="confirm-head">
          <div>
            <p className="overline">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Cancel" onClick={() => dialog.current?.close()}>
            <X size={20} />
          </button>
        </header>
        <p>{description}</p>
        {error && <p className="form-error">{error}</p>}
        <div className="confirm-actions">
          <button
            className="button button-outline"
            onClick={() => dialog.current?.close()}
            disabled={pending}
          >
            Keep it
          </button>
          <button className="button button-danger" onClick={onConfirm} disabled={pending} autoFocus>
            {pending ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
