import { X } from '@phosphor-icons/react';
import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { InboxPanel } from '../pages/InboxPage';
import { TrashNotice } from './TrashTools';

export function InboxDrawer({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useIsMutating({ mutationKey: ['inbox'] }) > 0;
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      className="inbox-drawer"
      ref={dialog}
      aria-labelledby="inbox-drawer-title"
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (pending) event.preventDefault();
      }}
    >
      <div className="inbox-drawer-tools">
        <Link to="/inbox" onClick={onClose}>
          Open Unfiled ↗
        </Link>
        <button
          className="icon-button"
          aria-label="Close Unfiled"
          disabled={pending}
          onClick={() => dialog.current?.close()}
        >
          <X size={22} />
        </button>
      </div>
      <InboxPanel drawer />
      <TrashNotice />
    </dialog>
  );
}
