import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QuickEntry } from '../src/components/QuickEntry';
import { CollectionView } from '../src/components/CollectionView';
import { InboxPage } from '../src/pages/InboxPage';
import { api } from '../src/api';
import * as books from '../src/shared/book-lookup';
import { applyCaptureSuggestion, matchingSavedItems } from '../src/shared/capture-assist';
import { emptyItemContext } from '../src/shared/item-context';
import { inboxPayload, type InboxEntry } from '../src/shared/inbox';
import type { Item, ListDetail } from '../src/shared/models';
import type { QuickEntryDraft } from '../src/shared/quick-entry';

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
  rankedIds: ['22222222-2222-4222-8222-222222222222'],
  rankRevision: 1,
  updatedAt: 1,
};
const coffee: Item = {
  id: list.rankedIds[0],
  listId: list.id,
  title: 'Coffee',
  type: '',
  note: 'Original note',
  decision: 'favorite',
  startedOn: null,
  endedOn: null,
  hasPhoto: false,
  createdAt: 1,
  updatedAt: 1,
  logCount: 0,
  lastLoggedOn: null,
};
const find: InboxEntry = {
  ...inboxPayload.parse({
    title: 'An illustrated book',
    type: 'Book',
    note: 'Keep this note',
    decision: 'meh',
  }),
  id: '33333333-3333-4333-8333-333333333333',
  revision: 7,
  createdAt: 1,
  updatedAt: 1,
};
const initial: QuickEntryDraft = {
  listId: 'inbox',
  title: '',
  type: '',
  context: emptyItemContext,
  itemId: null,
  note: '',
  decision: null,
  wantToTry: false,
  experienced: false,
  happenedOn: '2026-11-11',
  pending: null,
};
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
  vi.spyOn(api, 'lists').mockResolvedValue({ lists: [list] });
  vi.spyOn(api, 'inbox').mockResolvedValue({ entries: [find] });
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
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(['me'], { user: { id: 'assist-account' } });
  client.setQueryData(['workspace', list.id], { workspace: { rankings: [], views: [] }, revision: 0 });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>,
    ),
    client,
  };
}

test('name matching normalizes spacing and Unicode without merging distinct items', () => {
  expect(matchingSavedItems([coffee], '  ＣＯＦＦＥＥ  ')).toEqual([coffee]);
  expect(matchingSavedItems([coffee], 'Coffee beans')).toEqual([]);
  expect(matchingSavedItems([coffee], '')).toEqual([]);
});

test('capture suggestions preserve a draft’s context and append notes without truncation', () => {
  const form = {
    ...initial,
    title: 'Old name',
    note: 'My note',
    decision: 'meh' as const,
    context: { ...emptyItemContext, location: 'Brooklyn', fields: [{ name: 'Brand', value: 'Harbor' }] },
  };
  expect(
    applyCaptureSuggestion(form, {
      title: 'New book',
      code: '9780140328721',
      type: 'Book',
      note: 'Author: Someone',
    }),
  ).toMatchObject({
    title: 'New book',
    decision: 'meh',
    note: 'My note\n\nAuthor: Someone',
    context: {
      location: 'Brooklyn',
      fields: [
        { name: 'Brand', value: 'Harbor' },
        { name: 'Barcode', value: '9780140328721' },
      ],
    },
  });
  expect(() =>
    applyCaptureSuggestion({ ...form, note: 'n'.repeat(4000) }, { title: 'Book', note: 'More' }),
  ).toThrow('combined note');
  expect(form.context.fields).toHaveLength(1);
});

test('pasting a link into Name fills a reviewed name and keeps the source in the saved item', async () => {
  const save = vi
    .spyOn(api, 'createInbox')
    .mockImplementation(async (payload) => ({ entry: { ...find, ...payload } }));
  const saved = vi.fn();
  setup(<QuickEntry lists={[list]} initialListId="inbox" onClose={() => {}} onSaved={saved} />);
  fireEvent.paste(screen.getByLabelText('Name'), {
    clipboardData: { getData: () => 'https://example.test/places/corner-ramen' },
  });
  expect(screen.getByLabelText('Name')).toHaveValue('corner ramen');
  expect(screen.getByText('Source: https://example.test/places/corner-ramen')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'corner ramen',
      context: expect.objectContaining({ sourceUrl: 'https://example.test/places/corner-ramen' }),
    }),
    expect.any(String),
  );
});

test('photo text can supply a name inside Add without changing its destination or rating', async () => {
  setup(<QuickEntry lists={[list]} initialListId={list.id} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Meh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Photo text' }));
  fireEvent.change(screen.getByLabelText('Read or pasted text'), {
    target: { value: 'CORNER CAFE\nOat latte\n$6.00' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Use Oat latte' }));
  expect(screen.getByLabelText('Name')).toHaveValue('Oat latte');
  expect(screen.getByLabelText('Save in')).toHaveValue(list.id);
  expect(screen.getByRole('button', { name: 'Meh' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('region', { name: 'Read photo text' })).not.toBeInTheDocument();
});

test('an unapplied capture source recovers with its account-scoped item draft', () => {
  const content = <QuickEntry lists={[list]} initialListId="inbox" onClose={() => {}} onSaved={() => {}} />;
  const first = setup(content);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My unfinished item' } });
  fireEvent.click(screen.getByRole('button', { name: 'Paste link' }));
  fireEvent.change(screen.getByLabelText('Link'), { target: { value: 'https://example.test/corner-ramen' } });
  first.unmount();
  setup(content);
  expect(screen.getByLabelText('Name')).toHaveValue('My unfinished item');
  expect(screen.getByLabelText('Link')).toHaveValue('https://example.test/corner-ramen');
});

test('ISBN lookup is explicit and supplied book details append to an existing note', async () => {
  const lookup = vi.spyOn(books, 'lookupBook').mockResolvedValue({
    code: '9780140328721',
    title: 'Matilda',
    authors: ['Roald Dahl'],
    publishers: [],
    published: '1988',
  });
  const save = vi
    .spyOn(api, 'createInbox')
    .mockImplementation(async (payload) => ({ entry: { ...find, ...payload } }));
  setup(<QuickEntry lists={[list]} initialListId="inbox" onClose={() => {}} onSaved={() => {}} />);
  fireEvent.click(screen.getByText('Add details', { selector: 'summary' }));
  fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'My note' } });
  fireEvent.click(screen.getByRole('button', { name: 'Barcode' }));
  fireEvent.change(screen.getByLabelText('Barcode or ISBN'), { target: { value: '9780140328721' } });
  expect(lookup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Look up book' }));
  await screen.findByRole('button', { name: 'Use book details' });
  fireEvent.click(screen.getByRole('button', { name: 'Use book details' }));
  expect(screen.getByLabelText('Name')).toHaveValue('Matilda');
  expect(screen.getByLabelText(/Note/)).toHaveValue('My note\n\nAuthor: Roald Dahl\nPublished: 1988');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0]).toMatchObject({
    type: 'Book',
    context: { fields: [{ name: 'Barcode', value: '9780140328721' }] },
  });
});

test('an existing name offers a dated experience without changing the saved item’s call', async () => {
  vi.mocked(api.items).mockResolvedValue({ items: [coffee] });
  const update = vi.spyOn(api, 'updateItem');
  const create = vi.spyOn(api, 'createItem');
  const experience = vi.spyOn(api, 'createExperience').mockResolvedValue({
    item: coffee,
    log: {
      id: '44444444-4444-4444-8444-444444444444',
      listId: list.id,
      itemId: coffee.id,
      title: 'Coffee',
      happenedOn: '2026-11-11',
      note: '',
      context: { reaction: 'meh', location: '', version: '', order: '' },
      amount: null,
      unit: '',
      sets: null,
      reps: null,
      hasPhoto: false,
      createdAt: 1,
      updatedAt: 1,
    },
  });
  setup(<QuickEntry lists={[list]} initialListId={list.id} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' coffee ' } });
  await screen.findByRole('button', { name: 'Add another experience' });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Add another experience' }));
  expect(screen.getByLabelText('When')).toBeInTheDocument();
  fireEvent.click(
    within(screen.getByRole('group', { name: 'This time' })).getByRole('button', { name: 'Meh' }),
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(experience).toHaveBeenCalled());
  expect(experience.mock.calls[0][1]).toMatchObject({ itemId: coffee.id, context: { reaction: 'meh' } });
  expect(create).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  expect(coffee.decision).toBe('favorite');
});

test('a duplicate is saved only after explicitly choosing a separate item', async () => {
  vi.mocked(api.items).mockResolvedValue({ items: [coffee] });
  const create = vi.spyOn(api, 'createItem').mockResolvedValue({ item: coffee });
  setup(<QuickEntry lists={[list]} initialListId={list.id} onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Coffee' } });
  await screen.findByRole('button', { name: 'Save as a separate item' });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save as a separate item' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
});

test('collection capture recovers the exact pending request after a lost reply and remount', async () => {
  const create = vi
    .spyOn(api, 'createItem')
    .mockRejectedValueOnce(new Error('Reply lost'))
    .mockResolvedValue({ item: { ...coffee, title: 'New tea', decision: null } });
  const content = (items: Item[]) => (
    <CollectionView
      list={list}
      items={items}
      focusCapture={false}
      onOpenDetails={() => {}}
      onAddNote={() => {}}
      onLogRevisit={() => {}}
    />
  );
  const first = setup(content([coffee]));
  fireEvent.change(screen.getByRole('textbox', { name: 'Add a name' }), { target: { value: 'New tea' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Quick save' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Quick save' }));
  await screen.findByRole('alert');
  first.unmount();
  setup(content([coffee, { ...coffee, title: 'New tea' }]));
  expect(screen.getByRole('textbox', { name: 'Add a name' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Add a name' })).toHaveValue(''));
});

test('Unfiled files directly from its row without editing the entry first', async () => {
  const file = vi
    .spyOn(api, 'fileInbox')
    .mockResolvedValue({ item: { ...coffee, title: find.title }, logId: null });
  const update = vi.spyOn(api, 'updateInbox');
  setup(<InboxPage />);
  const actions = await screen.findByRole('group', { name: `File ${find.title}` });
  fireEvent.click(within(actions).getByRole('button', { name: 'Drinks' }));
  await waitFor(() => expect(file).toHaveBeenCalledWith(find.id, list.id, 7, expect.any(String)));
  expect(update).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('direct filing warns about a duplicate before allowing an explicit separate copy', async () => {
  vi.mocked(api.items).mockResolvedValue({ items: [{ ...coffee, title: find.title, type: 'Book' }] });
  const file = vi.spyOn(api, 'fileInbox').mockResolvedValue({ item: coffee, logId: null });
  setup(<InboxPage />);
  const actions = await screen.findByRole('group', { name: `File ${find.title}` });
  fireEvent.click(within(actions).getByRole('button', { name: 'Drinks' }));
  await within(actions).findByRole('link', { name: 'Open existing item' });
  expect(file).not.toHaveBeenCalled();
  fireEvent.click(within(actions).getByRole('button', { name: 'File as a separate item' }));
  await waitFor(() => expect(file).toHaveBeenCalledTimes(1));
});

test('creating a collection from an Unfiled row continues straight into filing', async () => {
  const created = { ...list, id: '55555555-5555-4555-8555-555555555555', name: 'Books' };
  vi.spyOn(api, 'createList').mockResolvedValue({ list: created });
  const file = vi
    .spyOn(api, 'fileInbox')
    .mockResolvedValue({ item: { ...coffee, listId: created.id }, logId: null });
  setup(<InboxPage />);
  const actions = await screen.findByRole('group', { name: `File ${find.title}` });
  fireEvent.click(within(actions).getByRole('button', { name: 'New collection' }));
  fireEvent.change(within(actions).getByLabelText('Collection name'), { target: { value: 'Books' } });
  fireEvent.click(within(actions).getByRole('button', { name: 'Create & file' }));
  await waitFor(() => expect(file).toHaveBeenCalledWith(find.id, created.id, 7, expect.any(String)));
});

test('a lost collection-creation reply reuses the saved collection on retry', async () => {
  const created = { ...list, id: '55555555-5555-4555-8555-555555555555', name: 'Books' };
  const create = vi.spyOn(api, 'createList').mockImplementation(async () => {
    vi.mocked(api.lists).mockResolvedValue({ lists: [list, created] });
    throw new Error('Reply lost');
  });
  const file = vi
    .spyOn(api, 'fileInbox')
    .mockResolvedValue({ item: { ...coffee, listId: created.id }, logId: null });
  setup(<InboxPage />);
  const actions = await screen.findByRole('group', { name: `File ${find.title}` });
  fireEvent.click(within(actions).getByRole('button', { name: 'New collection' }));
  fireEvent.change(within(actions).getByLabelText('Collection name'), { target: { value: 'Books' } });
  fireEvent.click(within(actions).getByRole('button', { name: 'Create & file' }));
  await within(actions).findByRole('alert');
  await waitFor(() => expect(within(actions).getByRole('button', { name: 'File here' })).toBeEnabled());
  fireEvent.click(within(actions).getByRole('button', { name: 'File here' }));
  await waitFor(() => expect(file).toHaveBeenCalledWith(find.id, created.id, 7, expect.any(String)));
  expect(create).toHaveBeenCalledTimes(1);
});

test('a lost direct filing reply keeps its identity even after the source disappears', async () => {
  const file = vi
    .spyOn(api, 'fileInbox')
    .mockImplementationOnce(async () => {
      vi.mocked(api.inbox).mockResolvedValue({ entries: [] });
      throw new Error('Reply lost');
    })
    .mockResolvedValue({ item: coffee, logId: null });
  const first = setup(<InboxPage />);
  const actions = await screen.findByRole('group', { name: `File ${find.title}` });
  fireEvent.click(within(actions).getByRole('button', { name: 'Drinks' }));
  await screen.findByRole('button', { name: 'Retry same filing' });
  first.unmount();
  setup(<InboxPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry same filing' }));
  await waitFor(() => expect(file).toHaveBeenCalledTimes(2));
  expect(file.mock.calls[1]).toEqual(file.mock.calls[0]);
});
