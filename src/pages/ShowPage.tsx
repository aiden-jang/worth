import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router';
import { api } from '../api';
import { rankedItems } from '../shared/ranking';

export function ShowPage() {
  const { listId = '' } = useParams();
  const [limit, setLimit] = useState<5 | 10 | 'all'>('all');
  const [full, setFull] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const listQuery = useQuery({ queryKey: ['list', listId], queryFn: () => api.list(listId) });
  const itemsQuery = useQuery({ queryKey: ['items', listId], queryFn: () => api.items(listId) });
  const list = listQuery.data?.list;
  const ranked = list ? rankedItems(list, itemsQuery.data?.items ?? []) : [];
  const visible = limit === 'all' ? ranked : ranked.slice(0, limit);

  useEffect(() => {
    const syncFullscreen = () => setFull(Boolean(document.fullscreenElement));
    syncFullscreen();
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        setFullscreenError('Fullscreen is not available in this browser.');
      }
    } catch {
      setFullscreenError('Could not enter fullscreen. Check your browser permissions and try again.');
    }
  }

  if (listQuery.isPending || itemsQuery.isPending)
    return (
      <main className="show-page show-message" role="status">
        Opening…
      </main>
    );
  if (listQuery.isError || itemsQuery.isError || !list || list.kind !== 'collection')
    return (
      <main className="show-page show-message">
        This list isn't available. <Link to="/lists">Back to lists</Link>
      </main>
    );

  return (
    <main className="show-page">
      <header className="show-header">
        <Link to={`/lists/${list.id}`}>
          <ArrowLeft size={19} /> Back to list
        </Link>
        <span className="show-brand">worth</span>
        <button
          onClick={() => void toggleFullscreen()}
          aria-label={full ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-describedby={fullscreenError ? 'fullscreen-error' : undefined}
        >
          {full ? <ArrowsIn size={21} /> : <ArrowsOut size={21} />}
        </button>
      </header>
      {fullscreenError && (
        <p className="show-fullscreen-error" id="fullscreen-error" role="status">
          {fullscreenError}
        </p>
      )}
      <div className="show-intro">
        <div className="show-intro-copy">
          <p className="overline">YOUR RANKED LIST</p>
          <h1>{list.name}</h1>
        </div>
        {ranked[0] && (
          <aside className="show-favorite">
            <span>Favorite right now</span>
            <strong>{ranked[0].title}</strong>
            {ranked[0].type && <small>{ranked[0].type}</small>}
          </aside>
        )}
        <div className="show-controls" role="group" aria-label="How many rankings to show">
          {([5, 10, 'all'] as const).map((value) => (
            <button
              key={value}
              className={limit === value ? 'active' : ''}
              aria-pressed={limit === value}
              onClick={() => setLimit(value)}
            >
              {value === 'all' ? 'All' : `Top ${value}`}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <ol className="show-ranking">
          {visible.map((item, index) => (
            <li key={item.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item.title}</strong>
              <small>{item.type}</small>
            </li>
          ))}
        </ol>
      ) : (
        <div className="show-empty">
          Nothing ranked yet. <Link to={`/lists/${list.id}`}>Add a rank</Link> to show your list.
        </div>
      )}
      <footer className="show-footer">Ranking only. Notes and history stay private.</footer>
    </main>
  );
}
