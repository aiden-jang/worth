import { useQuery } from '@tanstack/react-query';
import { loginUrl, signupUrl } from '@aidenjang/auth-client';
import { Route, Routes } from 'react-router';
import { api } from './api';
import { CallBadge } from './components/PersonalCall';
import { OpinionSlip } from './components/OpinionSlip';
import { useRef, useState, type ReactNode } from 'react';
import type { ItemDecision } from './shared/models';
import { AppShell } from './components/AppShell';
import { ArchivePage } from './pages/ArchivePage';
import { ListsPage } from './pages/ListsPage';
import { ListPage } from './pages/ListPage';
import { SearchPage } from './pages/SearchPage';
import { ShowPage } from './pages/ShowPage';
import { PublicSharePage } from './pages/PublicSharePage';
import { PatternsPage } from './pages/PatternsPage';

const authOrigin =
  import.meta.env.VITE_AUTH_URL ??
  (import.meta.env.DEV ? 'http://localhost:34100' : 'https://accounts.aidenjang.com');

export function App() {
  return (
    <Routes>
      <Route path="/s/:token" element={<PublicSharePage />} />
      <Route path="*" element={<PrivateApp />} />
    </Routes>
  );
}

function PrivateApp() {
  const session = useQuery({ queryKey: ['me'], queryFn: api.me, retry: false });

  return session.isPending ? (
    <div className="boot-screen">worth</div>
  ) : session.isError ? (
    <AuthProblem onRetry={() => void session.refetch()} />
  ) : session.data?.user ? (
    <AppShell user={session.data.user} authOrigin={authOrigin}>
      <Routes>
        <Route path="/" element={<ArchivePage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:listId" element={<ListPage />} />
        <Route path="/lists/:listId/show" element={<ShowPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/patterns" element={<PatternsPage />} />
        <Route path="*" element={<ArchivePage />} />
      </Routes>
    </AppShell>
  ) : (
    <Welcome authOrigin={authOrigin} />
  );
}

function Welcome({ authOrigin }: { authOrigin: string }) {
  const returnTo = window.location.href;
  return (
    <main className="cabinet-landing">
      <header className="cabinet-landing-top">
        <span className="product-wordmark">worth</span>
        <a href={loginUrl(authOrigin, returnTo)}>
          Sign in <span aria-hidden="true">→</span>
        </a>
      </header>
      <LandingExample
        introduction={
          <section className="cabinet-landing-hero" aria-labelledby="landing-title">
            <div>
              <p className="overline">YOUR TASTE, ON RECORD</p>
              <h1 id="landing-title">
                For the good.
                <br />
                And the <em>meh.</em>
              </h1>
            </div>
            <div className="cabinet-landing-intro">
              <p>
                Keep what you try.
                <br />
                Find what’s worth repeating.
              </p>
              <a className="button button-accent" href={signupUrl(authOrigin, returnTo)}>
                Start your archive <span aria-hidden="true">→</span>
              </a>
            </div>
          </section>
        }
      />
      <footer className="cabinet-landing-bottom">
        <strong>Meh is a complete sentence.</strong>
        <span>Collections, rankings & a place to remember.</span>
      </footer>
    </main>
  );
}

type ExampleItem = { title: string; type: string; decision: ItemDecision | null; ranked: boolean };
const exampleCollections: Record<string, ExampleItem[]> = {
  Drinks: [
    { title: 'Dry Riesling', type: 'Wine', decision: 'favorite', ranked: true },
    { title: 'Cold brew', type: 'Coffee', decision: 'meh', ranked: true },
    { title: 'Highball', type: 'Cocktail', decision: 'would_not_again', ranked: false },
  ],
  Movies: [
    { title: 'Perfect Days', type: 'Film', decision: 'favorite', ranked: true },
    { title: 'The Grand Budapest Hotel', type: 'Film', decision: 'favorite', ranked: true },
    { title: 'The sequel', type: 'Film', decision: 'meh', ranked: false },
  ],
  Places: [
    { title: 'The corner bakery', type: 'Bakery', decision: 'favorite', ranked: true },
    { title: 'That new lunch spot', type: 'Restaurant', decision: 'meh', ranked: true },
    { title: 'The rooftop bar', type: 'Bar', decision: 'would_not_again', ranked: false },
  ],
};

function LandingExample({ introduction }: { introduction: ReactNode }) {
  const exampleRef = useRef<HTMLElement>(null);
  const [collections, setCollections] = useState(exampleCollections);
  const [category, setCategory] = useState('Drinks');
  const [selected, setSelected] = useState(1);
  const [title, setTitle] = useState('');
  const items = collections[category];
  const item = items[selected];
  function revealOpinion(pointerClick: boolean) {
    if (!pointerClick || !window.matchMedia('(max-width: 680px)').matches) return;
    requestAnimationFrame(() => {
      exampleRef.current?.querySelector('.opinion-slip')?.scrollIntoView({
        block: 'center',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    });
  }
  return (
    <section ref={exampleRef} className="cabinet-demo" aria-label="Interactive collection example">
      {introduction}
      <OpinionSlip
        example
        title={item.title}
        type={item.type}
        rank={item.ranked ? selected + 1 : undefined}
        decision={item.decision}
        onChange={(decision) =>
          setCollections({
            ...collections,
            [category]: items.map((entry, index) => (index === selected ? { ...entry, decision } : entry)),
          })
        }
      />
      <div className="cabinet-demo-index">
        <div className="demo-tabs" role="group" aria-label="Example collection">
          {Object.keys(collections).map((name) => (
            <button
              key={name}
              aria-pressed={name === category}
              onClick={(event) => {
                setCategory(name);
                setSelected(1);
                setTitle('');
                revealOpinion(event.detail > 0);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="demo-heading">
          <div>
            <h2>{category}</h2>
            <span>{items.length} items · EXAMPLE</span>
          </div>
        </div>
        <ol className="demo-index">
          {items.map((entry, index) => (
            <li key={index} className={selected === index ? 'selected' : ''}>
              <button
                aria-pressed={selected === index}
                onClick={(event) => {
                  setSelected(index);
                  revealOpinion(event.detail > 0);
                }}
              >
                <span className="demo-rank">{entry.ranked ? String(index + 1).padStart(2, '0') : '—'}</span>
                <span className="demo-item-name">
                  <strong>{entry.title}</strong>
                  <small>{entry.type || 'Unranked'}</small>
                </span>
                {entry.decision && <CallBadge value={entry.decision} />}
              </button>
            </li>
          ))}
        </ol>
        <form
          className="demo-capture"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            setCollections({
              ...collections,
              [category]: [...items, { title: title.trim(), type: '', decision: null, ranked: false }],
            });
            setSelected(items.length);
            setTitle('');
          }}
        >
          <input
            aria-label="Add an example item"
            placeholder="What did you try?"
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="button button-accent" disabled={!title.trim()}>
            Keep it <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="demo-footnote">Just an example. Your actual opinions go in your archive.</p>
      </div>
    </section>
  );
}

function AuthProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="welcome welcome-error">
      <span className="brand">worth</span>
      <div className="welcome-body">
        <p className="overline">TEMPORARILY UNAVAILABLE</p>
        <h1>Account unavailable.</h1>
        <p className="welcome-copy">We couldn’t connect to your account. Try again in a moment.</p>
        <button className="button button-accent" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  );
}
