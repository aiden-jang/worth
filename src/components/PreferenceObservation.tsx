import type { PreferenceGroup } from '../shared/memories';
import { summarizePreference } from '../shared/preference-summary';

export function PreferenceObservation({ group }: { group: PreferenceGroup }) {
  const { rated, leading } = summarizePreference(group);
  const noun =
    group.basis === 'visits' ? (rated === 1 ? 'visit' : 'visits') : rated === 1 ? 'thing' : 'things';
  if (!rated) return <>No calls recorded yet.</>;
  if (leading.length !== 1)
    return (
      <>
        A mix of calls across <strong>{rated}</strong> rated {noun}.
      </>
    );
  return (
    <>
      You marked{' '}
      <strong>
        {leading[0].count} of {rated}
      </strong>{' '}
      rated {noun} {leading[0].label}.
    </>
  );
}
