import type { SavedEntry } from './quick-entry';

export function showMessage(message: string) {
  if (message) window.dispatchEvent(new CustomEvent('worth:message', { detail: message }));
}

export function announceSavedEntry(entry: SavedEntry, message?: string) {
  window.dispatchEvent(new CustomEvent('worth:entry-saved', { detail: { entry, message } }));
}
