import { useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logoutUrl, siteFooterLinks } from '@aidenjang/auth-client';
import { ArrowRight, CaretDown, Plus, X } from '@phosphor-icons/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import type { AuthUser } from '@aidenjang/auth-client';
import { api } from '../api';
import { preferredQuickCaptureList } from '../shared/quick-capture';

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
  const location = useLocation();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [rememberedListId, setRememberedListId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(quickCaptureStorageKey),
  );
  if (location.pathname.endsWith('/show')) return <>{children}</>;

  const quickCaptureList = preferredQuickCaptureList(
    location.pathname,
    rememberedListId,
    lists.data?.lists ?? [],
  );
  const collectionLists = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const activityLists = lists.data?.lists.filter((list) => list.kind === 'activity') ?? [];
  const listScope = new URLSearchParams(location.search).get('kind');

  function rememberList(listId: string) {
    window.sessionStorage.setItem(quickCaptureStorageKey, listId);
    setRememberedListId(listId);
  }

  function openList(list: { id: string; kind: 'collection' | 'activity' }) {
    rememberList(list.id);
    dialog.current?.close();
    navigate(`/lists/${list.id}${list.kind === 'collection' ? '?capture=1' : '?new=1'}`);
  }

  function openAdd() {
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
    dialog.current?.showModal();
  }

  return (
    <div className="app-shell app-shell-dark">
      <aside className="app-rail">
        <Link to="/" className="brand" aria-label="Worth, archive home">
          worth
        </Link>
        <nav aria-label="Main navigation" className="main-nav">
          <NavLink end to="/">
            Archive
          </NavLink>
          <NavLink
            to="/lists?kind=collection"
            className={() =>
              location.pathname === '/lists' && listScope === 'collection' ? 'active' : undefined
            }
          >
            Collections
          </NavLink>
          <NavLink
            to="/lists?kind=activity"
            className={() =>
              location.pathname === '/lists' && listScope === 'activity' ? 'active' : undefined
            }
          >
            Activity
          </NavLink>
          <NavLink to="/patterns">Patterns</NavLink>
          <NavLink className="rail-utility-link" to="/search">
            Search
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
            Account
          </a>
          <div className={quickCaptureList ? 'quick-capture quick-capture-ready' : 'quick-capture'}>
            <button
              className="button button-accent header-add"
              onClick={openAdd}
              disabled={lists.isPending}
              aria-label={quickCaptureList ? `Add to ${quickCaptureList.name}` : 'Add to a list'}
            >
              <Plus size={17} weight="bold" />
              {quickCaptureList ? `Add to ${quickCaptureList.name}` : 'Add'}
            </button>
            {quickCaptureList && (
              <button
                className="quick-capture-picker"
                aria-label="Choose another list"
                onClick={() => dialog.current?.showModal()}
              >
                <CaretDown size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-content">
        {children}
        <footer className="site-footer">
          <span>worth</span>
          <span>Private by default.</span>
          {siteFooterLinks(authOrigin).map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noreferrer' : undefined}
            >
              {link.label}
            </a>
          ))}
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
        <div className="add-list-choices">
          {collectionLists.length > 0 && (
            <ListPickerGroup label="Collections" lists={collectionLists} onOpen={openList} />
          )}
          {activityLists.length > 0 && (
            <ListPickerGroup label="Activity" lists={activityLists} onOpen={openList} />
          )}
        </div>
        <Link className="dialog-create" to="/lists?create=1" onClick={() => dialog.current?.close()}>
          Create a new list <ArrowRight size={16} />
        </Link>
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
  lists: { id: string; name: string; kind: 'collection' | 'activity' }[];
  onOpen: (list: { id: string; kind: 'collection' | 'activity' }) => void;
}) {
  return (
    <section className="add-list-group" aria-label={label}>
      <p>{label}</p>
      {lists.map((list) => (
        <button key={list.id} onClick={() => onOpen(list)}>
          <span>
            {list.name}
            <small>{list.kind === 'collection' ? 'Add an item' : 'Log a moment'}</small>
          </span>
          <ArrowRight size={18} />
        </button>
      ))}
    </section>
  );
}
