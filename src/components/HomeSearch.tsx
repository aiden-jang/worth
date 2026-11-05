import { useRef, useState } from 'react';
import { ArrowRight, MagnifyingGlass, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';

export function HomeSearch() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  return (
    <form
      className="home-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(`/search${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`);
      }}
    >
      <MagnifyingGlass size={19} aria-hidden="true" />
      <label className="sr-only" htmlFor="home-search">
        Find a name, place or note
      </label>
      <input
        ref={input}
        id="home-search"
        name="q"
        type="search"
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        placeholder="Find a name, place or note…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {search && (
        <button
          type="button"
          aria-label="Clear home search"
          onClick={() => {
            setSearch('');
            input.current?.focus();
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
      <button type="submit" aria-label="Search saved entries">
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
