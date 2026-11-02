import type { PreferenceGroup } from './memories';

export function summarizePreference(group: PreferenceGroup) {
  const calls = [
    { label: 'Favorite', count: group.favorite },
    { label: 'Meh', count: group.meh },
    { label: 'Not again', count: group.notAgain },
  ];
  const rated = group.favorite + group.meh + group.notAgain;
  const highest = Math.max(...calls.map((call) => call.count));
  return { calls, rated, leading: calls.filter((call) => call.count === highest) };
}

export function preferenceKey(group: PreferenceGroup) {
  return JSON.stringify([group.listId, group.kind, group.basis, group.name]);
}

export function preferenceRecordsHref(group: PreferenceGroup) {
  return `/patterns/remember?${new URLSearchParams({
    mode: group.basis === 'visits' ? 'visits' : 'saved',
    list: group.listId,
    ...(group.kind === 'collection' ? {} : { [group.kind]: group.name }),
  })}`;
}
