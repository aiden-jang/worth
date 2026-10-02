import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api, RequestError } from '../api';

export function PublicSharePage() {
  const { token = '' } = useParams();
  const query = useQuery({
    queryKey: ['public', token],
    queryFn: () => api.publicShare(token),
    retry: false,
  });
  if (query.isPending) return <main className="public-page public-message">Opening list…</main>;
  if (query.isError) {
    const unavailable = query.error instanceof RequestError && [404, 410].includes(query.error.status);
    return (
      <main className="public-page public-message">
        <span className="brand">worth</span>
        <h1>{unavailable ? 'This link is no longer available.' : "Couldn't open this shared list."}</h1>
        <p>{unavailable ? 'It may have expired or been removed.' : 'Check your connection and try again.'}</p>
        {!unavailable && (
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        )}
        <Link to="/">Back to Worth</Link>
      </main>
    );
  }
  const { share } = query.data;
  return (
    <main className="public-page">
      <header className="public-header">
        <Link to="/" className="brand">
          worth
        </Link>
        <span>SHARED LIST</span>
      </header>
      <section className="public-content">
        <div className="public-content-head">
          <div>
            <p className="overline">RANKED LIST</p>
            <h1>{share.title}</h1>
          </div>
          {share.entries[0] && (
            <aside className="public-favorite">
              <span>Favorite right now</span>
              <strong>{share.entries[0].title}</strong>
              {share.entries[0].type && <small>{share.entries[0].type}</small>}
            </aside>
          )}
        </div>
        <ol>
          {share.entries.map((entry) => (
            <li key={`${entry.rank}-${entry.title}`}>
              <span>{String(entry.rank).padStart(2, '0')}</span>
              <strong>{entry.title}</strong>
              {entry.type && <small>{entry.type}</small>}
            </li>
          ))}
        </ol>
        <p className="public-footnote">
          A snapshot shared from Worth. Private notes and history aren't included.
        </p>
      </section>
    </main>
  );
}
