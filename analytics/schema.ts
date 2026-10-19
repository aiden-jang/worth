// Shared browser/Worker contract. Dynamic path segments never enter an event.
export const APP = 'worth';
export const HOST = 'worth.aidenjang.com';
export const PAGES = [
  'archive',
  'board',
  'boards',
  'calendar',
  'capsule',
  'capsules',
  'capture',
  'code_capture',
  'collection',
  'collections',
  'connections',
  'field_guide',
  'help',
  'inbox',
  'home',
  'look_back',
  'new_capsule',
  'offline',
  'other',
  'patterns',
  'photo_text',
  'privacy',
  'receipt',
  'receipts',
  'search',
  'settings',
  'shared',
  'space',
  'space_invite',
  'spaces',
  'terms',
  'web_capture',
] as const;
export const ACTIONS = ['list_created', 'item_created', 'inbox_saved', 'backup_downloaded'] as const;
export type Page = (typeof PAGES)[number];
export type AnalyticsEvent = { name: 'page_view'; page: Page } | { name: (typeof ACTIONS)[number] };
const exact: Record<string, Page> = {
  '/': 'home',
  '/archive': 'archive',
  '/lists': 'collections',
  '/search': 'search',
  '/patterns': 'patterns',
  '/inbox': 'inbox',
  '/capture': 'web_capture',
  '/quick': 'capture',
  '/read': 'photo_text',
  '/code': 'code_capture',
  '/receipts': 'receipts',
  '/patterns/boards': 'boards',
  '/capsules': 'capsules',
  '/capsules/new': 'new_capsule',
  '/spaces': 'spaces',
  '/patterns/calendar': 'calendar',
  '/patterns/connections': 'connections',
  '/patterns/field-guide': 'field_guide',
  '/patterns/look-back': 'look_back',
  '/settings': 'settings',
  '/offline': 'offline',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/help': 'help',
};
const prefixes: readonly (readonly [string, Page])[] = [
  ['/lists/', 'collection'],
  ['/receipts/', 'receipt'],
  ['/patterns/boards/', 'board'],
  ['/capsules/', 'capsule'],
  ['/spaces/invite/', 'space_invite'],
  ['/spaces/', 'space'],
  ['/s/', 'shared'],
];
export function pageForPath(pathname: string): Page {
  const rawPath = pathname.split(/[?#]/)[0] ?? '';
  const path = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '');
  if (Object.prototype.hasOwnProperty.call(exact, path)) return exact[path]!;
  return prefixes.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'other';
}
export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const keys = Object.keys(event);
  if (event.name === 'page_view')
    return (
      keys.length === 2 &&
      keys.includes('page') &&
      typeof event.page === 'string' &&
      (PAGES as readonly string[]).includes(event.page)
    );
  return (
    keys.length === 1 && typeof event.name === 'string' && (ACTIONS as readonly string[]).includes(event.name)
  );
}

// Confirmed server operations cannot be fabricated through the anonymous browser endpoint.
export const BROWSER_ACTIONS: readonly string[] = [];
export function isBrowserAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!isAnalyticsEvent(value)) return false;
  const name = value.name;
  return name === 'page_view' || BROWSER_ACTIONS.includes(name);
}
