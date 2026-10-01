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
        <a className="landing-sign-in" href={loginUrl(authOrigin, returnTo)}>
          Sign in
        </a>
      </header>
      <section className="landing-meter" aria-labelledby="landing-title">
        <div className="meter-caption meter-caption-low">
          <span>Least likely again</span>
          <strong>2.1</strong>
        </div>
        <div className="meter-track" aria-hidden="true">
          <span className="meter-point meter-point-low" />
          <span className="meter-point meter-point-high" />
        </div>
        <div className="meter-caption meter-caption-high">
          <span>Favorite right now</span>
          <strong>4.5</strong>
        </div>
        <h1 id="landing-title">worth</h1>
        <div className="landing-message">
          <p>Keep the things worth keeping.</p>
          <a className="landing-cta" href={signupUrl(authOrigin, returnTo)}>
            Start your archive <span>→</span>
          </a>
        </div>
      </section>
      <footer className="landing-pillars" aria-label="What Worth is for">
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
