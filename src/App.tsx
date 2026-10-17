import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loginUrl, signupUrl } from '@aidenjang/auth-client';
import { ProductLinks } from './components/ProductLinks';
import { InfoPage } from './pages/InfoPage';
import { Route, Routes, ScrollRestoration, useLocation } from 'react-router';
import { api, bindPageAccount } from './api';
import { CallFace, CallBadge } from './components/PersonalCall';
import { OpinionSlip } from './components/OpinionSlip';
import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ItemDecision } from './shared/models';
import { TrashNotice } from './components/TrashTools';
import { AppShell } from './components/AppShell';
import { AppUpdate } from './AppUpdate';
const ActivityCalendarPage = lazy(() =>
  import('./pages/ActivityCalendarPage').then((module) => ({ default: module.ActivityCalendarPage })),
);
const FieldGuidePage = lazy(() =>
  import('./pages/FieldGuidePage').then((module) => ({ default: module.FieldGuidePage })),
);
const ConnectionsPage = lazy(() =>
  import('./pages/ConnectionsPage').then((module) => ({ default: module.ConnectionsPage })),
);
const RetrospectivePage = lazy(() =>
  import('./pages/RetrospectivePage').then((module) => ({ default: module.RetrospectivePage })),
);
const CodeCapturePage = lazy(() =>
  import('./pages/CodeCapturePage').then((module) => ({ default: module.CodeCapturePage })),
);
const PhotoTextPage = lazy(() =>
  import('./pages/PhotoTextPage').then((module) => ({ default: module.PhotoTextPage })),
);
const InboxPage = lazy(() => import('./pages/InboxPage').then((module) => ({ default: module.InboxPage })));
const CapturePage = lazy(() =>
  import('./pages/CapturePage').then((module) => ({ default: module.CapturePage })),
);
const CaptureSignIn = lazy(() =>
  import('./pages/CapturePage').then((module) => ({ default: module.CaptureSignIn })),
);
const QuickPage = lazy(() => import('./pages/QuickPage').then((module) => ({ default: module.QuickPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const ArchivePage = lazy(() =>
  import('./pages/ArchivePage').then((module) => ({ default: module.ArchivePage })),
);
const ListsPage = lazy(() => import('./pages/ListsPage').then((module) => ({ default: module.ListsPage })));
const ListPage = lazy(() => import('./pages/ListPage').then((module) => ({ default: module.ListPage })));
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })),
);
const ShowPage = lazy(() => import('./pages/ShowPage').then((module) => ({ default: module.ShowPage })));
const PublicSharePage = lazy(() =>
  import('./pages/PublicSharePage').then((module) => ({ default: module.PublicSharePage })),
);
const PatternsPage = lazy(() =>
  import('./pages/PatternsPage').then((module) => ({ default: module.PatternsPage })),
);

const authOrigin =
  import.meta.env.VITE_AUTH_URL ??
  (import.meta.env.DEV ? 'http://localhost:34100' : 'https://accounts.aidenjang.com');

const pageScrollKey = (location: { pathname: string }) => location.pathname;

export function App() {
  return (
    <PageBoundary>
      <ScrollRestoration getKey={pageScrollKey} storageKey="worth:scroll-positions" />
      <AppUpdate />
      <Suspense
        fallback={
          <div className="boot-screen" role="status">
            Opening Worth…
          </div>
        }
      >
        <Routes>
          <Route path="/privacy" element={<InfoPage kind="privacy" />} />
          <Route path="/terms" element={<InfoPage kind="terms" />} />
          <Route path="/help" element={<InfoPage kind="help" />} />
          <Route path="/s/:token" element={<PublicSharePage />} />
          <Route path="*" element={<PrivateApp />} />
        </Routes>
      </Suspense>
    </PageBoundary>
  );
}

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="light-page page-width">
        <h1>Couldn’t open this page.</h1>
        <p>Your saved records are still in your archive.</p>
        <button className="button button-accent" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}

function PrivateApp() {
  const location = useLocation();
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['me'] });
    };
    window.addEventListener('worth:account-changed', refresh);
    return () => window.removeEventListener('worth:account-changed', refresh);
  }, [client]);

  return session.isPending ? (
    <div className="boot-screen">worth</div>
  ) : session.isError ? (
    <AuthProblem onRetry={() => void session.refetch()} />
  ) : session.data?.user && !bindPageAccount(session.data.user.id) ? (
    <AccountChanged email={session.data.user.email} />
  ) : session.data?.user ? (
    <AppShell user={session.data.user} authOrigin={authOrigin}>
      <Routes>
        <Route path="/" element={<ArchivePage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:listId" element={<ListPage />} />
        <Route path="/lists/:listId/show" element={<ShowPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/patterns" element={<PatternsPage />} />
        <Route path="/patterns/calendar" element={<ActivityCalendarPage />} />
        <Route path="/patterns/field-guide" element={<FieldGuidePage />} />
        <Route path="/patterns/connections" element={<ConnectionsPage />} />
        <Route path="/patterns/look-back" element={<RetrospectivePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/read" element={<PhotoTextPage />} />
        <Route path="/code" element={<CodeCapturePage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/quick" element={<QuickPage />} />
        <Route path="*" element={<InfoPage kind="missing" />} />
      </Routes>
      <TrashNotice />
    </AppShell>
  ) : location.pathname === '/capture' ? (
    <CaptureSignIn authOrigin={authOrigin} />
  ) : [
      '/',
      '/read',
      '/code',
      '/patterns/look-back',
      '/patterns/connections',
      '/patterns/field-guide',
      '/patterns/calendar',
      '/inbox',
      '/quick',
      '/settings',
      '/lists',
      '/search',
      '/patterns',
    ].includes(location.pathname) || /^\/lists\/[^/]+(?:\/show)?\/?$/.test(location.pathname) ? (
    <Welcome authOrigin={authOrigin} />
  ) : (
    <InfoPage kind="missing" />
  );
}

function AccountChanged({ email }: { email: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="light-page page-width" aria-label="Account changed">
      <h1 ref={heading} tabIndex={-1}>
        Accounts changed.
      </h1>
      <p>
        You’re now signed in as {email}. Reload Worth to open that account. Unfinished drafts stay with their
        original account.
      </p>
      <button
        className="button button-accent"
        style={{ minHeight: 44 }}
        onClick={() => window.location.reload()}
      >
        Reload Worth
      </button>
    </main>
  );
}

const landingTopics = [
  { name: 'Drinks', caption: 'For research.', art: 'starter-covers/drinks-v2.svg' },
  { name: 'Midnight snacks', caption: 'Several were necessary.', art: 'landing/midnight-snacks.svg' },
  {
    name: 'Questionable purchases',
    caption: 'Seemed reasonable.',
    art: 'landing/questionable-purchases.svg',
  },
];

function Welcome({ authOrigin }: { authOrigin: string }) {
  const returnTo = window.location.href;
  return (
    <main className="cabinet-landing landing-cabinet">
      <header className="cabinet-landing-top">
        <span className="product-wordmark">worth</span>
        <a href={loginUrl(authOrigin, returnTo)}>
          Sign in <span aria-hidden="true">→</span>
        </a>
      </header>
      <section className="landing-cabinet-hero" aria-labelledby="landing-title">
        <p className="overline">YOUR TASTE, ON RECORD</p>
        <h1 id="landing-title">
          Your taste.
          <br />
          <em>A place to keep it.</em>
        </h1>
        <p>
          Keep what you try. Rank what you like.
          <br />
          The meh can stay.
        </p>
        <div className="landing-cabinet-actions">
          <a className="button button-accent" href={signupUrl(authOrigin, returnTo)}>
            Start your archive <span aria-hidden="true">→</span>
          </a>
          <a href="#worth-example">
            Try the example <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>
      <figure className="landing-cabinet-visual">
        <div className="landing-cabinet-folders" aria-hidden="true">
          {landingTopics.map(({ name, caption, art }) => (
            <div className="landing-cabinet-folder" key={name}>
              <span>
                <strong>{name}</strong>
                <small>{caption}</small>
              </span>
              <img src={`/art/${art}`} alt="" />
            </div>
          ))}
        </div>
        <div className="landing-cabinet-note">
          <p className="overline">COLD BREW / EXAMPLE</p>
          <div>
            <strong>Meh.</strong>
            <CallFace value="meh" />
          </div>
          <p>It was a thing.</p>
        </div>
        <figcaption>EXAMPLE / A FEW THINGS, FILED.</figcaption>
      </figure>
      <header className="landing-example-heading" id="worth-example">
        <p className="overline">EXAMPLE / MAKE YOUR CALL</p>
        <h2>Go on. Have an opinion.</h2>
        <p>Try the example. Nothing here is saved.</p>
      </header>
      <LandingExample />
      <footer className="cabinet-landing-bottom">
        <strong>Meh is a complete sentence.</strong>
        <span>Lists for your taste. Logs for the rest.</span>
        <ProductLinks />
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
  'Midnight snacks': [
    { title: 'Chili crisps', type: 'Snack', decision: 'favorite', ranked: true },
    { title: 'Emergency crackers', type: 'Snack', decision: 'meh', ranked: true },
    { title: 'Mystery freezer dumpling', type: 'Snack', decision: 'would_not_again', ranked: false },
  ],
  'Questionable purchases': [
    { title: 'Tiny desk lamp', type: 'Home', decision: 'favorite', ranked: true },
    { title: 'Another tote bag', type: 'Bag', decision: 'meh', ranked: true },
    { title: 'The miniature waffle maker', type: 'Kitchen', decision: 'would_not_again', ranked: false },
  ],
};

function LandingExample() {
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
        <p className="demo-footnote">Just an example. Nothing here is saved.</p>
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
