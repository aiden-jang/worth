import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { api } from '../src/api';
import { QuickEntry } from '../src/components/QuickEntry';
import { CollectionView } from '../src/components/CollectionView';
import { AppShell } from '../src/components/AppShell';
import { InboxPage } from '../src/pages/InboxPage';
import { announceSavedEntry, showMessage } from '../src/shared/feedback';
import { inboxPayload } from '../src/shared/inbox';
import type { Item, ListDetail } from '../src/shared/models';

const user = {
  id: 'cleanup-account',
  email: 'review@example.test',
  displayName: 'Review',
  emailVerified: true,
};
const list: ListDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Drinks',
  kind: 'collection',
  description: '',
  artwork: null,
  itemCount: 3,
  logCount: 1,
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
const methods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.spyOn(api, 'items').mockResolvedValue({ items: [] });
  vi.spyOn(api, 'lists').mockResolvedValue({ lists: [list] });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of Object.entries(methods)) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
function setup(children: ReactNode, path = '/') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(['me'], { user });
  client.setQueryData(['workspace', list.id], { workspace: { rankings: [], views: [] }, revision: 0 });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

test('global capture starts name-only and explicitly returning to quick save omits details', async () => {
  const create = vi.spyOn(api, 'createInbox').mockImplementation(async (entry) => ({
    entry: { ...entry, id: '22222222-2222-4222-8222-222222222222', revision: 0, createdAt: 1, updatedAt: 1 },
  }));
  setup(<QuickEntry lists={[list]} initialListId="inbox" onClose={() => {}} onSaved={() => {}} />);
  expect(screen.queryByRole('group', { name: 'Overall call' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Future tea' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save with details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Favorite' }));
  fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'Optional draft note' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Record a dated experience' }));
  fireEvent.change(screen.getByLabelText('When'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Name only' }));
  expect(screen.getByLabelText('When')).toBeDisabled();
  expect(screen.queryByRole('group', { name: 'This time' })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Quick save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Quick save' }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Future tea',
        note: '',
        decision: null,
        wantToTry: false,
        memory: null,
      }),
      expect.any(String),
    ),
  );
});

test('filter counts follow the view and search, with one clear-all action', () => {
  const items: Item[] = [
    coffee,
    { ...coffee, id: 'future', title: 'Future tea', decision: null, wantToTry: true },
    { ...coffee, id: 'tried', title: 'Tried tea', decision: 'meh', logCount: 1 },
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
  const calls = screen.getByRole('group', { name: 'Filter by personal call' });
  fireEvent.click(within(views).getByRole('button', { name: /^Want to try/ }));
  expect(within(calls).getByRole('button', { name: 'All calls 1' })).toBeInTheDocument();
  expect(within(calls).getByRole('button', { name: 'Favorite 0' })).toBeInTheDocument();
  expect(within(calls).getByRole('button', { name: 'No call 1' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search Drinks' }), { target: { value: 'Coffee' } });
  expect(within(calls).getByRole('button', { name: 'All calls 0' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Active filters' })).toHaveTextContent(
    '0 results · Search: Coffee · Want to try',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(within(calls).getByRole('button', { name: 'All calls 3' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Coffee' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Active filters' })).not.toBeInTheDocument();
  expect(screen.getByRole('complementary', { name: 'Item preview' })).toHaveTextContent('Select an item');
});

test('older saved Favorites views use the one visible call filter', async () => {
  const { client } = setup(
    <CollectionView
      list={list}
      items={[coffee, { ...coffee, id: 'tea', title: 'Tea', decision: null }]}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />,
  );
  act(() =>
    client.setQueryData(['workspace', list.id], {
      workspace: {
        rankings: [],
        views: [
          {
            id: 'old-view',
            name: 'Old favorites',
            filters: {
              label: '',
              stamp: '',
              browse: 'kept',
              search: '',
              type: 'all',
              brand: '',
              rankFilter: 'all',
              decisionFilter: 'all',
              sort: 'rank',
              addedSince: '',
              addedBefore: '',
              visits: 'all',
            },
          },
        ],
      },
      revision: 0,
    }),
  );
  fireEvent.click(screen.getByLabelText('Entry options'));
  fireEvent.click(await screen.findByText('Saved views · 1'));
  fireEvent.click(screen.getByRole('button', { name: 'Old favorites' }));
  const calls = screen.getByRole('group', { name: 'Filter by personal call' });
  await waitFor(() =>
    expect(within(calls).getByRole('button', { name: 'Favorite 1' })).toHaveAttribute('aria-pressed', 'true'),
  );
  expect(screen.getByRole('button', { name: 'Coffee' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tea' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Favorites/ })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Active filters' })).toHaveTextContent('1 result · Favorite');
});

function RouteProbe() {
  return <output data-testid="route">{useLocation().search}</output>;
}
test('closing Unfiled readers clears their route and never reopens a stale selection', async () => {
  const entry = {
    ...inboxPayload.parse({ title: 'Earlier find' }),
    id: '22222222-2222-4222-8222-222222222222',
    revision: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  vi.spyOn(api, 'inbox').mockResolvedValue({ entries: [entry] });
  const { client } = setup(
    <>
      <InboxPage />
      <RouteProbe />
    </>,
    '/inbox',
  );
  for (const method of ['escape', 'button', 'backdrop']) {
    fireEvent.click(await screen.findByRole('button', { name: /^View Earlier find/ }));
    const reader = await screen.findByRole('dialog', { name: 'Earlier find' });
    expect(screen.getByTestId('route')).toHaveTextContent(`focus=${entry.id}`);
    if (method === 'escape') fireEvent.keyDown(reader, { key: 'Escape' });
    else if (method === 'button')
      fireEvent.click(within(reader).getByRole('button', { name: 'Close details' }));
    else fireEvent.click(reader);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('route')).toBeEmptyDOMElement();
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['inbox'] });
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
});

test('shared messages replace saved feedback and keep keyboard focus pauses separate from hover', async () => {
  vi.useFakeTimers();
  setup(
    <AppShell user={user} authOrigin="https://accounts.example.test">
      <main>
        <h1>Drinks</h1>
      </main>
    </AppShell>,
  );
  act(() => announceSavedEntry({ id: coffee.id, listId: list.id, title: coffee.title, kind: 'item' }));
  const saved = screen.getByRole('status');
  expect(within(saved).getByRole('link', { name: 'Open' })).toBeInTheDocument();
  fireEvent.mouseEnter(saved);
  fireEvent.focus(within(saved).getByRole('button', { name: 'Undo' }));
  fireEvent.mouseLeave(saved);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(7000);
  });
  expect(saved).toBeInTheDocument();
  act(() => showMessage('Ranking saved.'));
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('Ranking saved.');
  expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6100);
  });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('Undo removes a collection save message and its recovery controls', async () => {
  const remove = vi.spyOn(api, 'deleteItem').mockResolvedValue(undefined);
  setup(
    <AppShell user={user} authOrigin="https://accounts.example.test">
      <main>
        <h1>Drinks</h1>
      </main>
    </AppShell>,
  );
  act(() =>
    announceSavedEntry(
      { id: coffee.id, listId: list.id, title: coffee.title, kind: 'item' },
      'Coffee added to Drinks.',
    ),
  );
  fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith(coffee.id));
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});
