import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { api } from '../api';

export function PatternsPage() {
  const patterns = useQuery({ queryKey: ['patterns'], queryFn: api.patterns });

  if (patterns.isPending)
    return <main className="light-page page-width loading-line">Reading your archive…</main>;
  if (patterns.isError) {
    return (
      <main className="light-page page-width error-page">
        <h1>Patterns are unavailable.</h1>
        <button className="button button-outline" onClick={() => void patterns.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  const data = patterns.data;
  if (!data) return null;

  return (
    <main className="light-page patterns-page page-width">
      <header className="patterns-head">
        <p className="overline">A QUIET LOOK AT YOUR ARCHIVE</p>
        <h1>Patterns</h1>
        <p>Only the things your own records can show—no goals, scores, or comparisons.</p>
      </header>
      {data.totalRecords === 0 ? (
        <section className="patterns-empty">
          <p className="overline">NOTHING TO READ YET</p>
          <h2>Patterns appear after a few entries.</h2>
          <p>
            Start a collection or add a log. This page will stay quiet until your archive has something useful
            to say.
          </p>
          <Link className="button button-accent" to="/lists?kind=collection">
            Open collections <ArrowRight size={18} />
          </Link>
        </section>
      ) : (
        <>
          <section className="pattern-stat-grid" aria-label="Archive patterns">
            <PatternStat label="Records" value={data.totalRecords} detail="Things kept in your archive" />
            <PatternStat label="Ranked" value={data.rankedItemCount} detail="Items placed in order" />
            <PatternStat label="Revisits" value={data.revisitCount} detail="Returns to a collection item" />
            <PatternStat
              label="Favorites"
              value={data.favoriteCount}
              detail="Things you would choose again"
            />
            <PatternStat label="Would not again" value={data.notAgainCount} detail="Useful calls you made" />
          </section>
          <section className="pattern-notes">
            <article>
              <p className="overline">MOST RETURNED TO</p>
              {data.mostReturned ? (
                <Link to={`/lists/${data.mostReturned.listId}?focus=item:${data.mostReturned.itemId}`}>
                  <strong>{data.mostReturned.title}</strong>
                  <span>
                    {data.mostReturned.listName} · {data.mostReturned.count}{' '}
                    {data.mostReturned.count === 1 ? 'return' : 'returns'}
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <p>Log a return to an item and it will appear here.</p>
              )}
            </article>
            <article>
              <p className="overline">NEWEST COLLECTION</p>
              {data.newestCollection ? (
                <Link to={`/lists/${data.newestCollection.id}`}>
                  <strong>{data.newestCollection.name}</strong>
                  <span>
                    {data.newestCollection.itemCount}{' '}
                    {data.newestCollection.itemCount === 1 ? 'item' : 'items'} kept so far
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <p>Create a collection when you want something to compare or revisit.</p>
              )}
            </article>
            <article>
              <p className="overline">LAST TOUCHED</p>
              {data.lastTouchedCollection ? (
                <Link to={`/lists/${data.lastTouchedCollection.id}`}>
                  <strong>{data.lastTouchedCollection.name}</strong>
                  <span>
                    {data.lastTouchedCollection.itemCount}{' '}
                    {data.lastTouchedCollection.itemCount === 1 ? 'item' : 'items'} kept so far
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <p>Make a collection when you have something worth keeping close.</p>
              )}
            </article>
            <article>
              <p className="overline">MOST KEPT IN</p>
              {data.mostKeptCollection ? (
                <Link to={`/lists/${data.mostKeptCollection.id}`}>
                  <strong>{data.mostKeptCollection.name}</strong>
                  <span>
                    {data.mostKeptCollection.itemCount}{' '}
                    {data.mostKeptCollection.itemCount === 1 ? 'item' : 'items'} kept so far
                  </span>
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <p>Keep a few things in a collection and it will appear here.</p>
              )}
            </article>
            <article className="pattern-archive-scope">
              <p className="overline">ARCHIVE SHAPE</p>
              <strong>{data.totalCollections + data.totalActivities}</strong>
              <span>
                {data.totalCollections} collections · {data.totalActivities} activities
              </span>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function PatternStat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
