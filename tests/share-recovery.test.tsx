import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { api, RequestError } from '../src/api';
import { ShareDialog } from '../src/components/ShareDialog';
import type { Item, ListDetail } from '../src/shared/models';

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
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
  vi.restoreAllMocks();
  for (const [name, descriptor] of [
    ['showModal', originalShow],
    ['close', originalClose],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

const list: ListDetail = {
  id: 'list',
  name: 'My drinks',
  kind: 'collection',
  description: '',
  itemCount: 1,
  logCount: 0,
  rankedCount: 1,
  favoriteCount: 0,
  hasCoverPhoto: false,
  rankedIds: ['item'],
  rankRevision: 1,
  updatedAt: 1,
};
const item: Item = {
  id: 'item',
  listId: list.id,
  title: 'Coffee',
  type: 'Drink',
  note: 'Private',
  decision: null,
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: 1,
  updatedAt: 1,
  logCount: 0,
  lastLoggedOn: null,
};
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <ShareDialog list={list} items={[item]} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

test('a failed active-link lookup stays visible and can be retried', async () => {
  vi.spyOn(api, 'shares')
    .mockRejectedValueOnce(new RequestError(503, 'UNAVAILABLE', 'Please retry.'))
    .mockResolvedValue({
      shares: [
        { id: 'share', title: 'My drinks', createdAt: 1, expiresAt: Date.now() + 86400000, revokedAt: null },
      ],
    });
  open();
  expect(await screen.findByRole('alert')).toHaveTextContent(/active.*links/i);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('link creation holds the preview and dialog open until the snapshot is confirmed', async () => {
  vi.spyOn(api, 'shares').mockResolvedValue({ shares: [] });
  let resolve!: (value: Awaited<ReturnType<typeof api.createShare>>) => void;
  vi.spyOn(api, 'createShare').mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() => expect(api.createShare).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Include')).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Close$/ })).toBeDisabled();
  const dialog = screen.getByRole('dialog');
  const cancel = new Event('cancel', { cancelable: true, bubbles: true });
  fireEvent(dialog, cancel);
  expect(cancel.defaultPrevented).toBe(true);
  resolve({
    id: 'share',
    token: 'review-token',
    share: { createdAt: 1, title: list.name, entries: [{ rank: 1, title: item.title, type: item.type }] },
    expiresAt: Date.now() + 86400000,
  });
  expect(((await screen.findByLabelText('Share link')) as HTMLInputElement).value).toContain(
    '/s/review-token',
  );
  expect(screen.getByLabelText('Include')).toBeEnabled();
});
