import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useViewPreference } from '../src/hooks/useViewPreference';
afterEach(cleanup);
test('returning to a view restores its filters without leaking them to another collection', () => {
  const first = renderHook(({ key }) => useViewPreference(key, 'all'), { initialProps: { key: 'test:one' } });
  act(() => first.result.current[1]('favorites'));
  first.rerender({ key: 'test:two' });
  expect(first.result.current[0]).toBe('all');
  act(() => first.result.current[1]('queue'));
  first.rerender({ key: 'test:one' });
  expect(first.result.current[0]).toBe('favorites');
  first.unmount();
  const back = renderHook(() => useViewPreference('test:two', 'all'));
  expect(back.result.current[0]).toBe('queue');
});
