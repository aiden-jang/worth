import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConfirmDialog } from '../src/components/ConfirmDialog';

const methods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      // Browsers queue the close event after removing the dialog from the top layer.
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const key of ['showModal', 'close'] as const) {
    const descriptor = methods[key];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});

test.each(['button', 'icon', 'Escape', 'backdrop'])(
  '%s cancellation updates the owner before the queued native close event',
  (method) => {
    const onClose = vi.fn();
    function Owner() {
      const [open, setOpen] = useState(true);
      return open ? (
        <ConfirmDialog
          title="Leave this page?"
          description="Keep editing or discard your changes."
          confirmLabel="Discard changes"
          onConfirm={vi.fn()}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      ) : null;
    }
    render(
      <StrictMode>
        <Owner />
      </StrictMode>,
    );
    const dialog = screen.getByRole('dialog');
    // A queued Strict Mode cleanup event must not dismiss the reopened dialog.
    fireEvent(dialog, new Event('close'));
    expect(onClose).not.toHaveBeenCalled();
    if (method === 'button') fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
    if (method === 'icon') fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    if (method === 'Escape') fireEvent(dialog, new Event('cancel', { cancelable: true }));
    if (method === 'backdrop') fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute('open');
    fireEvent(dialog, new Event('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  },
);

test('a deferred owner update keeps repeated close requests reachable', () => {
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      title="Leave this page?"
      description="Keep editing or discard your changes."
      confirmLabel="Discard changes"
      onConfirm={vi.fn()}
      onClose={onClose}
    />,
  );
  const dialog = screen.getByRole('dialog');
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
  expect(onClose).toHaveBeenCalledTimes(1);
  // Router transitions can coalesce a reset and another blocked Back navigation.
  expect(dialog).toHaveAttribute('open');
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[1]);
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('pending work keeps the confirmation open for Escape and backdrop clicks', () => {
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      title="Leave this page?"
      description="Keep editing or discard your changes."
      confirmLabel="Discard changes"
      pending
      onConfirm={vi.fn()}
      onClose={onClose}
    />,
  );
  const dialog = screen.getByRole('dialog');
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancel);
  fireEvent.click(dialog);
  expect(cancel.defaultPrevented).toBe(true);
  expect(dialog).toHaveAttribute('open');
  expect(onClose).not.toHaveBeenCalled();
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
});
