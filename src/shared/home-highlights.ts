import type { MemoryRecord, PreferenceGroup } from './memories';
import type { HomeProgress } from './workout-summary';
import { summarizePreference } from './preference-summary';

export type HomeHighlight =
  | { kind: 'memory'; record: MemoryRecord | null }
  | { kind: 'preference'; group: PreferenceGroup }
  | { kind: 'progress'; progress: HomeProgress };

export function initialHomeHighlight(
  date: string,
  memory: MemoryRecord | null,
  groups: PreferenceGroup[],
  progress: HomeProgress | null,
): HomeHighlight {
  const eligible = groups.filter((group) => {
    const { rated, leading } = summarizePreference(group);
    return rated >= 3 && leading.length === 1;
  });
  const preference = eligible.find((group) => group.kind !== 'collection') ?? eligible[0];
  const options: HomeHighlight[] = [];
  if (memory) options.push({ kind: 'memory', record: memory });
  if (preference) options.push({ kind: 'preference', group: preference });
  if (progress && progress.happenedOn <= date) options.push({ kind: 'progress', progress });
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
  const index = Number.isFinite(day) ? ((day % options.length) + options.length) % options.length : 0;
  return options[index] ?? { kind: 'memory', record: null };
}
