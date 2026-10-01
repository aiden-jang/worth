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
  return (
    <main className="welcome">
      <header className="welcome-top">
        <span className="brand">worth</span>
        <div className="welcome-top-actions">
          <span className="overline">PRIVATE ARCHIVE</span>
          <a href={loginUrl(authOrigin, returnTo)}>Sign in</a>
        </div>
      </header>
      <section className="welcome-hero">
        <div className="welcome-intro">
          <p className="overline">A PLACE TO KEEP TRACK</p>
          <h1>
            Keep track
            <br />
            of <span>what stays.</span>
          </h1>
          <p className="welcome-copy">
            The things you collect, the things you do, and the ones you keep bringing up. Private until you
            decide otherwise.
          </p>
          <div className="welcome-actions">
            <a className="button button-accent" href={signupUrl(authOrigin, returnTo)}>
              Start your archive
            </a>
            <a className="button button-outline-dark" href={loginUrl(authOrigin, returnTo)}>
              Sign in
            </a>
          </div>
          <p className="welcome-foot">No feed. No streaks. No audience.</p>
        </div>
        <section className="welcome-specimen" aria-label="What Worth helps you keep track of">
          <div className="welcome-specimen-head">
            <span>YOUR INDEX</span>
            <span>01 / 03</span>
          </div>
          <div className="welcome-specimen-card">
            <span className="specimen-number">01</span>
            <div>
              <p>COLLECT</p>
              <strong>
                Things you would
                <br />
                find again.
              </strong>
            </div>
          </div>
          <div className="welcome-specimen-list">
            <div>
              <span>02</span>
              <strong>Log the ordinary.</strong>
              <p>Runs, routines, meals, whatever.</p>
            </div>
            <div>
              <span>03</span>
              <strong>Know your favorites.</strong>
              <p>Rank what you would do again.</p>
            </div>
          </div>
          <p className="welcome-specimen-note">Your records are yours. Share a list only when you mean to.</p>
        </section>
      </section>
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
