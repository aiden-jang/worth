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
      <div className="welcome-top">
        <span className="brand">worth</span>
        <span className="overline">PRIVATE, BY DEFAULT</span>
      </div>
      <div className="welcome-body">
        <p className="overline">A LIFE LOG, MINUS THE PERFORMANCE</p>
        <h1>
          The stuff worth
          <br />
          <em>keeping.</em>
        </h1>
        <p className="welcome-copy">
          The places, pours, films, runs, cars, and little routines you want to remember. All in one place.
          Only yours until you choose to share.
        </p>
        <div className="welcome-actions">
          <a className="button button-accent" href={signupUrl(authOrigin, returnTo)}>
            Start your archive
          </a>
          <a className="button button-outline-dark" href={loginUrl(authOrigin, returnTo)}>
            Sign in
          </a>
        </div>
        <p className="welcome-foot">No streaks. No feed. Just your own memory with a better search bar.</p>
      </div>
      <div className="welcome-index" aria-hidden="true">
        <span>01 / COLLECT</span>
        <span>02 / REMEMBER</span>
        <span>03 / RANK</span>
        <span>04 / SHARE, IF YOU WANT</span>
      </div>
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
