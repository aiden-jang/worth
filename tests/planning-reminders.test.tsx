import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { api } from '../src/api';
import { QuickEntry } from '../src/components/QuickEntry';
import { TryReview } from '../src/components/TryReview';
import { CollectionView } from '../src/components/CollectionView';
import { HomeReminders } from '../src/components/HomeReminders';
import { ArchivePage } from '../src/pages/ArchivePage';
import { loadHomeReminder } from '../src/shared/home-reminders';
import { inboxPayload } from '../src/shared/inbox';
import { today } from '../src/format';
import type { MemoryFilter, MemoryPage, MemoryRecord } from '../src/shared/memories';
import type { Item, ListDetail } from '../src/shared/models';

const list: ListDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Drinks',
  kind: 'collection',
  description: '',
  artwork: null,
  itemCount: 3,
  logCount: 0,
  rankedCount: 1,
  favoriteCount: 1,
  hasCoverPhoto: false,
  rankedIds: ['22222222-2222-4222-8222-222222222222'],
  rankRevision: 1,
  updatedAt: 1,
};
const item: Item = {
  id: list.rankedIds[0],
  listId: list.id,
  title: 'Waiting coffee',
  type: '',
  note: 'Keep this note',
  decision: null,
  wantToTry: true,
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: 1,
  updatedAt: 1,
  logCount: 0,
  lastLoggedOn: null,
};
const base: MemoryRecord = {
  id: 'old-favorite',
  itemId: 'old-favorite',
  listId: list.id,
  listName: list.name,
  title: 'Old favorite',
  note: '',
  date: '2025-01-01',
  kind: 'saved',
  location: '',
  order: '',
  reaction: 'favorite',
  hasPhoto: false,
  wantToTry: false,
};
function archive() {
  return [
    { ...base },
    {
      ...base,
      id: 'waiting',
      itemId: 'waiting',
      title: 'Still to try',
      date: '2026-11-01',
      reaction: null,
      wantToTry: true,
    },
    {
      ...base,
      id: 'recent',
      itemId: 'a-saved-item',
      title: 'A recent visit',
      date: '2026-11-10',
      kind: 'visit',
      reaction: 'meh',
    },
  ] as MemoryRecord[];
}
function reader(records: MemoryRecord[]) {
  return vi.fn(async (filter: MemoryFilter): Promise<MemoryPage> => {
    const matching = records.filter(
      (record) =>
        (filter.mode === 'saved'
          ? ['saved', 'unfiled'].includes(record.kind)
          : !['saved', 'unfiled'].includes(record.kind)) &&
        (!filter.experiences || ['visit', 'unfiled-visit'].includes(record.kind)) &&
        (!filter.id || record.id === filter.id) &&
        (!filter.call || record.reaction === filter.call) &&
        (!filter.want || !!record.wantToTry === (filter.want === '1')) &&
        (!filter.from || record.date >= filter.from) &&
        (!filter.to || record.date <= filter.to),
    );
    return {
      records: matching.slice(filter.offset, filter.offset + 50),
      total: matching.length,
      nextOffset: filter.offset + 50 < matching.length ? filter.offset + 50 : null,
    };
  });
}
const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
beforeEach(() => {
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
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(api, 'items').mockResolvedValue({ items: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of Object.entries(dialogMethods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
function setup(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(['workspace', list.id], { workspace: { rankings: [], views: [] }, revision: 0 });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

test('Want to try is visible during capture and parks an unsaved opinion until the choice is reversed', async () => {
  const create = vi.spyOn(api, 'createInbox').mockImplementation(async (payload) => ({
    entry: { ...payload, id: item.id, revision: 0, createdAt: 1, updatedAt: 1 },
  }));
  setup(<QuickEntry lists={[list]} initialListId="inbox" onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Some future coffee' } });
  fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Want to try/ }));
  expect(screen.queryByRole('button', { name: 'Favorite' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Want to try/ }));
  expect(screen.getByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('checkbox', { name: /Want to try/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(create).toHaveBeenCalled());
  expect(create.mock.calls[0][0]).toMatchObject({ wantToTry: true, decision: null, memory: null });
});

test('planned item review saves a call and leaves the plan without touching rank, note or visits', async () => {
  const update = vi
    .spyOn(api, 'updateItem')
    .mockResolvedValue({ item: { ...item, decision: 'meh', wantToTry: false } });
  const experience = vi.spyOn(api, 'createExperience');
  const { client } = setup(
    <TryReview target={{ kind: 'item', id: item.id, title: item.title, initial: item }} />,
  );
  client.setQueryData(['items', list.id], { items: [item] });
  fireEvent.click(screen.getByRole('button', { name: 'I tried it' }));
  fireEvent.click(screen.getByRole('button', { name: 'Meh' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(item.id, { decision: 'meh', wantToTry: false }));
  await waitFor(() =>
    expect(client.getQueryData<{ items: Item[] }>(['items', list.id])?.items[0]).toMatchObject({
      note: 'Keep this note',
      wantToTry: false,
      decision: 'meh',
    }),
  );
  expect(list.rankedIds).toEqual([item.id]);
  expect(experience).not.toHaveBeenCalled();
});

test('removing a plan without a new call preserves its existing opinion and adds no visit', async () => {
  const saved = { ...item, decision: 'favorite' as const };
  const update = vi.spyOn(api, 'updateItem').mockResolvedValue({ item: { ...saved, wantToTry: false } });
  const experience = vi.spyOn(api, 'createExperience');
  setup(<TryReview target={{ kind: 'item', id: saved.id, title: saved.title, initial: saved }} />);
  fireEvent.click(screen.getByRole('button', { name: 'I tried it' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove from Want to try' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(saved.id, { wantToTry: false }));
  expect(experience).not.toHaveBeenCalled();
});

test('an Unfiled plan keeps its full content and revision when reviewed, and the same call can retry', async () => {
  const entry = {
    ...inboxPayload.parse({
      title: 'Future book',
      note: 'My note',
      type: 'Book',
      wantToTry: true,
      context: { location: 'Home' },
    }),
    id: item.id,
    revision: 7,
    createdAt: 1,
    updatedAt: 1,
  };
  const update = vi
    .spyOn(api, 'updateInbox')
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValue({ entry: { ...entry, wantToTry: false, decision: 'favorite' } });
  setup(<TryReview target={{ kind: 'inbox', id: entry.id, title: entry.title, initial: entry }} />);
  fireEvent.click(screen.getByRole('button', { name: 'I tried it' }));
  fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(update.mock.calls[0]).toEqual(update.mock.calls[1]);
  expect(update).toHaveBeenLastCalledWith(
    entry.id,
    expect.objectContaining({
      note: 'My note',
      context: expect.objectContaining({ location: 'Home' }),
      wantToTry: false,
      decision: 'favorite',
    }),
    7,
  );
});

test('collection views distinguish plans, actual opinions or experiences, and name-only saves', () => {
  const items = [
    item,
    { ...item, id: 'rated', title: 'Rated tea', wantToTry: false, decision: 'meh' as const },
    { ...item, id: 'name-only', title: 'Just a name', wantToTry: false },
  ];
  setup(
    <CollectionView
      list={list}
      items={items}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />,
  );
  const views = screen.getByRole('group', { name: 'Collection views' });
  fireEvent.click(within(views).getByRole('button', { name: /^Want to try/ }));
  expect(document.querySelectorAll('.collection-index-row')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Waiting coffee Want to try' })).toBeInTheDocument();
  fireEvent.click(within(views).getByRole('button', { name: /^Tried/ }));
  expect(document.querySelectorAll('.collection-index-row')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Rated tea' })).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Browse collection' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'More filters' }));
  expect(screen.getByRole('combobox', { name: 'Browse collection' })).toBeInTheDocument();
});

test('reminders rotate through old favorites, plans and recent experiences', async () => {
  const records = archive();
  const read = reader(records);
  const favorite = await loadHomeReminder(read, '2026-11-11', 0, null, false);
  expect(favorite?.record.id).toBe('old-favorite');
  const wanted = await loadHomeReminder(read, '2026-11-11', 0, favorite, false);
  expect(wanted?.kind).toBe('want');
  const recent = await loadHomeReminder(read, '2026-11-11', 0, wanted, false);
  expect(recent?.record.id).toBe('recent');
  expect((await loadHomeReminder(read, '2026-11-11', 0, null, false, 0.5))?.kind).toBe('want');
});

test('refresh keeps the same reminder when counts and order change and updates its saved text', async () => {
  const records = archive();
  const read = reader(records);
  const first = await loadHomeReminder(read, '2026-11-11', 0, null, false);
  records.unshift({ ...base, id: 'another-favorite', title: 'Another favorite' });
  records.find((record) => record.id === 'old-favorite')!.title = 'Updated saved title';
  read.mockClear();
  const next = await loadHomeReminder(read, '2026-11-11', 0.99, first, true);
  expect(next?.record).toMatchObject({ id: 'old-favorite', title: 'Updated saved title' });
  expect(read).toHaveBeenCalledTimes(1);
  expect(read.mock.calls[0][0].id).toBe('old-favorite');
});

test('a plan that was tried stops being a plan reminder on refresh', async () => {
  const records = archive();
  const read = reader(records);
  const planned = await loadHomeReminder(read, '2026-11-11', 0, null, false, 0.5);
  records.find((record) => record.id === 'waiting')!.wantToTry = false;
  const next = await loadHomeReminder(read, '2026-11-11', 0, planned, true);
  expect(next?.kind).toBe('experience');
});

test('older favorite pages remain reachable and failures in one source allow healthy sources', async () => {
  const records = Array.from({ length: 55 }, (_, index) => ({ ...base, id: `favorite-${index}` }));
  const read = reader(records);
  expect((await loadHomeReminder(read, '2026-11-11', 0.99, null, false))?.record.id).toBe('favorite-54');
  expect(read.mock.calls.some(([filter]) => filter.offset === 54)).toBe(true);
  const healthy = reader(archive());
  const partial = async (filter: MemoryFilter) => {
    if (filter.want === '1') throw new Error('Plans unavailable');
    return healthy(filter);
  };
  expect((await loadHomeReminder(partial, '2026-11-11', 0, null, false))?.kind).toBe('favorite');
  await expect(
    loadHomeReminder(
      async () => {
        throw new Error('Unavailable');
      },
      '2026-11-11',
      0,
      null,
      false,
    ),
  ).rejects.toThrow('Reminders couldn’t load');
});

test('recent favorites remain usable in a sparse archive without being described as old', async () => {
  const result = await loadHomeReminder(
    reader([{ ...base, date: '2026-11-10' }]),
    '2026-11-11',
    0,
    null,
    false,
  );
  expect(result?.kind).toBe('favorite');
  expect(result?.filter.to).toBe('');
});

test('Home rotates its reminder explicitly and keeps a refreshed selection steady', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const records = archive().map((record) =>
    record.kind === 'visit' ? { ...record, date: today() } : record,
  );
  vi.spyOn(api, 'memories').mockImplementation(reader(records));
  const { client } = setup(<HomeReminders />);
  await screen.findByRole('link', { name: 'Old favorite' });
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['patterns'] });
  });
  expect(screen.getByRole('link', { name: 'Old favorite' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show another' }));
  await screen.findByRole('link', { name: 'Still to try' });
  expect(screen.getByRole('button', { name: 'I tried it' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Show another' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Show another' }));
  await screen.findByRole('link', { name: 'A recent visit' });
});

test('Home keeps the extra memory and insight material optional', async () => {
  vi.spyOn(api, 'overview').mockResolvedValue({
    lists: [list],
    recent: [],
    ranked: [],
    favorites: [],
    notAgain: [],
    lastTimes: [],
  });
  vi.spyOn(api, 'inbox').mockResolvedValue({ entries: [] });
  vi.spyOn(api, 'memories').mockImplementation(reader([]));
  const preferences = vi
    .spyOn(api, 'preferences')
    .mockResolvedValue({ groups: [], returns: [], rediscover: [] });
  const progress = vi.spyOn(api, 'homeProgress').mockResolvedValue({ progress: null });
  setup(<ArchivePage />);
  await screen.findByText('More from your archive');
  expect(preferences).not.toHaveBeenCalled();
  expect(progress).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('More from your archive'));
  await waitFor(() => expect(preferences).toHaveBeenCalled());
  expect(await screen.findByRole('region', { name: 'Memory shelf' })).toBeInTheDocument();
});
