import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import {
  captureBookmarklet,
  captureItem,
  emptyWebCapture,
  sharedCapture,
  webCaptureDraft,
} from '../src/shared/web-capture';

test('incoming shares remain plain reviewed text and standalone links retain their source', () => {
  expect(sharedCapture(new URLSearchParams())).toBeNull();
  expect(sharedCapture(new URLSearchParams({ text: 'https://example.test/find' }))).toEqual({
    title: '',
    url: 'https://example.test/find',
    text: '',
  });
  const data = { title: '<script>not code</script>', text: 'My selection', url: 'https://example.test/find' };
  expect(sharedCapture(new URLSearchParams(data))).toEqual(data);
  expect(() => sharedCapture(new URLSearchParams({ title: 'x'.repeat(1001) }))).toThrow();
});

test('web capture preserves independent rank and call defaults and rejects unsafe sources', () => {
  const item = captureItem({ ...emptyWebCapture, title: 'A name', wantToTry: true });
  expect(item.decision).toBeNull();
  expect(item.wantToTry).toBe(true);
  expect(item.context.sourceUrl).toBe('');
  for (const sourceUrl of [
    'javascript:alert(1)',
    'https://person:secret@example.test',
    'https://example.test/' + 'x'.repeat(1001),
  ])
    expect(() => captureItem({ ...emptyWebCapture, title: 'A name', sourceUrl })).toThrow();
  expect(
    webCaptureDraft.safeParse({ ...emptyWebCapture, frozen: { listId: 'foreign path', item } }).success,
  ).toBe(false);
});

test('browser bookmark code sends page data in the fragment and cannot choose the API host', () => {
  const code = captureBookmarklet('https://worth.aidenjang.com');
  expect(code).toContain('new URL("https://worth.aidenjang.com/capture")');
  expect(code).toContain('u.hash=new URLSearchParams');
  expect(code).toContain('noopener,noreferrer');
  expect(code).not.toContain('fetch(');
  expect(code).not.toContain('u.search');
  expect(() => captureBookmarklet('javascript:alert(1)')).toThrow();
});

test('the bookmark code transfers only reviewed fields to a fragment in a separate tab', () => {
  const opened: unknown[][] = [];
  runInNewContext(captureBookmarklet('https://worth.aidenjang.com').slice('javascript:'.length), {
    URL,
    URLSearchParams,
    document: { title: 'A title & an edition' },
    location: { href: 'https://example.test/a?private=1' },
    window: {
      getSelection: () => 'Selected text <b>plain</b>',
      open: (...args: unknown[]) => opened.push(args),
    },
  });
  expect(opened).toHaveLength(1);
  const target = new URL(String(opened[0][0]));
  expect(target.origin).toBe('https://worth.aidenjang.com');
  expect(target.pathname).toBe('/capture');
  expect(target.search).toBe('');
  expect(Object.fromEntries(new URLSearchParams(target.hash.slice(1)))).toEqual({
    title: 'A title & an edition',
    url: 'https://example.test/a?private=1',
    text: 'Selected text <b>plain</b>',
  });
  expect(opened[0].slice(1)).toEqual(['_blank', 'noopener,noreferrer']);
});

test('saved capture retry drafts accept older collection requests and new Inbox requests without hybrid destinations', () => {
  const item = captureItem({ ...emptyWebCapture, title: 'A name' });
  const listId = '11111111-1111-4111-8111-111111111111';
  expect(webCaptureDraft.safeParse({ ...emptyWebCapture, listId, frozen: { listId, item } }).success).toBe(
    true,
  );
  expect(webCaptureDraft.safeParse({ ...emptyWebCapture, frozen: { inbox: true, item } }).success).toBe(true);
  expect(
    webCaptureDraft.safeParse({ ...emptyWebCapture, frozen: { inbox: true, listId, item } }).success,
  ).toBe(false);
});
