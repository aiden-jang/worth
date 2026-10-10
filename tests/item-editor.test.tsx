import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ItemEditor } from '../src/components/ItemEditor';
import type { Item } from '../src/shared/models';

const dialogMethods = {
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
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

const item: Item = {
  id: 'item-1',
  listId: 'list-1',
  title: 'A drink',
  type: 'Coffee',
  note: '',
  decision: null,
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: 1,
  updatedAt: 1,
  logCount: 0,
  lastLoggedOn: null,
};

test('a refreshed item or photo does not replace unsaved fields and call', () => {
  const client = new QueryClient();
  const editor = (record: Item) => (
    <QueryClientProvider client={client}>
      <ItemEditor
        listId={item.listId}
        item={record}
        rank={1}
        items={[record]}
        logs={[]}
        focusLogId={null}
        focusLogComposer={false}
        focusNoteComposer={false}
        onClose={() => {}}
        onCreated={() => {}}
      />
    </QueryClientProvider>
  );
  const view = render(editor(item));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My next draft' } });
  fireEvent.change(screen.getByLabelText(/Private note/), { target: { value: 'Still editing this.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Meh' }));
  view.rerender(editor({ ...item, updatedAt: 2, hasPhoto: true }));
  expect(screen.getByLabelText('Name')).toHaveValue('My next draft');
  expect(screen.getByLabelText(/Private note/)).toHaveValue('Still editing this.');
  expect(screen.getByRole('button', { name: 'Meh' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Meh' }));
  expect(screen.getByRole('heading', { name: 'My next draft' })).toBeInTheDocument();
  expect(screen.getByText('Undecided.')).toBeInTheDocument();
});

test('closing a nested confirmation does not close the editor or discard the draft', () => {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ItemEditor
        listId={item.listId}
        item={item}
        items={[item]}
        logs={[]}
        focusLogId={null}
        focusLogComposer={false}
        focusNoteComposer={false}
        onClose={onClose}
        onCreated={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  const confirmation = screen.getByRole('dialog', { name: 'Leave without saving?' }) as HTMLDialogElement;
  // A cleanup close event queued before the dialog reopens must be ignored.
  fireEvent(confirmation, new Event('close'));
  expect(screen.getByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
  confirmation.open = false;
  fireEvent(confirmation, new Event('close'));
  expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('Unsaved name');
  expect(onClose).not.toHaveBeenCalled();
});
