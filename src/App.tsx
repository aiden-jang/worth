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
        <span className="landing-brand">worth</span>
        <div className="welcome-top-actions">
          <span className="overline">PRIVATE ARCHIVE</span>
          <a href={loginUrl(authOrigin, returnTo)}>Sign in</a>
        </div>
      </header>
      <section className="landing-rail" aria-label="Worth at a glance">
        <div className="landing-panels" aria-hidden="true">
          <div className="landing-panel stone">
            <span>01</span>
          </div>
          <div className="landing-panel selected">
            <span>02</span>
          </div>
          <div className="landing-panel paper">
            <span>03</span>
          </div>
          <div className="landing-panel graphite">
            <span>04</span>
          </div>
          <div className="landing-panel plaster">
            <span>05</span>
          </div>
          <div className="landing-panel water">
            <span>06</span>
          </div>
        </div>
        <aside className="landing-index">
          <div>
            <span>01</span>
            <strong>Private by default</strong>
          </div>
          <div>
            <span>02</span>
            <strong>Collect</strong>
          </div>
          <div>
            <span>03</span>
            <strong>Log</strong>
          </div>
          <div>
            <span>04</span>
            <strong>Rank</strong>
          </div>
          <div>
            <span>05</span>
            <strong>Share on your terms</strong>
          </div>
        </aside>
      </section>
      <section className="landing-close">
        <div>
          <h1>A record of your own.</h1>
          <div className="welcome-actions">
            <a className="landing-action primary" href={signupUrl(authOrigin, returnTo)}>
              Start your archive <span>→</span>
            </a>
            <a className="landing-action" href={loginUrl(authOrigin, returnTo)}>
              Sign in <span>→</span>
            </a>
          </div>
        </div>
        <p className="landing-copy">
          A private place for the things you collect, what you have lived, and whatever keeps coming up.
        </p>
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
