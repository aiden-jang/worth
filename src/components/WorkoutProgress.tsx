import { useState } from 'react';
import { today } from '../format';
import type { WorkoutSession } from '../shared/models';

export function WorkoutProgress({ workouts }: { workouts: WorkoutSession[] }) {
  const [weeks, setWeeks] = useState(4);
  const end = today(),
    endTime = Date.parse(`${end}T00:00:00Z`),
    day = 86400000;
  const start = new Date(endTime - (weeks * 7 - 1) * day).toISOString().slice(0, 10);
  const previousStart = new Date(endTime - (weeks * 14 - 1) * day).toISOString().slice(0, 10);
  const finished = workouts.filter((w) => w.status === 'finished' && w.happenedOn <= end);
  const current = finished.filter((w) => w.happenedOn >= start).length;
  const prior = finished.filter((w) => w.happenedOn >= previousStart && w.happenedOn < start).length;
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const from = new Date(endTime - (weeks * 7 - 1 - index * 7) * day).toISOString().slice(0, 10);
    const to = new Date(Date.parse(`${from}T00:00:00Z`) + 6 * day).toISOString().slice(0, 10);
    return { from, to, count: finished.filter((w) => w.happenedOn >= from && w.happenedOn <= to).length };
  });
  if (!workouts.length) return null;
  return (
    <details className="exercise-directory workout-progress">
      <summary>
        Workout progress{' '}
        <span>
          {current} finished in {weeks} weeks
        </span>
      </summary>
      <label>
        Period
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
          <option value={4}>Last 4 weeks</option>
          <option value={12}>Last 12 weeks</option>
        </select>
      </label>
      <p>
        {current} finished {current === 1 ? 'workout' : 'workouts'} · {prior} in the preceding {weeks} weeks.
        Active workouts are excluded.
      </p>
      <ol className="workout-week-list">
        {buckets.map((week) => (
          <li key={week.from}>
            <span>
              {week.from} – {week.to}
            </span>
            <strong>{week.count} finished</strong>
          </li>
        ))}
      </ol>
      <p className="exercise-helper">
        Seven-day periods ending today. These are your recorded sessions, not a measure of fitness.
      </p>
    </details>
  );
}
