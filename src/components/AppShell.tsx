import { useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logoutUrl, siteFooterLinks } from '@aidenjang/auth-client';
import { ArrowRight, Plus, X } from '@phosphor-icons/react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import type { AuthUser } from '@aidenjang/auth-client';
import { api } from '../api';

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
  if (location.pathname.endsWith('/show')) return <>{children}</>;

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
    dialog.current?.showModal();
  }

  return (
    <div className="app-shell app-shell-dark">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Worth, archive home">
          worth
        </Link>
        <nav aria-label="Main navigation" className="main-nav">
          <NavLink end to="/">
            Archive
          </NavLink>
          <NavLink to="/lists">Lists</NavLink>
          <NavLink to="/search">Search</NavLink>
        </nav>
        <div className="header-actions">
          <a
            className="account-link"
            href={new URL('/account', authOrigin).toString()}
            title={user.displayName}
          >
            Account
          </a>
          <button className="button button-accent header-add" onClick={openAdd} disabled={lists.isPending}>
            <Plus size={17} weight="bold" /> Add
          </button>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <span>worth</span>
        <span>Private until you say otherwise.</span>
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
      <dialog
        className="add-dialog"
        ref={dialog}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="dialog-head">
          <div>
            <p className="overline">QUICK ADD</p>
            <h2>Where does it go?</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={20} />
          </button>
        </div>
        <div className="add-list-choices">
          {lists.data?.lists.map((list) => (
            <button
              key={list.id}
              onClick={() => {
                dialog.current?.close();
                navigate(`/lists/${list.id}?new=1`);
              }}
            >
              <span>
                {list.name}
                <small>{list.kind === 'collection' ? 'Add an item' : 'Log a moment'}</small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
        <Link className="dialog-create" to="/lists?create=1" onClick={() => dialog.current?.close()}>
          Create a new list <ArrowRight size={16} />
        </Link>
      </dialog>
    </div>
  );
}
