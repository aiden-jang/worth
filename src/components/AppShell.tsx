import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { logoutUrl } from '@aidenjang/auth-client';
import {
  ArrowRight,
  ChartBar,
  DownloadSimple,
  House,
  List,
  MagnifyingGlass,
  Plus,
  Stack,
  Tray,
  X,
} from '@phosphor-icons/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import type { AuthUser } from '@aidenjang/auth-client';
import { cleanDeviceData } from '../shared/device-data';
import { quickEntryRequest, type SavedEntry } from '../shared/quick-entry';
import { ProductLinks } from './ProductLinks';
import { useConnection } from '../hooks/useConnection';
import { api } from '../api';

const InboxDrawer = lazy(() => import('./InboxDrawer').then((module) => ({ default: module.InboxDrawer })));
const QuickEntry = lazy(() => import('./QuickEntry').then((module) => ({ default: module.QuickEntry })));

export function AppShell({
  children,
  user,
  authOrigin,
}: {
  children: ReactNode;
  user: AuthUser;
  authOrigin: string;
}) {
  const online = useConnection(),
    client = useQueryClient();
  useEffect(() => {
    void cleanDeviceData(user.id).catch(() => {});
  }, [user.id]);
  const location = useLocation(),
    navigate = useNavigate();
  const shortcutsDialog = useRef<HTMLDialogElement>(null),
    menuToggle = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLElement>(null),
    content = useRef<HTMLDivElement>(null),
    addTrigger = useRef<HTMLButtonElement>(null);
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [menuOpen, setMenuOpen] = useState(false),
    [inboxOpen, setInboxOpen] = useState(false);
  const [add, setAdd] = useState<{ listId: string; title?: string } | null>(null);
  const [saved, setSaved] = useState<SavedEntry | null>(null);
  useEffect(() => {
    const clearSaved = () => setSaved(null);
    window.addEventListener('worth:trashed', clearSaved);
    return () => window.removeEventListener('worth:trashed', clearSaved);
  }, []);
  const collections = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const activities = lists.data?.lists.filter((list) => list.kind === 'activity') ?? [];
  const activityShortcut =
    activities.find((list) => list.name.trim().toLocaleLowerCase() === 'gym') ?? activities[0];
  useEffect(() => {
    setMenuOpen(false);
    setInboxOpen(false);
    setAdd(null);
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      setMenuOpen(false);
      menuToggle.current?.focus();
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !rail.current?.contains(event.target)) setMenuOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 681px)');
    const resize = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('focusin', outside);
    desktop.addEventListener('change', resize);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('focusin', outside);
      desktop.removeEventListener('change', resize);
    };
  }, [menuOpen]);
  const openAdd = useCallback(
    (input: { listId?: string; title?: string } = {}) => {
      const current = /^\/lists\/([^/]+)$/.exec(location.pathname)?.[1];
      const requested = input.listId ?? current;
      const target = lists.data?.lists.find((list) => list.id === requested && !list.archived);
      setMenuOpen(false);
      setInboxOpen(false);
      setAdd({ listId: input.listId === 'inbox' ? 'inbox' : (target?.id ?? 'inbox'), title: input.title });
    },
    [lists.data, location.pathname],
  );
  useEffect(() => {
    const handle = (event: Event) => {
      const input = quickEntryRequest.safeParse((event as CustomEvent).detail ?? {});
      if (input.success) openAdd(input.data);
    };
    window.addEventListener('worth:add-entry', handle);
    return () => window.removeEventListener('worth:add-entry', handle);
  }, [openAdd]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('add') !== '1' || lists.isPending) return;
    params.delete('add');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    openAdd();
  }, [location.pathname, location.search, lists.isPending, navigate, openAdd]);
  function restoreFocus() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && active.getClientRects().length) return;
    const trigger = addTrigger.current?.getClientRects().length
      ? addTrigger.current
      : rail.current?.querySelector<HTMLButtonElement>('.header-add');
    trigger?.focus();
  }
  useEffect(() => {
    if (location.pathname.endsWith('/show')) return;
    const handle = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.querySelector('dialog[open]')
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest('input, textarea, select, button, a, [role="button"]'))
        return;
      if (event.key === '/') {
        event.preventDefault();
        navigate('/search');
      }
      if (event.key === '?') {
        event.preventDefault();
        shortcutsDialog.current?.showModal();
      }
      if (event.key.toLocaleLowerCase() === 'n') {
        event.preventDefault();
        openAdd();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [location.pathname, navigate, openAdd]);
  useEffect(() => {
    const menus = () => [...document.querySelectorAll<HTMLDetailsElement>('details[data-menu][open]')];
    const outside = (event: Event) => {
      if (document.querySelector('dialog[open]')) return;
      for (const menu of menus())
        if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      const menu = menus().at(-1);
      if (!menu) return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const undo = useMutation({
    mutationFn: (entry: SavedEntry) =>
      entry.kind === 'inbox'
        ? api.deleteInbox(entry.id)
        : entry.kind === 'item' || entry.undoItemId
          ? api.deleteItem(entry.undoItemId ?? entry.id)
          : api.deleteLog(entry.id),
    onSuccess: (_, entry) => {
      setSaved((current) => (current?.id === entry.id ? null : current));
      void client.invalidateQueries();
    },
  });
  if (location.pathname.endsWith('/show')) return <>{children}</>;
  const collectionActive = location.pathname === '/lists' || /^\/lists\/[^/]+$/.test(location.pathname);
  const savedHref = saved
    ? saved.kind === 'inbox'
      ? `/inbox?focus=${saved.id}`
      : `/lists/${saved.listId}?focus=${saved.kind}:${saved.id}`
    : '/';
  return (
    <div className="app-shell app-shell-dark everyday-shell">
      <a
        className="skip-link"
        href="#worth-content"
        onClick={(event) => {
          const main = content.current?.querySelector('main');
          if (!main) return;
          event.preventDefault();
          main.tabIndex = -1;
          main.focus();
          main.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to content
      </a>
      <aside
        ref={rail}
        aria-label="Archive navigation"
        className={`app-rail ${menuOpen ? 'mobile-menu-open' : ''}`}
      >
        <Link to="/" className="brand" aria-label="Worth, home">
          worth
        </Link>
        <div className="mobile-header-actions">
          <Link to="/search" className="icon-button" aria-label="Search">
            <MagnifyingGlass size={23} />
          </Link>
          <button
            type="button"
            ref={menuToggle}
            className="mobile-menu-toggle icon-button"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="worth-navigation worth-rail-actions"
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X size={24} /> : <List size={24} />}
          </button>
        </div>
        <nav id="worth-navigation" aria-label="Main navigation" className="main-nav">
          <NavLink end to="/">
            <House size={18} aria-hidden="true" /> Home
          </NavLink>
          <NavLink to="/lists" className={() => (collectionActive ? 'active' : undefined)}>
            <Stack size={18} aria-hidden="true" /> Collections
          </NavLink>
          <NavLink to="/patterns">
            <ChartBar size={18} aria-hidden="true" /> Look back
          </NavLink>
          <NavLink className="rail-utility-link" to="/search">
            <MagnifyingGlass size={18} aria-hidden="true" /> Search
          </NavLink>
          <NavLink
            to="/inbox"
            onClick={(event) => {
              if (
                location.pathname === '/inbox' ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              )
                return;
              event.preventDefault();
              setMenuOpen(false);
              setInboxOpen(true);
            }}
          >
            <Tray size={18} aria-hidden="true" /> Unfiled
          </NavLink>
        </nav>
        {(collections.length > 0 || activityShortcut) && (
          <nav className="rail-collections" aria-label="Quick access">
            <p>QUICK ACCESS</p>
            {activityShortcut && (
              <NavLink to={`/lists/${activityShortcut.id}`}>
                {activityShortcut.name} <ArrowRight size={14} />
              </NavLink>
            )}
            {collections.slice(0, 3).map((list) => (
              <NavLink key={list.id} to={`/lists/${list.id}`}>
                <span>{list.name}</span>
              </NavLink>
            ))}
          </nav>
        )}
        <div className="rail-actions" id="worth-rail-actions">
          <button className="button button-accent header-add" onClick={() => openAdd()}>
            <Plus size={18} /> Add
          </button>
          <a
            className="account-link"
            href={new URL('/account', authOrigin).toString()}
            title={user.displayName}
          >
            <span className="account-avatar" aria-hidden="true">
              {(user.displayName || 'W').slice(0, 1).toUpperCase()}
            </span>
            <span>
              {user.displayName || 'Account'}
              <small>Account settings ↗</small>
            </span>
          </a>
          <Link className="rail-export" to="/settings">
            <DownloadSimple size={15} aria-hidden="true" /> Settings & data
          </Link>
          <button
            className="rail-shortcuts"
            type="button"
            onClick={() => shortcutsDialog.current?.showModal()}
          >
            Shortcuts <span>?</span>
          </button>
        </div>
      </aside>
      <div className="app-content" id="worth-content" ref={content}>
        {!online && (
          <p className="connection-state" role="status">
            You’re offline. Record drafts stay on this device. Reconnect to save to your archive.
          </p>
        )}
        {children}
        <footer className="site-footer">
          <span>worth</span>
          <ProductLinks />
          <a href={logoutUrl(authOrigin, window.location.origin)}>Sign out</a>
        </footer>
      </div>
      <nav className="mobile-primary" aria-label="Quick navigation">
        <NavLink end to="/">
          <House size={20} aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/lists" className={() => (collectionActive ? 'active' : undefined)}>
          <Stack size={20} aria-hidden="true" />
          <span>Collections</span>
        </NavLink>
        <NavLink to="/patterns">
          <ChartBar size={20} aria-hidden="true" />
          <span>Look back</span>
        </NavLink>
        <button ref={addTrigger} className="button button-accent" onClick={() => openAdd()}>
          <Plus size={19} /> Add
        </button>
      </nav>
      {saved && (
        <div className="entry-saved" role="status">
          <span>Saved “{saved.title}”.</span>
          <Link to={savedHref}>Open</Link>
          <button
            type="button"
            disabled={undo.isPending}
            onClick={() => {
              undo.reset();
              undo.mutate(saved);
            }}
          >
            {undo.isPending ? 'Undoing…' : 'Undo'}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss saved message"
            onClick={() => setSaved(null)}
          >
            <X size={18} />
          </button>
          {undo.isError && <span role="alert">{undo.error.message}</span>}
        </div>
      )}
      {add && (
        <Suspense
          fallback={
            <p className="entry-saved" role="status">
              Opening Add…
            </p>
          }
        >
          <QuickEntry
            key="quick-entry"
            lists={lists.data?.lists ?? []}
            initialListId={add.listId}
            initialTitle={add.title}
            onSaved={(entry) => {
              window.dispatchEvent(new Event('worth:entry-saved'));
              setSaved(entry);
            }}
            onClose={() => {
              setAdd(null);
              requestAnimationFrame(restoreFocus);
            }}
          />
        </Suspense>
      )}
      {inboxOpen && (
        <Suspense fallback={<p role="status">Opening Unfiled…</p>}>
          <InboxDrawer
            onClose={() => {
              setInboxOpen(false);
              requestAnimationFrame(restoreFocus);
            }}
          />
        </Suspense>
      )}
      <dialog
        className="add-dialog shortcut-dialog"
        aria-labelledby="worth-shortcuts-title"
        ref={shortcutsDialog}
        onClose={restoreFocus}
        onClick={(event) => {
          if (event.target === shortcutsDialog.current) shortcutsDialog.current.close();
        }}
      >
        <div className="dialog-head">
          <h2 id="worth-shortcuts-title">Keyboard shortcuts</h2>
          <button
            className="icon-button"
            aria-label="Close shortcuts"
            onClick={() => shortcutsDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <div className="shortcut-list">
          <p>
            <kbd>N</kbd>
            <span>Add a name</span>
          </p>
          <p>
            <kbd>/</kbd>
            <span>Search your saved entries</span>
          </p>
          <p>
            <kbd>C</kbd>
            <span>Focus the name field in a collection</span>
          </p>
          <p>
            <kbd>A</kbd>
            <span>Add an activity entry on an activity page</span>
          </p>
          <p>
            <kbd>Esc</kbd>
            <span>Close the current panel</span>
          </p>
        </div>
      </dialog>
    </div>
  );
}
