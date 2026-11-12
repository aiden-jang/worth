import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { api } from '../src/api';
import type { Item, ListDetail } from '../src/shared/models';
import type { MemoryRecord } from '../src/shared/memories';
import { QuickEntry } from '../src/components/QuickEntry';
import { CollectionView } from '../src/components/CollectionView';
import { TrashNotice } from '../src/components/TrashTools';
import { HomeReminders } from '../src/components/HomeReminders';

const list: ListDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Drinks',
  kind: 'collection',
  description: '',
  artwork: null,
  itemCount: 1,
  logCount: 0,
  rankedCount: 1,
  favoriteCount: 1,
  hasCoverPhoto: false,
  rankedIds: ['coffee'],
  rankRevision: 1,
  updatedAt: 1,
};
const coffee: Item = {
  id: 'coffee',
  listId: list.id,
  title: 'Coffee',
  type: '',
  note: '',
  decision: 'favorite',
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: 1,
  updatedAt: 1,
  logCount: 0,
  lastLoggedOn: null,
};
const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};

beforeEach(() => {
  vi.spyOn(api, 'items').mockResolvedValue({ items: [] });
  vi.spyOn(api, 'lists').mockResolvedValue({ lists: [] });
  localStorage.clear();
  sessionStorage.clear();
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

function setup(content: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(['me'], { user: { id: 'simpler-account' } });
  client.setQueryData(['workspace', list.id], { workspace: { rankings: [], views: [] }, revision: 0 });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{content}</MemoryRouter>
    </QueryClientProvider>,
  );
}

test('inline collection creation retains the item and call through a failed create and retry', async () => {
  const create = vi
    .spyOn(api, 'createList')
    .mockRejectedValueOnce(new Error('Try again'))
    .mockResolvedValue({ list });
  const save = vi
    .spyOn(api, 'createItem')
    .mockResolvedValue({ item: { ...coffee, title: 'Cold brew', decision: 'meh' } });
  const saved = vi.fn();
  setup(<QuickEntry lists={[]} initialListId="inbox" onClose={() => {}} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Cold brew' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save with details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Meh' }));
  fireEvent.click(screen.getByRole('button', { name: 'New collection' }));
  fireEvent.change(screen.getByLabelText('Collection name'), { target: { value: 'Drinks' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  expect(screen.getByLabelText('Name')).toHaveValue('Cold brew');
  fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));
  await waitFor(() => expect(screen.getByLabelText('Save in')).toHaveValue(list.id));
  expect(create).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Meh' })).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(screen.getByRole('button', { name: /^(Quick save|Save item)$/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: /^(Quick save|Save item)$/ }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(save).toHaveBeenCalledWith(
    list.id,
    expect.objectContaining({ title: 'Cold brew', decision: 'meh' }),
    expect.any(String),
  );
});

test('quick save ignores a legacy draft call and saves only a name', async () => {
  localStorage.setItem(
    `worth:draft:v1:simpler-account:capture:${list.id}`,
    JSON.stringify({
      form: { title: 'New tea', batchTitles: '', batchMode: false, decision: 'favorite', wantToTry: true },
      operationId: 'capture-operation',
      updatedAt: Date.now(),
    }),
  );
  const create = vi.spyOn(api, 'createItem').mockResolvedValue({
    item: { ...coffee, id: 'new-tea', title: 'New tea', decision: null },
  });
  const update = vi.spyOn(api, 'updateItem');
  setup(
    <CollectionView
      list={list}
      items={[coffee]}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />,
  );
  const filters = screen.getByRole('group', { name: 'Filter by personal call' });
  expect(screen.queryByText('New item options')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: 'Call for new item' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('group', { name: 'Filter by personal call' })).toHaveLength(1);
  fireEvent.click(within(filters).getByRole('button', { name: /^Favorite/ }));
  expect(screen.getByRole('textbox', { name: 'Add a name' })).toHaveValue('New tea');
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Quick save' }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      list.id,
      expect.objectContaining({ title: 'New tea', decision: null, wantToTry: false, note: '' }),
      'capture-operation',
    ),
  );
  expect(screen.getByRole('textbox', { name: 'Add a name' })).toHaveValue('');
  expect(update).not.toHaveBeenCalled();
});

test('save with details waits for the editor and retains the typed name', async () => {
  const saved = { ...coffee, id: 'new-tea', title: 'New tea', decision: 'meh' as const, note: 'Try iced' };
  const create = vi.spyOn(api, 'createItem').mockResolvedValue({ item: saved });
  vi.spyOn(api, 'updateItem').mockResolvedValue({ item: saved });
  setup(
    <CollectionView
      list={list}
      items={[coffee]}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Add a name' }), { target: { value: 'New tea' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save with details' }));
  const editor = screen.getByRole('dialog');
  expect(within(editor).getByLabelText('Name')).toHaveValue('New tea');
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(within(editor).getByRole('button', { name: 'Meh' }));
  fireEvent.change(within(editor).getByLabelText(/Private note/), { target: { value: 'Try iced' } });
  await waitFor(() => expect(within(editor).getByRole('button', { name: 'Save item' })).toBeEnabled());
  fireEvent.click(within(editor).getByRole('button', { name: 'Save item' }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      list.id,
      expect.objectContaining({ title: 'New tea', decision: 'meh', note: 'Try iced' }),
      expect.any(String),
    ),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Add a name' })).toHaveValue('');
});

test('row Trash confirms, preserves errors for retry, and can be cancelled', async () => {
  const remove = vi
    .spyOn(api, 'deleteItem')
    .mockRejectedValueOnce(new Error('Could not delete'))
    .mockResolvedValue(undefined);
  setup(
    <CollectionView
      list={list}
      items={[coffee]}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />,
  );
  const menu = screen.getByLabelText('More options for Coffee').closest('details')!;
  menu.open = true;
  fireEvent(menu, new Event('toggle'));
  fireEvent.click(await screen.findByRole('button', { name: 'Move to Trash: Coffee' }));
  fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Cancel' })[1]);
  expect(remove).not.toHaveBeenCalled();
  menu.open = true;
  fireEvent(menu, new Event('toggle'));
  fireEvent.click(await screen.findByRole('button', { name: 'Move to Trash: Coffee' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Move to Trash' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete');
  expect(screen.getByRole('button', { name: 'Coffee' })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Move to Trash' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(remove).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenLastCalledWith(coffee.id);
});

test('Trash notices expire after six seconds and pause while focused or hovered', async () => {
  vi.useFakeTimers();
  setup(<TrashNotice />);
  act(() =>
    window.dispatchEvent(new CustomEvent('worth:trashed', { detail: [{ kind: 'item', id: coffee.id }] })),
  );
  const notice = screen.getByRole('complementary', { name: 'Deletion recovery' });
  fireEvent.mouseEnter(notice);
  fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
  fireEvent.mouseLeave(notice);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(7000);
  });
  expect(notice).toBeInTheDocument();
  fireEvent.blur(screen.getByRole('button', { name: 'Undo' }), { relatedTarget: document.body });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5999);
  });
  expect(notice).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.queryByRole('complementary', { name: 'Deletion recovery' })).not.toBeInTheDocument();
});

test('browsing does not write and a failed direct call preserves the saved opinion for retry', async () => {
  const update = vi
    .spyOn(api, 'updateItem')
    .mockRejectedValueOnce(new Error('Call could not save'))
    .mockResolvedValue({ item: { ...coffee, decision: 'meh' } });
  const renderCollection = (items: Item[]) => (
    <CollectionView
      list={list}
      items={items}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />
  );
  setup(renderCollection([coffee, { ...coffee, id: 'tea', title: 'Tea', decision: null }]));
  expect(screen.getByRole('complementary', { name: 'Item preview' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Coffee' }));
  expect(update).not.toHaveBeenCalled();
  const preview = screen.getByRole('region', { name: 'Your call for Coffee' });
  fireEvent.click(within(preview).getByRole('button', { name: 'Meh' }));
  await waitFor(() => expect(within(preview).getByRole('alert')).toHaveTextContent('Call could not save'));
  expect(within(preview).getByText('Favorite.', { exact: true })).toBeInTheDocument();
  fireEvent.click(within(preview).getByRole('button', { name: 'Meh' }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(update).toHaveBeenLastCalledWith('coffee', { decision: 'meh' });
  const filters = screen.getByRole('group', { name: 'Filter by personal call' });
  fireEvent.click(within(filters).getByRole('button', { name: /^No call/ }));
  expect(screen.queryByRole('button', { name: 'Coffee' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tea' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Your call for Coffee' })).toBeInTheDocument();
  expect(list.rankedIds).toEqual(['coffee']);
});

test('favorite reminders draw from older pages and skip the current favorite when drawing again', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.98);
  const records: MemoryRecord[] = Array.from({ length: 55 }, (_, index) => ({
    id: `favorite-${index}`,
    itemId: `favorite-${index}`,
    listId: list.id,
    listName: list.name,
    title: `Favorite ${index + 1}`,
    note: '',
    date: '2025-01-01',
    kind: 'saved',
    location: '',
    order: '',
    reaction: 'favorite',
    hasPhoto: false,
  }));
  const memories = vi.spyOn(api, 'memories').mockImplementation(async (filter) => ({
    records: records.slice(filter.offset, filter.offset + 50),
    total: records.length,
    nextOffset: filter.offset + 50 < records.length ? filter.offset + 50 : null,
  }));
  setup(<HomeReminders />);
  expect(await screen.findByRole('link', { name: 'Favorite 54' })).toBeInTheDocument();
  expect(memories).toHaveBeenCalledWith(
    expect.objectContaining({ call: 'favorite', mode: 'saved', offset: 53 }),
    expect.any(AbortSignal),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show another' }));
  expect(await screen.findByRole('link', { name: 'Favorite 55' })).toBeInTheDocument();
});
