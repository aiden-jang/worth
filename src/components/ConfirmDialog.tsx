import { X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ConfirmDialog({
  eyebrow = 'CONFIRM',
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onClose,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => node.close();
  }, []);

  return createPortal(
    <dialog
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      ref={dialog}
      onClose={(event) => {
        event.stopPropagation();
        // Ignore close events queued by Strict Mode cleanup if the dialog reopened.
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (pending) event.preventDefault();
      }}
      onClick={(event) => {
        if (!pending && event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="confirm-inner">
        <header className="confirm-head">
          <div>
            <p className="overline">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            disabled={pending}
            className="icon-button"
            aria-label="Cancel"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        <p id={descriptionId}>{description}</p>
        {children}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button
            className="button button-outline"
            onClick={() => dialog.current?.close()}
            disabled={pending}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button className="button button-danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
