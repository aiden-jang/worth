import type { SnapshotData } from '../shared/record-snapshots';
import { formatDate } from '../format';
import { formatActivityMetric } from '../shared/workouts';
const calls = { favorite: 'Favorite', meh: 'Meh', would_not_again: 'Not again' };
export function SnapshotProjection({
  data,
  listName,
  label,
}: {
  data: SnapshotData;
  listName: string;
  label: string;
}) {
  return (
    <section className="capsule-projection" aria-label={label}>
      <p className="overline">{label}</p>
      <h3>{data.title}</h3>
      <p className="capsule-source-list">{listName}</p>
      <dl>
        {data.type !== undefined && (
          <>
            <dt>Type</dt>
            <dd>{data.type || 'Not entered'}</dd>
          </>
        )}
        {data.decision !== undefined && (
          <>
            <dt>Personal call</dt>
            <dd>{data.decision === null ? 'No call' : calls[data.decision]}</dd>
          </>
        )}
        {data.rank !== undefined && (
          <>
            <dt>Collection rank</dt>
            <dd>{data.rank === null ? 'Unranked' : `#${data.rank}`}</dd>
          </>
        )}
        {data.dates &&
          ('happenedOn' in data.dates ? (
            <>
              <dt>Recorded date</dt>
              <dd>{formatDate(data.dates.happenedOn)}</dd>
            </>
          ) : (
            <>
              <dt>Start date</dt>
              <dd>{data.dates.startedOn ? formatDate(data.dates.startedOn) : 'Not entered'}</dd>
              <dt>End date</dt>
              <dd>{data.dates.endedOn ? formatDate(data.dates.endedOn) : 'Not entered'}</dd>
            </>
          ))}
        {data.results && (
          <>
            <dt>Recorded measurements</dt>
            <dd>
              {formatActivityMetric(data.results) || 'No measurements recorded'}
              {data.results.exerciseSets.length > 0 && (
                <ol>
                  {data.results.exerciseSets.map((set, index) => (
                    <li key={index}>
                      Set {index + 1}: {set.reps} reps ·{' '}
                      {set.weight === null ? 'bodyweight' : `${set.weight} ${data.results!.weightUnit}`}
                    </li>
                  ))}
                </ol>
              )}
            </dd>
          </>
        )}
        {data.note !== undefined && (
          <>
            <dt>Private note</dt>
            <dd className="capsule-written-text">{data.note || 'No note entered'}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
