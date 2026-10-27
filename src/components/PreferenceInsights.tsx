import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { formatDate } from '../format';
import '../memories.css';

export function PreferenceInsights() {
  const query = useQuery({ queryKey: ['patterns', 'preferences'], queryFn: api.preferences });
  return (
    <section className="preference-insights" aria-labelledby="preference-heading">
      <header>
        <p className="overline">WHAT HELD UP</p>
        <h2 id="preference-heading">A little more your type.</h2>
        <p>
          Overall calls and visit reactions, kept separate. Up to 12 groups with the most recorded calls, by
          collection, type and personal label.
        </p>
      </header>
      {query.isPending && <p role="status">Reading your preferences…</p>}
      {query.isError && (
        <p role="alert">
          Preferences couldn’t load.{' '}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {query.data && (
        <>
          <div className="preference-grid">
            {query.data.groups.map((group) => {
              const rated = group.favorite + group.meh + group.notAgain;
              return (
                <article key={`${group.listId}:${group.kind}:${group.basis}:${group.name}`}>
                  <p className="overline">
                    {group.listName} · {group.kind} ·{' '}
                    {group.basis === 'visits' ? 'visit reactions' : 'overall calls'}
                  </p>
                  <h3>{group.kind === 'collection' ? 'Across this collection' : group.name}</h3>
                  <p>
                    <strong>
                      {group.favorite} of {rated}
                    </strong>{' '}
                    rated{' '}
                    {group.basis === 'visits'
                      ? rated === 1
                        ? 'visit was'
                        : 'visits were'
                      : rated === 1
                        ? 'record is'
                        : 'records are'}{' '}
                    marked Favorite.
                  </p>
                  <p>
                    {group.meh} Meh · {group.notAgain} Not again · {group.unrated}{' '}
                    {group.basis === 'visits' ? 'without a reaction' : 'without a call'}
                  </p>
                  <p className="exercise-helper">
                    {rated < 3
                      ? 'A small sample. Still collecting.'
                      : group.basis === 'visits'
                        ? 'Based on recorded visit reactions and current types/labels.'
                        : 'Based on your current calls, not inferred from rankings.'}
                  </p>
                  <Link
                    to={`/patterns/remember?${new URLSearchParams({ mode: group.basis === 'visits' ? 'visits' : 'saved', list: group.listId, ...(group.kind === 'collection' ? {} : { [group.kind]: group.name }) })}`}
                  >
                    See supporting records →
                  </Link>
                </article>
              );
            })}
          </div>
          {!query.data.groups.length && (
            <p>
              A few overall calls or visit reactions will appear here. Types and labels can add detail later.
              Unrated records stay unrated.
            </p>
          )}
          {!!query.data.returns.length && (
            <section className="preference-returns">
              <h3>Back for another.</h3>
              <p>Returning often and liking something are separate signals.</p>
              {query.data.returns.map((record) => (
                <article key={record.itemId}>
                  <Link to={`/lists/${record.listId}?focus=item:${record.itemId}`}>
                    <strong>{record.title}</strong>
                  </Link>
                  <p>
                    {record.visits} logged visits · {record.favorites} marked Favorite this time · Last{' '}
                    {formatDate(record.lastDate)}
                  </p>
                </article>
              ))}
            </section>
          )}
          {!!query.data.rediscover?.length && (
            <section className="preference-returns">
              <h3>Still a Favorite.</h3>
              <p>No visit logged in the last 90 days. A few names to remember.</p>
              {query.data.rediscover.map((record) => (
                <article key={record.itemId}>
                  <Link to={`/lists/${record.listId}?focus=item:${record.itemId}`}>
                    <strong>{record.title}</strong>
                  </Link>
                  <p>Last logged {formatDate(record.lastDate)}</p>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
