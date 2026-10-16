import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CoverCrop } from '../src/components/CoverCrop';

const methods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const key of ['showModal', 'close'] as const) {
    const descriptor = methods[key];
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[key];
  }
});
test('resetting cover framing restores all sliders and the zoom readout without saving', () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:local-framing', revokeObjectURL: vi.fn() });
  const save = vi.fn(async () => undefined);
  render(
    <CoverCrop
      file={new File(['test'], 'cover.png', { type: 'image/png' })}
      onSave={save}
      onClose={() => undefined}
    />,
  );
  fireEvent.load(screen.getByAltText('Cover crop preview'));
  for (const [name, value] of [
    ['Horizontal position', '90'],
    ['Vertical position', '15'],
    ['Zoom', '2'],
  ]) {
    fireEvent.change(screen.getByRole('slider', { name }), { target: { value } });
  }
  expect(screen.getByText('200%')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Reset framing' }));
  expect(screen.getByRole('slider', { name: 'Horizontal position' })).toHaveValue('50');
  expect(screen.getByRole('slider', { name: 'Vertical position' })).toHaveValue('50');
  expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('1');
  expect(screen.getByText('100%')).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});
