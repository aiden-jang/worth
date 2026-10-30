import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from '../src/api';
import { InboxPanel } from '../src/pages/InboxPage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('Unfiled waits for its response before reporting an empty archive', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof api.inbox>>) => void;
  vi.spyOn(api, 'inbox').mockReturnValue(new Promise((done) => (resolve = done)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InboxPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByRole('status')).toHaveTextContent('Opening the Unfiled…');
  expect(screen.queryByText('0 saved finds · Private')).not.toBeInTheDocument();
  expect(screen.queryByText('A place for the maybes.')).not.toBeInTheDocument();

  resolve({ entries: [] });
  expect(await screen.findByText('0 saved finds · Private')).toBeInTheDocument();
  expect(screen.getByText('A place for the maybes.')).toBeInTheDocument();
});
