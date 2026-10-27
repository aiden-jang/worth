import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { memoryFilter } from '../shared/memories';
import { retrospectivePeriod } from '../shared/retrospective';
import { CallFace } from './PersonalCall';
import '../memories.css';

export function MonthMemory() {
  const filter = memoryFilter.parse(retrospectivePeriod('month'));
  const query = useQuery({
    queryKey: ['patterns', 'memories', 'month', filter.from, filter.to],
    queryFn: () => api.memories(filter),
  });
  if (!query.data?.total) return null;
  const first = query.data.records[0];
  return (
    <section className="month-memory" aria-label="This month’s memories">
      <div>
        <p className="overline">
          A LITTLE OF {new Date().toLocaleDateString(undefined, { month: 'long' }).toUpperCase()}
        </p>
        <h2>
          {query.data.total} dated {query.data.total === 1 ? 'entry' : 'entries'} to look back on.
        </h2>
        <p>Most recent: {first.title}</p>
        <Link to={`/patterns/remember?from=${filter.from}&to=${filter.to}`}>Open this month →</Link>
      </div>
      {first.hasPhoto ? (
        <img src={`/api/logs/${first.id}/photo`} alt={`Saved photo for ${first.title}`} loading="lazy" />
      ) : first.kind === 'visit' && first.reaction ? (
        <CallFace value={first.reaction} />
      ) : (
        <span className="memory-month-mark" aria-hidden="true">
          {new Date().getDate().toString().padStart(2, '0')}
        </span>
      )}
    </section>
  );
}
