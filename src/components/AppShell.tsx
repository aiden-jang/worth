import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logoutUrl } from '@aidenjang/auth-client';
import {
  ArrowRight,
  CaretDown,
  ChartBar,
  Clock,
  DownloadSimple,
  House,
  List,
  MagnifyingGlass,
  Plus,
  Stack,
  X,
} from '@phosphor-icons/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import type { AuthUser } from '@aidenjang/auth-client';
import { cleanDeviceData } from '../shared/device-data';
import { ProductLinks } from './ProductLinks';
import { useConnection } from '../hooks/useConnection';
import { api } from '../api';
import { preferredQuickCaptureList } from '../shared/quick-capture';
import { starterCollectionCover } from '../shared/starter-covers';
import type { ListSummary } from '../shared/models';

const quickCaptureStorageKey = 'worth:quick-capture-list';

export function AppShell({
  children,
  user,
  authOrigin,
}: {
  children: ReactNode;
  user: AuthUser;
  authOrigin: string;
}) {
  const online = useConnection();
  useEffect(() => {
    void cleanDeviceData(user.id).catch(() => {});
  }, [user.id]);
  const location = useLocation();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const shortcutsDialog = useRef<HTMLDialogElement>(null);
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [rememberedListId, setRememberedListId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(quickCaptureStorageKey),
  );
  const [pickerQuery, setPickerQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const quickCaptureList = preferredQuickCaptureList(
    location.pathname,
    rememberedListId,
    lists.data?.lists ?? [],
  );
  const collectionLists = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const activityLists = lists.data?.lists.filter((list) => list.kind === 'activity') ?? [];
  const pickerTerm = pickerQuery.trim().toLocaleLowerCase();
  const visibleCollectionLists = pickerTerm
    ? collectionLists.filter((list) =>
        `${list.name} ${list.description}`.toLocaleLowerCase().includes(pickerTerm),
      )
    : collectionLists;
  const visibleActivityLists = pickerTerm
    ? activityLists.filter((list) =>
        `${list.name} ${list.description}`.toLocaleLowerCase().includes(pickerTerm),
      )
    : activityLists;
  const listScope = new URLSearchParams(location.search).get('kind');

  const rememberList = useCallback((listId: string) => {
    window.localStorage.setItem(quickCaptureStorageKey, listId);
    setRememberedListId(listId);
  }, []);

  const openList = useCallback(
    (list: { id: string; kind: 'collection' | 'activity' }) => {
      rememberList(list.id);
      dialog.current?.close();
      navigate(`/lists/${list.id}${list.kind === 'collection' ? '?capture=1' : '?new=1'}`);
    },
    [navigate, rememberList],
  );

  const openPicker = useCallback(() => {
    setPickerQuery('');
    dialog.current?.showModal();
  }, []);

  const openAdd = useCallback(() => {
    if (lists.isPending) return;
    if (lists.isError) {
      navigate('/lists');
      return;
    }
    if (!lists.data?.lists.length) {
      navigate('/lists?create=1');
      return;
    }
    if (quickCaptureList) {
      openList(quickCaptureList);
      return;
    }
    openPicker();
  }, [
    lists.data?.lists.length,
    lists.isError,
    lists.isPending,
    navigate,
    openList,
    openPicker,
    quickCaptureList,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('add') !== '1' || lists.isPending) return;
    params.delete('add');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    openAdd();
  }, [location.pathname, location.search, lists.isPending, navigate, openAdd]);

  useEffect(() => {
    if (location.pathname.endsWith('/show')) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.closest('button, a, [role="button"]')
      )
        return;
      if (dialog.current?.open || shortcutsDialog.current?.open) return;

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
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [location.pathname, navigate, openAdd]);

  if (location.pathname.endsWith('/show')) return <>{children}</>;

  return (
    <div className="app-shell app-shell-dark">
      <aside className={`app-rail ${menuOpen ? 'mobile-menu-open' : ''}`}>
        <Link to="/" className="brand" aria-label="Worth, archive home">
          worth
        </Link>
        <button
          type="button"
          className="mobile-menu-toggle icon-button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="worth-navigation"
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X size={24} /> : <List size={24} />}
        </button>
        <nav id="worth-navigation" aria-label="Main navigation" className="main-nav">
          <NavLink end to="/">
            <House size={18} aria-hidden="true" /> Archive
          </NavLink>
          <NavLink
            to="/lists?kind=collection"
            className={() =>
              (location.pathname === '/lists' && listScope === 'collection') ||
              collectionLists.some((list) => location.pathname === `/lists/${list.id}`)
                ? 'active'
                : undefined
            }
          >
            <Stack size={18} aria-hidden="true" /> Collections
          </NavLink>
          <NavLink
            to="/lists?kind=activity"
            className={() =>
              (location.pathname === '/lists' && listScope === 'activity') ||
              activityLists.some((list) => location.pathname === `/lists/${list.id}`)
                ? 'active'
                : undefined
            }
          >
            <Clock size={18} aria-hidden="true" /> Activity
          </NavLink>
          <NavLink to="/patterns">
            <ChartBar size={18} aria-hidden="true" /> Patterns
          </NavLink>
          <NavLink className="rail-utility-link" to="/search" title="Press / to search">
            <MagnifyingGlass size={18} aria-hidden="true" /> Search <kbd>/</kbd>
          </NavLink>
        </nav>
        {collectionLists.length > 0 && (
          <nav className="rail-collections" aria-label="Your collections">
            <p>Collections</p>
            {collectionLists.slice(0, 8).map((list) => (
              <NavLink key={list.id} to={`/lists/${list.id}`}>
                <span>{list.name}</span>
                <small>{list.itemCount}</small>
              </NavLink>
            ))}
            {collectionLists.length > 8 && <Link to="/lists">All lists</Link>}
          </nav>
        )}
        <div className="rail-actions">
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
            title="Press ? for keyboard shortcuts"
            onClick={() => shortcutsDialog.current?.showModal()}
          >
            Shortcuts <span>?</span>
          </button>
          <div className={quickCaptureList ? 'quick-capture quick-capture-ready' : 'quick-capture'}>
            <button
              className="button button-accent header-add"
              onClick={openAdd}
              disabled={lists.isPending}
              aria-label={quickCaptureList ? `Add to ${quickCaptureList.name}` : 'Add to a list'}
              title="Press N to add"
            >
              <Plus size={17} weight="bold" />
              {quickCaptureList ? `Add to ${quickCaptureList.name}` : 'Add'}
            </button>
            {quickCaptureList && (
              <button className="quick-capture-picker" aria-label="Choose another list" onClick={openPicker}>
                <CaretDown size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-content">
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
      <dialog
        className="add-dialog"
        ref={dialog}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="dialog-head">
          <div>
            <p className="overline">ADD TO</p>
            <h2>Pick a list.</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={20} />
          </button>
        </div>
        {(collectionLists.length + activityLists.length > 6 || pickerQuery) && (
          <label className="add-list-search">
            <span className="sr-only">Find a list</span>
            <input
              autoFocus
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder="Find a list"
            />
          </label>
        )}
        <div className="add-list-choices">
          {visibleCollectionLists.length > 0 && (
            <ListPickerGroup label="Collections" lists={visibleCollectionLists} onOpen={openList} />
          )}
          {visibleActivityLists.length > 0 && (
            <ListPickerGroup label="Activity" lists={visibleActivityLists} onOpen={openList} />
          )}
          {pickerTerm && !visibleCollectionLists.length && !visibleActivityLists.length && (
            <p className="add-list-empty">No lists match “{pickerQuery.trim()}”.</p>
          )}
        </div>
        <Link className="dialog-create" to="/lists?create=1" onClick={() => dialog.current?.close()}>
          Create a new list <ArrowRight size={16} />
        </Link>
      </dialog>
      <dialog
        className="add-dialog shortcut-dialog"
        ref={shortcutsDialog}
        onClick={(event) => {
          if (event.target === shortcutsDialog.current) shortcutsDialog.current.close();
        }}
      >
        <div className="dialog-head">
          <div>
            <p className="overline">KEYBOARD</p>
            <h2>Less clicking.</h2>
          </div>
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
            <span>Add to your current or last-used list</span>
          </p>
          <p>
            <kbd>/</kbd>
            <span>Search your archive</span>
          </p>
          <p>
            <kbd>C</kbd>
            <span>Focus the capture field in a collection</span>
          </p>
          <p>
            <kbd>A</kbd>
            <span>Start a new activity log on an activity page</span>
          </p>
        </div>
        <p className="shortcut-note">Shortcuts pause while you type or use a control.</p>
      </dialog>
    </div>
  );
}

function ListPickerGroup({
  label,
  lists,
  onOpen,
}: {
  label: string;
  lists: ListSummary[];
  onOpen: (list: { id: string; kind: 'collection' | 'activity' }) => void;
}) {
  return (
    <section className="add-list-group" aria-label={label}>
      <p>{label}</p>
      {lists.map((list) => {
        const cover =
          list.kind === 'collection'
            ? list.hasCoverPhoto
              ? `/api/lists/${list.id}/cover?v=${list.updatedAt}`
              : starterCollectionCover(list.name, list.artwork)
            : null;
        return (
          <button key={list.id} onClick={() => onOpen(list)}>
            {cover && <img className="add-list-cover" src={cover} alt="" />}
            <span>
              {list.name}
              <small>{list.kind === 'collection' ? 'Add an item' : 'Log a moment'}</small>
            </span>
            <ArrowRight size={18} />
          </button>
        );
      })}
    </section>
  );
}
