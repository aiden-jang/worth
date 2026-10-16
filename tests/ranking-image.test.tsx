import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Item, ListDetail } from '../src/shared/models';
import { ShareDialog } from '../src/components/ShareDialog';
import { renderRankingImage, saveRankingImage } from '../src/shared/ranking-image';

vi.mock('../src/shared/ranking-image', () => ({ saveRankingImage: vi.fn(), renderRankingImage: vi.fn() }));
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
beforeEach(() => {
  vi.mocked(saveRankingImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(renderRankingImage)
    .mockReset()
    .mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});
const items: Item[] = Array.from({ length: 8 }, (_, i) => ({
  id: String(i),
  listId: 'list',
  title: `Drink ${i}`,
  type: 'Coffee',
  note: 'Private note',
  decision: 'meh',
  startedOn: '2026-10-14',
  endedOn: null,
  hasPhoto: true,
  createdAt: 1,
  updatedAt: 1,
  logCount: 3,
  lastLoggedOn: '2026-10-14',
}));
const list: ListDetail = {
  id: 'list',
  name: 'Drinks',
  kind: 'collection',
  description: 'Private description',
  itemCount: 8,
  logCount: 0,
  rankedCount: 7,
  favoriteCount: 0,
  hasCoverPhoto: true,
  rankedIds: ['6', '5', '4', '3', '2', '1', '0'],
  rankRevision: 1,
  updatedAt: 1,
};
function open() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['shares', 'list'], { shares: [] });
  render(
    <QueryClientProvider client={client}>
      <ShareDialog list={list} items={items} onClose={() => {}} />
    </QueryClientProvider>,
  );
}
test('an image uses saved ranking order and only the previewed public fields', async () => {
  open();
  fireEvent.change(screen.getByLabelText('Include'), { target: { value: 'all' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save ranking image' }));
  await waitFor(() =>
    expect(saveRankingImage).toHaveBeenCalledWith({
      title: 'Drinks',
      entries: [6, 5, 4, 3, 2].map((i) => ({ title: `Drink ${i}`, type: 'Coffee' })),
    }),
  );
  expect(JSON.stringify(vi.mocked(saveRankingImage).mock.calls)).not.toMatch(
    /Private|decision|hasPhoto|startedOn|Drink 7/,
  );
  expect(await screen.findByText('Download started.')).toBeInTheDocument();
});
test('a failed image preserves the preview and offers a retry', async () => {
  vi.mocked(saveRankingImage).mockRejectedValueOnce(new Error('no canvas'));
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Save ranking image' }));
  expect(await screen.findByText('Couldn’t save the image. Try again.')).toBeInTheDocument();
  expect(screen.getByText('Drink 6')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save ranking image' }));
  expect(await screen.findByText('Download started.')).toBeInTheDocument();
});

test('native images are prepared with public fields before sharing, and cancelling does not download', async () => {
  const share = vi
    .fn()
    .mockRejectedValueOnce(new DOMException('closed', 'AbortError'))
    .mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  open();
  const button = await screen.findByRole('button', { name: 'Share ranking image' });
  expect(renderRankingImage).toHaveBeenLastCalledWith({
    title: 'Drinks',
    entries: [6, 5, 4, 3, 2].map((i) => ({ title: `Drink ${i}`, type: 'Coffee' })),
  });
  expect(JSON.stringify(vi.mocked(renderRankingImage).mock.calls)).not.toMatch(
    /Private|decision|hasPhoto|startedOn/,
  );
  fireEvent.click(button);
  expect(share).toHaveBeenCalledTimes(1);
  const file = share.mock.calls[0]![0].files[0] as File;
  expect(file.name).toMatch(/^worth-drinks-\d{4}-\d{2}-\d{2}\.png$/);
  expect(file.type).toBe('image/png');
  await waitFor(() => expect(button).toBeEnabled());
  expect(saveRankingImage).not.toHaveBeenCalled();
  expect(screen.queryByText(/Couldn’t share/)).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(await screen.findByText('Image handed to the share sheet.')).toBeInTheDocument();
});

test('a denied clipboard write offers recovery and retry without losing the link', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'share', token: 'local-token', share: {}, expiresAt: Date.now() + 1000 }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
  );
  const copy = vi
    .fn()
    .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    .mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  try {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    const button = await screen.findByRole('button', { name: 'Copy link' });
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t copy the link.');
    expect((screen.getByLabelText('Share link') as HTMLInputElement).value).toContain('/s/local-token');
    fireEvent.click(button);
    await screen.findByRole('button', { name: 'Link copied' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});
