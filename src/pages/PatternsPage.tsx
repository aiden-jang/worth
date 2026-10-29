import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { requestAddEntry } from '../shared/quick-entry';
import { decisionLabel } from '../shared/decisions';
import type { ItemDecision } from '../shared/models';
import { PreferenceInsights } from '../components/PreferenceInsights';
import { CallFace } from '../components/PersonalCall';
import { CabinetEmptyState } from '../components/CabinetEmptyState';
import { MemoryPage } from './MemoryPage';
import '../retrospective.css';

export function PatternsPage() {
  usePageTitle('Look back');
  const [params, setParams] = useSearchParams();
  const insights = params.get('view') === 'insights';
  const patterns = useQuery({ queryKey: ['patterns'], queryFn: api.patterns, enabled: insights });
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const data = patterns.data;
  function changeView(value: 'memories' | 'insights') {
    const next = new URLSearchParams(params);
    if (value === 'memories') next.delete('view');
    else next.set('view', value);
    setParams(next);
  }
  return (
    <main className="page-width everyday-recall">
      <header className="everyday-heading">
        <div>
          <h1>Look back.</h1>
          <p>Find an afternoon. Remember a favorite.</p>
        </div>
      </header>
      <div className="recall-toolbar">
        <div className="recall-tabs" role="group" aria-label="Look back views">
          <button type="button" aria-pressed={!insights} onClick={() => changeView('memories')}>
            Memories
          </button>
          <button type="button" aria-pressed={insights} onClick={() => changeView('insights')}>
            Insights
          </button>
        </div>
        <details data-menu className="recall-more">
          <summary>More tools</summary>
          <div>
            <Link to="/patterns/look-back">Period summary →</Link>
            <Link to="/patterns/calendar">Activity calendar →</Link>
            <Link to="/patterns/boards">Boards & trips →</Link>
            <Link to="/patterns/connections">Connections →</Link>
            <Link to="/spaces">Shared spaces & two-person choices →</Link>
            <Link to="/capsules">Time capsules →</Link>
            <Link to="/patterns/field-guide">Make a field guide →</Link>
          </div>
        </details>
      </div>
      {!insights ? (
        <MemoryPage embedded />
      ) : (
        <section aria-label="Insights" className="recall-insights">
          {patterns.isPending && <p role="status">Reading your saved entries…</p>}
          {patterns.isError && (
            <p className="form-error" role="alert">
              Insights couldn’t load. <button onClick={() => void patterns.refetch()}>Try again</button>
            </p>
          )}
          {data && (
            <>
              {data.totalRecords === 0 ? (
                <CabinetEmptyState
                  title="Too soon to tell."
                  description="Your saved opinions and activity will appear here."
                >
                  <button className="button button-accent" onClick={() => requestAddEntry()}>
                    Add a name
                  </button>
                </CabinetEmptyState>
              ) : (
                <>
                  <PreferenceInsights />
                  <CallDistribution
                    counts={{
                      favorite: data.favoriteCount,
                      meh: data.mehCount,
                      would_not_again: data.notAgainCount,
                    }}
                  />
                  <details className="recall-totals">
                    <summary>Archive totals</summary>
                    <dl>
                      <div>
                        <dt>Saved records and activity entries</dt>
                        <dd>{data.totalRecords}</dd>
                      </div>
                      <div>
                        <dt>Ranked items</dt>
                        <dd>{data.rankedItemCount}</dd>
                      </div>
                      <div>
                        <dt>Dated collection experiences</dt>
                        <dd>{data.revisitCount}</dd>
                      </div>
                    </dl>
                  </details>
                </>
              )}
              {!!lists.data?.lists.some((list) => list.kind === 'activity') && (
                <section className="recall-workouts" aria-label="Activity progress">
                  <h2>Activity progress</h2>
                  <p>Open an activity to see its saved history and exercise progress.</p>
                  {lists.data.lists
                    .filter((list) => list.kind === 'activity')
                    .map((list) => (
                      <Link key={list.id} to={`/lists/${list.id}`}>
                        {list.name} →
                      </Link>
                    ))}
                </section>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function CallDistribution({ counts }: { counts: Record<ItemDecision, number> }) {
  const total = counts.favorite + counts.meh + counts.would_not_again;
  return (
    <section className="call-distribution" aria-labelledby="call-distribution-heading">
      <header>
        <p className="overline">YOUR OVERALL CALLS</p>
        <h2 id="call-distribution-heading">Mixed feelings, on record.</h2>
        <p>Visit reactions stay separate. Unrated records stay unrated.</p>
      </header>
      <dl className="call-summary">
        {(['favorite', 'meh', 'would_not_again'] as const).map((call) => (
          <div key={call}>
            <dt>
              <CallFace value={call} />
              <span>{decisionLabel(call)}</span>
            </dt>
            <dd>{counts[call]}</dd>
            <div className="call-summary-track" aria-hidden="true">
              <span style={{ width: `${total ? (counts[call] / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
