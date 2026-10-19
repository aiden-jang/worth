import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, RequestError } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { boardLabels, type BoardView } from '../shared/memory-boards';
import { BoardEditor } from '../components/BoardEditor';
import { BoardObject } from '../components/BoardObject';
import { BoardReplay } from '../components/BoardReplay';
import { BoardStopList } from '../components/BoardStopList';
import { ConfirmDialog } from '../components/ConfirmDialog';
import '../memory-boards.css';
export function BoardsPage() {
  usePageTitle('Boards');
  const query = useQuery({ queryKey: ['boards'], queryFn: api.boards }),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams(),
    [filter, setFilter] = useState(''),
    [limit, setLimit] = useState(25);
  const requestedKind = params.get('kind') ?? 'all',
    requestedStatus = params.get('status') ?? 'current';
  const kind = Object.hasOwn(boardLabels, requestedKind) ? requestedKind : 'all',
    status = ['current', 'archived', 'all'].includes(requestedStatus) ? requestedStatus : 'current';
  const [filtersOpen, setFiltersOpen] = useState(kind !== 'all' || status !== 'current');
  const boards = query.data?.boards ?? [],
    shown = boards.filter(
      (board) =>
        (kind === 'all' || board.kind === kind) &&
        (status === 'all' || board.archived === (status === 'archived')) &&
        board.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
    );
  const change = (key: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
    setLimit(25);
  };
  return (
    <main className="light-page page-width boards-page">
      <header className="page-head">
        <div>
          <p className="overline">YOUR ARCHIVE</p>
          <h1>Boards</h1>
          <p>Keep a few things together.</p>
        </div>
        <Link to="/patterns">Back to Patterns →</Link>
      </header>
      <p>
        Moments, shortlists, evenings and trips can draw from any of your collections or visits. Linked
        records keep their own calls and ranks. Boards stay private.
      </p>
      <div className="board-directory-actions">
        <button
          className="button button-accent"
          disabled={boards.length >= 100}
          onClick={() =>
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              next.set('new', '1');
              return next;
            })
          }
        >
          New board
        </button>
        <p>Keep up to 100 boards, including archived boards.</p>
      </div>
      <details
        className="board-filter-details"
        open={filtersOpen}
        onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
      >
        <summary>
          Find and filter boards{kind !== 'all' ? ` · ${boardLabels[kind as keyof typeof boardLabels]}` : ''}
          {status !== 'current' ? ` · ${status === 'all' ? 'Current and archived' : 'Archived'}` : ''}
          {filter.trim() ? ' · Name filter' : ''}
        </summary>
        <section className="board-filters" aria-label="Board filters">
          <label>
            Find a board
            <input
              maxLength={120}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setLimit(25);
              }}
            />
          </label>
          <label>
            Kind
            <select value={kind} onChange={(event) => change('kind', event.target.value)}>
              <option value="all">All kinds</option>
              {Object.entries(boardLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => change('status', event.target.value)}>
              <option value="current">Current</option>
              <option value="archived">Archived</option>
              <option value="all">Current and archived</option>
            </select>
          </label>
        </section>
      </details>
      {query.isPending && <p role="status">Opening your boards…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          {query.data ? ' The last loaded board directory remains below.' : ''}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry boards
          </button>
        </p>
      )}
      {query.data && !shown.length && (
        <section className="board-empty">
          <BoardObject kind="moment" />
          <h2>{boards.length ? 'No boards match.' : 'A place for these things.'}</h2>
          <p>
            {boards.length
              ? 'Change the name, kind or status filters.'
              : 'Start with a name. Add linked records or unlinked entries when you need them.'}
          </p>
        </section>
      )}
      <div className="board-directory">
        {shown.slice(0, limit).map((board) => (
          <Link className="board-directory-card" key={board.id} to={`/patterns/boards/${board.id}`}>
            <BoardObject kind={board.kind} />
            <div>
              <p className="overline">
                {boardLabels[board.kind]}
                {board.archived ? ' · Archived' : ''}
              </p>
              <h2>{board.name}</h2>
              <p>
                {board.entryCount} {board.entryCount === 1 ? 'entry' : 'entries'}
                {board.from ? ` · ${board.from}` : ''}
                {board.until ? ` → ${board.until}` : ''}
              </p>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      {shown.length > limit && (
        <button className="button button-outline" onClick={() => setLimit(limit + 25)}>
          Show more boards
        </button>
      )}
      {params.get('new') === '1' && (
        <BoardEditor
          id={null}
          saved={null}
          onClose={() =>
            setParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.delete('new');
                return next;
              },
              { replace: true },
            )
          }
          onSaved={(board) => navigate(`/patterns/boards/${board.id}`, { replace: true })}
        />
      )}
    </main>
  );
}
export function BoardPage() {
  const id = useParams().id ?? '',
    navigate = useNavigate(),
    client = useQueryClient(),
    [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ['board', id], queryFn: () => api.board(id) }),
    board = query.data?.board;
  usePageTitle(board?.name ?? 'Board');
  const [removing, setRemoving] = useState<BoardView | null>(null);
  const remove = useMutation({
    mutationFn: () => api.removeBoard(id, removing!.revision),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['boards'] });
      navigate('/patterns/boards', { replace: true });
    },
    onError: () => void query.refetch(),
  });
  const unavailable = query.isError && query.error instanceof RequestError && query.error.status === 404;
  const close = () =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('edit');
        return next;
      },
      { replace: true },
    );
  return (
    <main className="light-page page-width board-page">
      <header className="page-head">
        <div>
          <p className="overline">
            {board ? `${boardLabels[board.kind]}${board.archived ? ' · ARCHIVED' : ''}` : 'PRIVATE BOARD'}
          </p>
          <h1>{board?.name ?? 'Board'}</h1>
        </div>
        <Link to="/patterns/boards">Back to Boards →</Link>
      </header>
      {query.isPending && <p role="status">Opening this board…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          {board && !unavailable ? ' The last loaded board remains below.' : ''}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry board
          </button>
        </p>
      )}
      {board && !unavailable && (
        <>
          <div className="board-directory-actions">
            <button className="button button-accent" onClick={() => setParams({ edit: '1' })}>
              Edit board
            </button>
            <button
              className="button button-outline"
              onClick={() => {
                remove.reset();
                setRemoving(board);
              }}
            >
              Remove board
            </button>
          </div>
          {board.introduction && <p className="board-introduction">{board.introduction}</p>}
          {(board.from || board.until) && (
            <p className="board-date-scope">
              Dates you entered: {board.from ?? 'Start not set'}
              {board.until ? ` → ${board.until}` : ''}
            </p>
          )}
          <p>
            Entries follow your saved order. Linked content is current; your entry names, notes, dates and
            locations stay as you wrote them.
          </p>
          {board.kind === 'trip' && params.get('edit') !== '1' && <BoardReplay board={board} />}
          {!board.entries.length ? (
            <section className="board-empty">
              <BoardObject kind={board.kind} />
              <h2>No entries yet.</h2>
              <p>Edit this board to add a record, visit or unlinked entry.</p>
            </section>
          ) : (
            <BoardStopList entries={board.entries} sources={board.sources} />
          )}
        </>
      )}
      {unavailable && (
        <button className="button button-outline" onClick={() => setParams({ edit: '1' })}>
          Open device draft for copying
        </button>
      )}
      {params.get('edit') === '1' && (board || unavailable) && (
        <BoardEditor
          key={id}
          id={id}
          saved={unavailable ? null : (board ?? null)}
          onClose={close}
          onSaved={() => close()}
        />
      )}
      {removing && (
        <ConfirmDialog
          className="board-confirm"
          title={`Remove ${removing.name}?`}
          description="This permanently removes only the board. Linked records, visits and their photos stay intact. This cannot be undone."
          confirmLabel="Remove board"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate()}
          onClose={() => setRemoving(null)}
        />
      )}
    </main>
  );
}
