import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { RestTimer } from '../src/components/RestTimer';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});
function openTimer() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(['me'], { user: { id: 'timer-owner' } });
  render(
    <QueryClientProvider client={client}>
      <RestTimer workoutId="visit" />
    </QueryClientProvider>,
  );
}

test.each(['Infinity', '-1', 'NaN', 'not a time'])('ignores an invalid saved deadline: %s', (value) => {
  localStorage.setItem('worth:rest:timer-owner:visit', value);
  openTimer();
  expect(screen.getByRole('button', { name: 'Start rest' })).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByLabelText('0 seconds remaining')).toHaveTextContent('—');
});

test('completed rest keeps its result visible without a background polling timer', () => {
  openTimer();
  fireEvent.click(screen.getByRole('button', { name: 'Start rest' }));
  expect(screen.getByRole('button', { name: 'Cancel timer' })).toBeEnabled();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole('status')).toHaveTextContent('Rest complete.');
  expect(screen.getByRole('button', { name: 'Start rest' })).toBeEnabled();
  expect(vi.getTimerCount()).toBe(0);
});
