import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { App } from '../src/App';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
test('the app keeps query changes in place and restores Back before the old page can shrink', async () => {
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
  vi.spyOn(window, 'scrollTo').mockImplementation((x: number | ScrollToOptions | undefined, y?: number) => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: typeof x === 'number' ? (y ?? 0) : (x?.top ?? 0),
    });
  });
  const router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: ['/privacy'] });
  render(<RouterProvider router={router} />);
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 650 });
  await act(() => router.navigate('/privacy?view=details'));
  expect(window.scrollY).toBe(650);
  await act(() => router.navigate('/terms'));
  expect(window.scrollY).toBe(0);
  await act(() => router.navigate(-1));
  await waitFor(() => expect(window.scrollY).toBe(650));
});
