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
