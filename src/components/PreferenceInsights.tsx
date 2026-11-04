import { recordHref } from '../shared/record-links';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api';
import { formatDate } from '../format';
import type { PreferenceGroup } from '../shared/memories';
import { summarizePreference, preferenceRecordsHref } from '../shared/preference-summary';
import { PreferenceObservation } from './PreferenceObservation';
import '../memories.css';

export function PreferenceInsights() {
  const [allGroups, setAllGroups] = useState(false);
  const query = useQuery({ queryKey: ['patterns', 'preferences'], queryFn: api.preferences });
  return (
    <section className="preference-insights" aria-labelledby="preference-heading">
      <header>
        <h2 id="preference-heading">What you like.</h2>
        <p>Your recorded calls, with the entries behind them.</p>
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
            {(allGroups ? query.data.groups : query.data.groups.slice(0, 3)).map((group) => (
              <PreferenceCard
                key={`${group.listId}:${group.kind}:${group.basis}:${group.name}`}
                group={group}
              />
            ))}
          </div>
          {query.data.groups.length > 3 && (
            <button
              className="button button-outline"
              type="button"
              aria-expanded={allGroups}
              onClick={() => setAllGroups((value) => !value)}
            >
              {allGroups ? 'Show fewer groups' : `Show all ${query.data.groups.length} groups`}
            </button>
          )}
          {!query.data.groups.length && (
            <div className="preference-empty">
              <p>No calls to summarize yet. Your saved things are still here.</p>
              <Link to="/patterns/remember?mode=saved">Browse saved things →</Link>
            </div>
          )}
          {!!query.data.groups.length && (
            <p className="preference-method">
              Based on current calls and details, independently of rankings. Overall calls describe saved
              things; visit reactions describe individual experiences.
            </p>
          )}
          {!!query.data.returns.length && (
            <section className="preference-returns">
              <h3>Back for another.</h3>
              <p>Returning often and liking something are separate signals.</p>
              {query.data.returns.map((record) => (
                <article key={record.itemId}>
                  <Link to={recordHref(record.listId, 'item', record.itemId)}>
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
                  <Link to={recordHref(record.listId, 'item', record.itemId)}>
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

function PreferenceCard({ group }: { group: PreferenceGroup }) {
  const { calls, rated } = summarizePreference(group);
  const scope =
    group.kind === 'collection'
      ? 'Collection'
      : `${group.listName} · ${{ brand: 'Brand', type: 'Type', label: 'Label' }[group.kind]}`;
  return (
    <article>
      <header>
        <p className="preference-scope">
          {scope} · {group.basis === 'visits' ? 'Visit reactions' : 'Overall calls'}
        </p>
        <h3>{group.kind === 'collection' ? group.listName : group.name}</h3>
      </header>
      <p className="preference-observation">
        <PreferenceObservation group={group} />
      </p>
      <dl className="preference-counts">
        {calls.map((call) => (
          <div key={call.label}>
            <dt>{call.label}</dt>
            <dd>{call.count}</dd>
          </div>
        ))}
      </dl>
      {((rated > 0 && rated < 3) || group.unrated > 0) && (
        <p className="preference-note">
          {rated > 0 && rated < 3 && 'A small sample'}
          {rated > 0 && rated < 3 && group.unrated > 0 && ' · '}
          {group.unrated > 0 &&
            `${group.unrated} ${group.basis === 'visits' ? 'without a reaction' : 'without a call'}`}
        </p>
      )}
      <Link to={preferenceRecordsHref(group)}>See supporting records →</Link>
    </article>
  );
}
