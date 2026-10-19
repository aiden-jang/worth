import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, test } from 'vitest';
import type { ReactNode } from 'react';
import { useDraft } from '../src/hooks/useDraft';
import { isLogDraft } from '../src/shared/drafts';

beforeEach(() => localStorage.clear());
const initial = { title: '' };
const valid = (value: unknown): value is typeof initial =>
  Boolean(value && typeof value === 'object' && 'title' in value && typeof value.title === 'string');
function setup(owner: string) {
  const client = new QueryClient();
  client.setQueryData(['me'], { user: { id: owner } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
test('interrupted drafts restore per account with the same retry identity and clear after save', () => {
  const wrapper = setup('alice');
  const first = renderHook(() => useDraft('test', initial, valid), { wrapper });
  act(() => first.result.current.setForm({ title: 'Bench press' }));
  const operation = first.result.current.operationId.current;
  act(() => first.result.current.rememberSaved('saved-record'));
  first.unmount();
  const other = renderHook(() => useDraft('test', initial, valid), { wrapper: setup('bob') });
  expect(other.result.current.form.title).toBe('');
  other.unmount();
  const recovered = renderHook(() => useDraft('test', initial, valid), { wrapper });
  expect(recovered.result.current.form.title).toBe('Bench press');
  expect(recovered.result.current.operationId.current).toBe(operation);
  expect(recovered.result.current.savedId.current).toBe('saved-record');
  act(() => recovered.result.current.clear());
  recovered.unmount();
  const clean = renderHook(() => useDraft('test', initial, valid), { wrapper });
  expect(clean.result.current.form.title).toBe('');
  clean.unmount();
});
test('expired or malformed local drafts do not enter the editor', () => {
  const key = 'worth:draft:v1:alice:test';
  localStorage.setItem(key, JSON.stringify({ form: { title: 'Old' }, updatedAt: Date.now() - 8 * 86400000 }));
  const old = renderHook(() => useDraft('test', initial, valid), { wrapper: setup('alice') });
  expect(old.result.current.form.title).toBe('');
  expect(localStorage.getItem(key)).toBeNull();
  old.unmount();
  localStorage.setItem(key, JSON.stringify({ form: { title: 42 }, updatedAt: Date.now() }));
  const bad = renderHook(() => useDraft('test', initial, valid), { wrapper: setup('alice') });
  expect(bad.result.current.form.title).toBe('');
  expect(localStorage.getItem(key)).toBeNull();
  bad.unmount();
});
test('unfinished sets survive validation while invalid workout references are rejected', () => {
  const draft = {
    title: 'Row',
    happenedOn: '2026-10-10',
    note: '',
    unit: '',
    itemId: null,
    amount: null,
    sets: null,
    reps: null,
    workoutId: '11111111-1111-4111-8111-111111111111',
    exerciseSets: [{ reps: null, weight: 0 }],
    weightUnit: 'kg',
  };
  expect(isLogDraft(draft)).toBe(true);
  expect(isLogDraft({ ...draft, workoutId: 'invalid' })).toBe(false);
});

test('checkpoint persists the exact retry payload before a request can start', () => {
  const capture = renderHook(() => useDraft('checkpoint', initial, valid), { wrapper: setup('alice') });
  act(() => {
    capture.result.current.checkpoint({ title: 'Frozen payload' });
    const stored = JSON.parse(localStorage.getItem('worth:draft:v1:alice:checkpoint')!);
    expect(stored.form).toEqual({ title: 'Frozen payload' });
    expect(stored.operationId).toBe(capture.result.current.operationId.current);
  });
  capture.unmount();
});
