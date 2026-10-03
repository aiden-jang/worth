import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loginUrl, signupUrl } from '@aidenjang/auth-client';
import { Route, Routes } from 'react-router';
import { api } from './api';
import { AppShell } from './components/AppShell';
import { ArchivePage } from './pages/ArchivePage';
import { ListsPage } from './pages/ListsPage';
import { ListPage } from './pages/ListPage';
import { SearchPage } from './pages/SearchPage';
import { ShowPage } from './pages/ShowPage';
import { PublicSharePage } from './pages/PublicSharePage';

const authOrigin =
  import.meta.env.VITE_AUTH_URL ??
  (import.meta.env.DEV ? 'http://localhost:34100' : 'https://accounts.aidenjang.com');

const landingExamples = [
  {
    id: 'drinks',
    name: 'Drinks',
    itemLabel: 'COLLECTION',
    favorite: 'Dry Riesling',
    detail: 'A short private note, only for you.',
    items: [
      ['Dry Riesling', 'Wine'],
      ['Highball', 'Whiskey'],
      ['Cold brew', 'Coffee'],
    ],
  },
  {
    id: 'runs',
    name: 'Runs',
    itemLabel: 'ACTIVITY',
    favorite: 'Lake loop',
    detail: '5.2 mi, logged when it happened.',
    items: [
      ['Lake loop', '5.2 mi'],
      ['Easy four', '4.0 mi'],
      ['After work', '3.1 mi'],
    ],
  },
  {
    id: 'places',
    name: 'Places',
    itemLabel: 'COLLECTION',
    favorite: 'Corner table',
    detail: 'Keep the context that makes a place worth returning to.',
    items: [
      ['Corner table', 'Restaurant'],
      ['Late lunch', 'Restaurant'],
      ['Window seat', 'Coffee'],
    ],
  },
] as const;

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
        <Route path="*" element={<ArchivePage />} />
      </Routes>
    </AppShell>
  ) : (
    <Welcome authOrigin={authOrigin} />
  );
}

function Welcome({ authOrigin }: { authOrigin: string }) {
  const returnTo = window.location.href;
  const [exampleId, setExampleId] = useState<(typeof landingExamples)[number]['id']>('drinks');
  const example = landingExamples.find((entry) => entry.id === exampleId) ?? landingExamples[0];
  return (
    <main className="welcome">
      <header className="welcome-top">
        <span className="landing-brand">worth</span>
        <a className="landing-sign-in" href={loginUrl(authOrigin, returnTo)}>
          Sign in
        </a>
      </header>
      <section className="landing-meter" aria-labelledby="landing-title">
        <div className="meter-caption meter-caption-low">
          <span>Personal call</span>
          <strong>Would not again</strong>
        </div>
        <div className="meter-track" aria-hidden="true">
          <span className="meter-point meter-point-low" />
          <span className="meter-point meter-point-high" />
        </div>
        <div className="meter-caption meter-caption-high">
          <span>Personal call</span>
          <strong>Favorite</strong>
        </div>
        <h1 id="landing-title">worth</h1>
        <div className="landing-message">
          <p>Keep the things worth keeping.</p>
          <small>A private archive for what you tried, did, kept, and would not do again.</small>
          <a className="landing-cta" href={signupUrl(authOrigin, returnTo)}>
            Start your archive <span>→</span>
          </a>
        </div>
      </section>
      <section className="landing-proof" aria-labelledby="landing-proof-title">
        <header className="landing-proof-head">
          <div>
            <p className="overline">INSIDE WORTH</p>
            <h2 id="landing-proof-title">The list is only the beginning.</h2>
          </div>
          <p>Rank what held up. Keep the reason. Find it when it matters again.</p>
        </header>
        <figure className="landing-editorial">
          <img src="/images/worth-roadside-diner-v1.png" alt="A quiet roadside diner at blue hour" />
          <figcaption>Editorial illustration — not from a user archive.</figcaption>
        </figure>
        <div className="landing-example-switch" role="group" aria-label="Preview example lists">
          {landingExamples.map((entry) => (
            <button
              className={entry.id === example.id ? 'active' : ''}
              key={entry.id}
              aria-pressed={entry.id === example.id}
              onClick={() => setExampleId(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>
        <div className="landing-sample" aria-label={`Example ${example.name} list`}>
          <header className="landing-sample-head">
            <div>
              <span>{example.itemLabel} / EXAMPLE</span>
              <strong>{example.name}</strong>
            </div>
            <div>
              <span>Favorite right now</span>
              <strong>{example.favorite}</strong>
            </div>
          </header>
          <ol>
            {example.items.map(([title, detail], index) => (
              <li key={title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </li>
            ))}
          </ol>
          <aside>
            <span>PRIVATE CONTEXT</span>
            <p>{example.detail}</p>
            <small>Notes, dates, and photos stay yours.</small>
          </aside>
        </div>
      </section>
      <footer className="landing-close">
        <p>Private by default. Share only a ranked snapshot when you choose.</p>
        <div className="landing-pillars" aria-label="What Worth is for">
          <div>
            <span>01</span>
            <strong>Collect</strong>
            <p>What you find.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Log</strong>
            <p>What happened.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Rank</strong>
            <p>What held up.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function AuthProblem({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="welcome welcome-error">
      <span className="brand">worth</span>
      <div className="welcome-body">
        <p className="overline">TEMPORARILY UNAVAILABLE</p>
        <h1>Give it a minute.</h1>
        <p className="welcome-copy">
          We couldn't check your account. Your archive is still private and unchanged.
        </p>
        <button className="button button-accent" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  );
}
