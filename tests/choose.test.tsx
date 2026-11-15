import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ChoosePage } from '../src/pages/ChoosePage';
import { api } from '../src/api';
import type { MemoryRecord } from '../src/shared/memories';

const book: MemoryRecord = {
  id: 'book',
  itemId: 'book',
  listId: '11111111-1111-4111-8111-111111111111',
  listName: 'Books',
  title: 'The illustrated atlas',
  note: 'Light reading for a quiet afternoon.',
  date: '2026-11-01',
  kind: 'saved',
  location: '',
  order: '',
  reaction: 'favorite',
  hasPhoto: false,
};
const place: MemoryRecord = {
  ...book,
  id: 'place',
  itemId: null,
  listId: null,
  listName: 'Unfiled',
  title: 'The corner bookshop',
  note: 'For a rainy day.',
  kind: 'unfiled',
  reaction: null,
  wantToTry: true,
};
const moisturizer: MemoryRecord = {
  ...book,
  id: 'moisturizer',
  itemId: 'moisturizer',
  listName: 'Skincare',
  title: 'Daily moisturizer',
  note: 'Too heavy for me.',
  reaction: 'would_not_again',
};
beforeEach(() => {
  vi.spyOn(api, 'lists').mockResolvedValue({ lists: [] });
  vi.spyOn(api, 'memories').mockResolvedValue({
    records: [book, place, moisturizer],
    total: 3,
    nextOffset: null,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function setup(path = '/choose') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ChoosePage />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

test('choices show actual opinions, plans and notes across categories and link to the original readers', async () => {
  setup();
  expect(await screen.findByRole('link', { name: 'The illustrated atlas' })).toHaveAttribute(
    'href',
    `/lists/${book.listId}?focus=item:book&view=1`,
  );
  expect(screen.getByText(book.note)).toBeVisible();
  expect(screen.getByRole('img', { name: 'Not again' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'The corner bookshop' })).toHaveAttribute(
    'href',
    '/inbox?focus=place&view=1',
  );
  expect(screen.getByText('3 saved choices')).toBeVisible();
  expect(api.memories).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'saved', call: '', want: '', list: '' }),
    expect.any(AbortSignal),
  );
});

test('Favorites and Want to try ask for separate saved-record filters without inventing a call', async () => {
  setup();
  await screen.findByRole('link', { name: book.title });
  fireEvent.click(screen.getByRole('button', { name: 'Favorites' }));
  await waitFor(() =>
    expect(api.memories).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'saved', call: 'favorite', want: '' }),
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Want to try' }));
  await waitFor(() =>
    expect(api.memories).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'saved', call: '', want: '1' }),
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getByTestId('location')).toHaveTextContent('/choose?view=want');
});

test('search keeps literal words including all, and clearing restores focus', async () => {
  setup('/choose?view=want&list=inbox');
  await screen.findByRole('link', { name: book.title });
  const input = screen.getByRole('searchbox', { name: 'Search your saved choices' });
  fireEvent.change(input, { target: { value: 'all' } });
  await waitFor(() =>
    expect(api.memories).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'all', list: 'inbox', want: '1' }),
      expect.any(AbortSignal),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear choice search' }));
  expect(input).toHaveFocus();
  expect(input).toHaveValue('');
  expect(screen.getByTestId('location')).toHaveTextContent('/choose?view=want&list=inbox');
});

test('empty accounts get a capture action and no fabricated suggestions', async () => {
  vi.mocked(api.memories).mockResolvedValue({ records: [], total: 0, nextOffset: null });
  setup();
  expect(await screen.findByText('Your next pick starts here.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add your first item' })).toBeVisible();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

test('a failed next page preserves choices and retries that same page', async () => {
  vi.mocked(api.memories)
    .mockResolvedValueOnce({ records: [book], total: 2, nextOffset: 50 })
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({ records: [place], total: 2, nextOffset: null });
  setup();
  await screen.findByRole('link', { name: book.title });
  fireEvent.click(screen.getByRole('button', { name: 'Show more choices' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('link', { name: book.title })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry more choices' }));
  expect(await screen.findByRole('link', { name: place.title })).toBeVisible();
  expect(vi.mocked(api.memories).mock.calls[1][0].offset).toBe(50);
  expect(vi.mocked(api.memories).mock.calls[2][0].offset).toBe(50);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('invalid collection filters never request a broader archive silently', async () => {
  setup('/choose?list=not-a-collection');
  expect(screen.getByRole('alert')).toHaveTextContent('This filter isn’t available.');
  expect(api.memories).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await screen.findByRole('link', { name: book.title });
});

test('picks run only on request and explain actual calls, plans and literal search matches', async () => {
  vi.mocked(api.memories).mockImplementation(async (filter) =>
    filter.pick
      ? { records: [book, place], total: 2, nextOffset: null }
      : { records: [book, place, moisturizer], total: 3, nextOffset: null },
  );
  const client = setup('/choose?q=quiet');
  await screen.findByRole('link', { name: book.title });
  expect(vi.mocked(api.memories).mock.calls.some(([filter]) => !!filter.pick)).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  expect(await screen.findByRole('region', { name: 'Your picks' })).toBeVisible();
  await screen.findByText('2 picks from 2 matching choices');
  expect(screen.getByRole('region', { name: 'Your picks' })).toHaveFocus();
  expect(screen.getByText('You marked this Favorite.')).toBeVisible();
  expect(screen.getByText('On your Want to try list.')).toBeVisible();
  expect(screen.getAllByText('Matches “quiet” in your saved details.')).toHaveLength(2);
  expect(screen.queryByRole('img', { name: 'Not again' })).not.toBeInTheDocument();
  expect(api.memories).toHaveBeenLastCalledWith(
    expect.objectContaining({ pick: 'all', q: 'quiet', exclude: '', offset: 0 }),
    expect.any(AbortSignal),
  );
  expect(screen.getByRole('button', { name: 'Show other picks' })).toBeDisabled();
  await client.invalidateQueries({ queryKey: ['patterns'] });
  expect(vi.mocked(api.memories).mock.calls.filter(([filter]) => !!filter.pick)).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'See all matches' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pick for me' })).toHaveFocus());
  expect(screen.getByRole('img', { name: 'Not again' })).toBeVisible();
  expect(screen.getByRole('searchbox')).toHaveValue('quiet');
});

test('another draw sets aside the previous three picks and keeps the same filters', async () => {
  const third = { ...book, id: 'third', title: 'A saved film' };
  vi.mocked(api.memories).mockResolvedValue({ records: [book, place, third], total: 6, nextOffset: null });
  setup('/choose?view=want&list=inbox');
  await screen.findByRole('link', { name: book.title });
  fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  await screen.findByText('3 picks from 6 matching choices');
  fireEvent.click(screen.getByRole('button', { name: 'Show other picks' }));
  await waitFor(() =>
    expect(api.memories).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pick: 'try',
        list: 'inbox',
        want: '1',
        exclude: 'book,place,third',
      }),
      expect.any(AbortSignal),
    ),
  );
});

test('filter changes discard an in-flight draw and cannot reveal its late results', async () => {
  let resolve!: (page: { records: MemoryRecord[]; total: number; nextOffset: null }) => void;
  const delayed = new Promise<{ records: MemoryRecord[]; total: number; nextOffset: null }>((done) => {
    resolve = done;
  });
  let signal: AbortSignal | undefined;
  vi.mocked(api.memories).mockImplementation((filter, requestSignal) => {
    if (filter.pick) {
      signal = requestSignal;
      return delayed;
    }
    return Promise.resolve({ records: [book], total: 1, nextOffset: null });
  });
  setup();
  await screen.findByRole('link', { name: book.title });
  fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  await screen.findByText('Finding a few choices…');
  fireEvent.click(screen.getByRole('button', { name: 'Favorites' }));
  await screen.findByRole('button', { name: 'Pick for me' });
  expect(signal?.aborted).toBe(true);
  resolve({ records: [place], total: 1, nextOffset: null });
  await waitFor(() => expect(screen.getByRole('link', { name: book.title })).toBeVisible());
  expect(screen.queryByRole('link', { name: place.title })).not.toBeInTheDocument();
  expect(screen.queryByText('Why this pick')).not.toBeInTheDocument();
});

test('failed picks retry the scoped draw and empty results never fabricate a suggestion', async () => {
  let attempts = 0;
  vi.mocked(api.memories).mockImplementation(async (filter) => {
    if (!filter.pick) return { records: [book], total: 1, nextOffset: null };
    if (++attempts === 1) throw new Error('Offline');
    return { records: [], total: 0, nextOffset: null };
  });
  setup('/choose?view=favorite');
  await screen.findByRole('link', { name: book.title });
  fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your picks couldn’t load.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry picks' }));
  await screen.findByText('No picks here yet.');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByText('Mark something Favorite to pick it again.')).toBeVisible();
  const draws = vi.mocked(api.memories).mock.calls.filter(([filter]) => !!filter.pick);
  expect(draws).toHaveLength(2);
  expect(draws[0][0]).toEqual(draws[1][0]);
  expect(draws[1][0].pick).toBe('again');
  expect(screen.getByRole('button', { name: 'Show other picks' })).toBeDisabled();
});
