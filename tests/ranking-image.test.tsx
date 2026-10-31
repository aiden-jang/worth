import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Item, ListDetail } from '../src/shared/models';
import { ShareDialog } from '../src/components/ShareDialog';
import { renderRankingImage, saveRankingImage } from '../src/shared/ranking-image';

vi.mock('../src/shared/ranking-image', () => ({ saveRankingImage: vi.fn(), renderRankingImage: vi.fn() }));
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const createUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const revokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const createObjectURL = vi.fn<(file: Blob) => string>(() => 'blob:ranking-preview');
beforeEach(() => {
  vi.mocked(saveRankingImage).mockReset();
  vi.mocked(renderRankingImage)
    .mockReset()
    .mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  createObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
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
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (createUrl) Object.defineProperty(URL, 'createObjectURL', createUrl);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  if (revokeUrl) Object.defineProperty(URL, 'revokeObjectURL', revokeUrl);
  else Reflect.deleteProperty(URL, 'revokeObjectURL');
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
  artwork: { object: 'plant', tone: 'clay' },
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
  fireEvent.click(await screen.findByRole('button', { name: 'Save ranking image' }));
  await waitFor(() =>
    expect(renderRankingImage).toHaveBeenLastCalledWith({
      title: 'Drinks',
      artwork: { object: 'plant', tone: 'clay' },
      entries: [6, 5, 4, 3, 2].map((i) => ({ title: `Drink ${i}`, type: 'Coffee' })),
    }),
  );
  expect(JSON.stringify(vi.mocked(renderRankingImage).mock.calls)).not.toMatch(
    /Private|decision|hasPhoto|startedOn|Drink 7/,
  );
  const file = createObjectURL.mock.calls.at(-1)![0];
  expect(saveRankingImage).toHaveBeenCalledWith(file);
  expect(renderRankingImage).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Preview image', { exact: true }));
  expect(screen.getByRole('img', { name: 'Ranking image for Drinks' })).toHaveAttribute(
    'src',
    'blob:ranking-preview',
  );
  expect(await screen.findByText('Download started.')).toBeInTheDocument();
});
test('a failed image preserves the preview and offers a retry', async () => {
  vi.mocked(renderRankingImage).mockRejectedValueOnce(new Error('no canvas'));
  open();
  expect(await screen.findByText('Couldn’t prepare the image. Try again.')).toBeInTheDocument();
  expect(screen.getByText('Drink 6')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry image' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save ranking image' }));
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
    artwork: { object: 'plant', tone: 'clay' },
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
  expect(file).toBe(createObjectURL.mock.calls[0]![0]);
  await waitFor(() => expect(button).toBeEnabled());
  expect(saveRankingImage).not.toHaveBeenCalled();
  expect(screen.queryByText(/Couldn’t share/)).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(await screen.findByText('Image handed to the share sheet.')).toBeInTheDocument();
  expect(renderRankingImage).toHaveBeenCalledTimes(1);
});

test('an unsupported native share check leaves the image preview and download usable', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: () => {
      throw new TypeError('unsupported');
    },
  });
  open();
  const save = await screen.findByRole('button', { name: 'Save ranking image' });
  expect(screen.queryByRole('button', { name: 'Share ranking image' })).not.toBeInTheDocument();
  fireEvent.click(save);
  expect(saveRankingImage).toHaveBeenCalledTimes(1);
});

test('a denied clipboard write offers recovery and retry without losing the link', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((_path, init) =>
      Promise.resolve(
        Response.json(
          init?.method === 'POST'
            ? { id: 'share', token: 'local-token', share: {}, expiresAt: Date.now() + 1000 }
            : { shares: [] },
        ),
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
