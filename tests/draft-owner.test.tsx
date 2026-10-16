import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { useDraft } from '../src/hooks/useDraft';

test('metadata changes cannot retarget an already open draft to another account', async () => {
  const client = new QueryClient();
  client.setQueryData(['me'], { user: { id: 'draft-owner-a' } });
  const validate = (value: unknown): value is { text: string } =>
    !!value && typeof (value as { text: string }).text === 'string';
  const { result, rerender, unmount } = renderHook(() => useDraft('boundary', { text: '' }, validate), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => result.current.setForm({ text: 'Original account draft' }));
  await waitFor(() =>
    expect(localStorage.getItem('worth:draft:v1:draft-owner-a:boundary')).toContain('Original account draft'),
  );
  act(() => client.setQueryData(['me'], { user: { id: 'draft-owner-b' } }));
  rerender();
  act(() => result.current.setForm({ text: 'Still the original account’s draft' }));
  await waitFor(() =>
    expect(localStorage.getItem('worth:draft:v1:draft-owner-a:boundary')).toContain('Still the original'),
  );
  expect(localStorage.getItem('worth:draft:v1:draft-owner-b:boundary')).toBeNull();
  unmount();
  client.clear();
});
