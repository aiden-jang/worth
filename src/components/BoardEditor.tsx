import { X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlocker } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, RequestError } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useConnection } from '../hooks/useConnection';
import {
  boardDraft,
  boardForm,
  boardPayload,
  boardLabels,
  emptyBoardDraft,
  type BoardDraft,
  type BoardView,
  type BoardStop,
} from '../shared/memory-boards';
import { BoardSourcePicker } from './BoardSourcePicker';
import { ConfirmDialog } from './ConfirmDialog';
type Confirmation = 'close' | 'saved' | 'review' | 'previous' | 'another' | 'storage';
export function BoardEditor({
  id,
  saved,
  onClose,
  onSaved,
}: {
  id: string | null;
  saved: BoardView | null;
  onClose: () => void;
  onSaved: (board: BoardView) => void;
}) {
  const client = useQueryClient(),
    online = useConnection();
  const initial: BoardDraft = saved
    ? { current: boardForm(saved), expectedRevision: saved.revision, pending: null, previous: null }
    : emptyBoardDraft();
  const draft = useDraft<BoardDraft>(
    id ? `board:${id}` : 'new-board',
    initial,
    (value): value is BoardDraft => boardDraft.safeParse(value).success,
  );
  const { form, setForm } = draft;
  const [baseline, setBaseline] = useState(initial.current),
    [busy, setBusy] = useState<'save' | 'check' | null>(null),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const [review, setReview] = useState<BoardView | null>(null),
    [checkedMissing, setCheckedMissing] = useState(false),
    [removed, setRemoved] = useState(false),
    [acknowledged, setAcknowledged] = useState<BoardView | null>(null),
    [confirm, setConfirm] = useState<Confirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    active = useRef(true),
    bypass = useRef(false),
    storageAccepted = useRef(false);
  const dirty = JSON.stringify(form.current) !== JSON.stringify(baseline);
  const blocker = useBlocker(
    () =>
      !bypass.current &&
      (!!busy || !!form.pending || dirty || (!!form.previous && draft.status.includes('could not'))),
  );
  const unavailable = !!id && !saved;
  const knownId = id ?? draft.savedId.current;
  useEffect(() => {
    const node = dialog.current;
    active.current = true;
    node?.showModal();
    return () => {
      active.current = false;
      node?.close();
    };
  }, []);
  function close() {
    if (busy === 'save') return;
    if (dirty || form.pending || form.previous || busy) setConfirm('close');
    else {
      bypass.current = true;
      onClose();
    }
  }
  function edit(current: BoardDraft['current']) {
    if (busy || form.pending || unavailable) return;
    setForm({ ...form, current });
    setError('');
    setStatus('');
  }
  function patchEntry(entryId: string, patch: Partial<BoardDraft['current']['entries'][number]>) {
    edit({
      ...form.current,
      entries: form.current.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
    });
  }
  function add(entry?: BoardStop) {
    edit({
      ...form.current,
      entries: [
        ...form.current.entries,
        entry
          ? { ...entry, day: entry.day ?? '' }
          : {
              id: crypto.randomUUID(),
              name: '',
              note: '',
              day: '',
              time: '',
              location: '',
              reference: null,
              referenceMissing: false,
              photo: false,
            },
      ],
    });
  }
  function move(index: number, by: number) {
    const entries = [...form.current.entries];
    [entries[index], entries[index + by]] = [entries[index + by], entries[index]];
    edit({ ...form.current, entries });
  }
  function sync(board: BoardView) {
    client.setQueryData(['board', board.id], { board });
    void client.invalidateQueries({ queryKey: ['boards'] });
  }
  const same = (board: BoardView, pending: NonNullable<BoardDraft['pending']>) =>
    JSON.stringify(boardPayload(boardForm(board))) === JSON.stringify(pending.board);
  function finish(board: BoardView) {
    const next = {
      ...draft.form,
      current: boardForm(board),
      expectedRevision: board.revision,
      pending: null,
    };
    draft.savedId.current = board.id;
    setForm(next);
    setBaseline(next.current);
    setReview(null);
    setCheckedMissing(false);
    setError('');
    setStatus('Board saved. Linked records, calls and ranks are unchanged.');
    setAcknowledged(board);
    sync(board);
    if (next.previous) draft.checkpoint(next);
    else {
      draft.clear(next);
      bypass.current = true;
      onSaved(board);
    }
  }
  async function send() {
    if (busy || !online || unavailable) return;
    if (draft.status.includes('could not') && !storageAccepted.current) {
      setConfirm('storage');
      return;
    }
    let pending = form.pending;
    if (!pending) {
      try {
        pending = {
          id: knownId ?? draft.operationId.current,
          board: boardPayload(form.current),
          revision: knownId ? form.expectedRevision : null,
        };
      } catch (cause) {
        setError(
          cause instanceof Error && 'issues' in cause
            ? String(
                (cause as { issues: { message: string }[] }).issues[0]?.message ??
                  'Check these board details.',
              )
            : 'Check the board name, dates and entries.',
        );
        return;
      }
      draft.checkpoint({ ...form, pending });
    }
    const frozen = pending;
    setBusy('save');
    setError('');
    setStatus('');
    try {
      const response =
        frozen.revision === null
          ? await api.createBoard(frozen.board, frozen.id)
          : await api.updateBoard(frozen.id, frozen.board, frozen.revision);
      if (!active.current) return;
      draft.rememberSaved(response.board.id);
      if (same(response.board, frozen)) finish(response.board);
      else {
        setReview(response.board);
        setStatus(
          'This save has a board, but its current details differ. Review the saved board below; your original draft is kept.',
        );
        sync(response.board);
      }
    } catch (cause) {
      if (active.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not save. Keep this page open and check saved details.',
        );
        setRemoved(cause instanceof RequestError && cause.status === 410);
      }
    } finally {
      if (active.current) setBusy(null);
    }
  }
  async function check() {
    const candidate = form.pending?.id ?? knownId;
    if (!candidate || busy || !online) return;
    setBusy('check');
    setError('');
    setStatus('');
    setCheckedMissing(false);
    try {
      const response = await api.board(candidate);
      if (!active.current) return;
      draft.rememberSaved(response.board.id);
      sync(response.board);
      if (form.pending && same(response.board, form.pending)) finish(response.board);
      else {
        setReview(response.board);
        setStatus('Saved details opened below. Your draft remains above.');
      }
    } catch (cause) {
      if (active.current) {
        if (cause instanceof RequestError && cause.status === 404) {
          setCheckedMissing(true);
          setStatus(
            'No saved board is available at this address. Keep the draft and retry the same save, or review the draft again.',
          );
        } else setError(cause instanceof Error ? cause.message : 'Could not open saved details.');
      }
    } finally {
      if (active.current) setBusy(null);
    }
  }
  function adoptSaved() {
    if (!review) return;
    const next: BoardDraft = {
      current: boardForm(review),
      expectedRevision: review.revision,
      pending: null,
      previous: { form: form.current, expectedRevision: form.expectedRevision },
    };
    draft.checkpoint(next);
    setBaseline(next.current);
    setReview(null);
    setError('');
    setStatus('Saved board loaded. One previous draft is kept below for copying.');
    setConfirm(null);
  }
  function keepDraft() {
    if (!review) return;
    draft.checkpoint({ ...form, pending: null, expectedRevision: review.revision });
    setBaseline(boardForm(review));
    setReview(null);
    setError('');
    setStatus('Saved details reviewed. Your draft is still above. Save again to apply it.');
  }
  const locked = !!busy || !!form.pending || unavailable;
  return createPortal(
    <>
      <dialog
        ref={dialog}
        className="editor-dialog board-editor-dialog"
        aria-labelledby="board-editor-heading"
        onCancel={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
        onClose={(event) => {
          event.stopPropagation();
          if (!dialog.current?.open) onClose();
        }}
      >
        <div className="editor-inner">
          <div className="editor-head">
            <div>
              <p className="overline">PRIVATE BOARD</p>
              <h2 id="board-editor-heading">{id ? 'Edit board' : 'New board'}</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Close board editor"
              disabled={busy === 'save'}
              onClick={close}
            >
              <X size={22} />
            </button>
          </div>
          <p>
            Keep up to 40 entries across your collections and visits. Linked records keep their own content,
            calls and ranks.
          </p>
          {unavailable && (
            <p role="alert">
              The saved board is unavailable. Any device draft stays here for copying; saving is disabled.
            </p>
          )}
          {unavailable && <DraftReadout form={form.current} />}
          <fieldset disabled={locked} className="board-editor-fields">
            <legend className="sr-only">Board details</legend>
            <div className="board-field-pair">
              <label>
                Name
                <input
                  maxLength={80}
                  value={form.current.name}
                  onChange={(e) => edit({ ...form.current, name: e.target.value })}
                />
              </label>
              <label>
                Kind
                <select
                  value={form.current.kind}
                  onChange={(e) =>
                    edit({ ...form.current, kind: e.target.value as BoardDraft['current']['kind'] })
                  }
                >
                  {Object.entries(boardLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Introduction · optional
              <textarea
                maxLength={2000}
                value={form.current.introduction}
                onChange={(e) => edit({ ...form.current, introduction: e.target.value })}
              />
            </label>
            <details className="board-date-details">
              <summary>Dates and archiving · optional</summary>
              <div className="board-field-pair">
                <label>
                  Start date
                  <input
                    type="date"
                    value={form.current.from}
                    onChange={(e) => edit({ ...form.current, from: e.target.value })}
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    value={form.current.until}
                    onChange={(e) => edit({ ...form.current, until: e.target.value })}
                  />
                </label>
              </div>
              <p>Dates label the board; they never archive or delete your entries automatically.</p>
              <label className="board-check">
                <input
                  type="checkbox"
                  checked={form.current.archived}
                  onChange={(e) => edit({ ...form.current, archived: e.target.checked })}
                />
                Archive this board
              </label>
            </details>
            <details className="board-add-details">
              <summary>Add a linked record or visit</summary>
              <BoardSourcePicker disabled={locked || form.current.entries.length >= 40} onAdd={add} />
            </details>
            <div className="board-section-heading">
              <h3>Entries · {form.current.entries.length}/40</h3>
              <button
                className="button button-outline"
                disabled={form.current.entries.length >= 40}
                onClick={() => add()}
              >
                Add unlinked entry
              </button>
            </div>
            {!form.current.entries.length && (
              <p>A name is enough to save the board. Add entries whenever you need them.</p>
            )}
            <ol className="board-entry-editors">
              {form.current.entries.map((entry, index) => (
                <li key={entry.id}>
                  <h3>Entry {index + 1}</h3>
                  <label>
                    Name for entry {index + 1}
                    <input
                      maxLength={120}
                      value={entry.name}
                      onChange={(e) => patchEntry(entry.id, { name: e.target.value })}
                    />
                  </label>
                  <label>
                    Note for entry {index + 1} · optional
                    <textarea
                      maxLength={1000}
                      value={entry.note}
                      onChange={(e) => patchEntry(entry.id, { note: e.target.value })}
                    />
                  </label>
                  <div className="board-field-pair">
                    <label>
                      Date for entry {index + 1} · optional
                      <input
                        type="date"
                        value={entry.day}
                        onChange={(e) => patchEntry(entry.id, { day: e.target.value })}
                      />
                    </label>
                    <label>
                      Time for entry {index + 1} · optional
                      <input
                        type="time"
                        value={entry.time}
                        onChange={(e) => patchEntry(entry.id, { time: e.target.value })}
                      />
                    </label>
                  </div>
                  <label>
                    Location for entry {index + 1} · optional
                    <input
                      maxLength={240}
                      value={entry.location}
                      onChange={(e) => patchEntry(entry.id, { location: e.target.value })}
                    />
                  </label>
                  {entry.reference && (
                    <>
                      <p>
                        Linked {entry.reference.kind === 'log' ? 'visit' : 'record'}. Enter dates and
                        locations yourself; linked content is read live.
                      </p>
                      <label className="board-check">
                        <input
                          type="checkbox"
                          checked={entry.photo}
                          onChange={(e) => patchEntry(entry.id, { photo: e.target.checked })}
                        />
                        Show its current saved cover for entry {index + 1}
                      </label>
                      <button
                        className="button button-outline"
                        onClick={() =>
                          patchEntry(entry.id, { reference: null, referenceMissing: false, photo: false })
                        }
                      >
                        Unlink entry {index + 1}
                      </button>
                    </>
                  )}
                  <div className="data-actions">
                    <button
                      className="button button-outline"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      Earlier entry {index + 1}
                    </button>
                    <button
                      className="button button-outline"
                      disabled={index === form.current.entries.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      Later entry {index + 1}
                    </button>
                    <button
                      className="button button-outline"
                      onClick={() =>
                        edit({
                          ...form.current,
                          entries: form.current.entries.filter((row) => row.id !== entry.id),
                        })
                      }
                    >
                      Remove entry {index + 1} from board
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </fieldset>
          <p role="status">
            {draft.status || 'Board drafts can recover on this account/device for seven days.'}
          </p>
          {form.pending && (
            <section className="board-pending">
              <h3>Pending save</h3>
              <p>
                This reviewed save stays fixed while its outcome is uncertain. Retry it or check the saved
                board before editing.
              </p>
              <DraftReadout form={form.current} />
            </section>
          )}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!!busy || !online || unavailable}
              onClick={() => void send()}
            >
              {form.pending ? 'Retry exact board save' : 'Save board'}
            </button>
            {(form.pending || knownId) && (
              <button
                className="button button-outline"
                disabled={!!busy || !online}
                onClick={() => void check()}
              >
                Load saved board to compare
              </button>
            )}
          </div>
          {!online && (
            <p role="status">
              You’re offline. Your draft stays on this device when storage is available; reconnect to save or
              load records.
            </p>
          )}
          {busy && (
            <p role="status">{busy === 'save' ? 'Saving the reviewed board…' : 'Opening saved details…'}</p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {status && <p role="status">{status}</p>}
          {review && (
            <section className="board-saved-review">
              <h3>Currently saved</h3>
              <DraftReadout form={boardForm(review)} />
              <div className="data-actions">
                <button
                  className="button button-outline"
                  disabled={!!busy}
                  onClick={() => setConfirm('saved')}
                >
                  Use saved board
                </button>
                <button className="button button-outline" disabled={!!busy} onClick={keepDraft}>
                  Use my draft for the next save
                </button>
              </div>
              <p>
                Neither choice saves automatically. Using your draft requires another Save with the reviewed
                board.
              </p>
            </section>
          )}
          {form.pending && (checkedMissing || error) && (
            <button
              className="button button-outline"
              disabled={!!busy}
              onClick={() => setConfirm(removed ? 'another' : 'review')}
            >
              {removed ? 'Make another board from this draft' : 'Review this draft again'}
            </button>
          )}
          {form.previous && (
            <details className="board-previous">
              <summary>Previous draft kept for copying</summary>
              <DraftReadout form={form.previous.form} />
              <button
                className="button button-outline"
                disabled={!!busy || !!form.pending}
                onClick={() => setConfirm('previous')}
              >
                Restore previous draft for review
              </button>
            </details>
          )}
          {!form.pending && acknowledged && status.startsWith('Board saved') && (
            <button
              className="button button-outline"
              onClick={() => {
                bypass.current = true;
                onSaved(acknowledged);
              }}
            >
              Open saved board
            </button>
          )}
        </div>
      </dialog>
      {(confirm || blocker.state === 'blocked') && (
        <ConfirmDialog
          className="board-confirm"
          title={
            blocker.state === 'blocked'
              ? 'Leave this page?'
              : confirm === 'saved'
                ? 'Use the saved board?'
                : confirm === 'review'
                  ? 'Review this draft again?'
                  : confirm === 'previous'
                    ? 'Restore the previous draft?'
                    : confirm === 'another'
                      ? 'Make another board?'
                      : confirm === 'storage'
                        ? 'Save without device recovery?'
                        : 'Close this board editor?'
          }
          description={
            confirm === 'saved'
              ? 'Your current draft becomes one previous copy on this device when storage is available. Copy anything important first.'
              : confirm === 'review'
                ? 'The next save will be a new review. If an earlier save arrived, Worth will ask you to review the saved board before changing it.'
                : confirm === 'previous'
                  ? 'The previous draft keeps its original save boundary. A changed saved board still needs review.'
                  : confirm === 'another'
                    ? 'The removed board cannot be recreated by an old retry. This starts a separate board from the draft you can review again.'
                    : confirm === 'storage'
                      ? 'This device cannot keep retry details. Keep this page open if a reply fails, and check the saved board before starting another.'
                      : 'Drafts can recover for seven days when storage is available. If storage is blocked, copy any notes or previous draft before leaving.'
          }
          confirmLabel={
            blocker.state === 'blocked'
              ? 'Leave page'
              : confirm === 'saved'
                ? 'Use saved board'
                : confirm === 'review'
                  ? 'Review again'
                  : confirm === 'previous'
                    ? 'Restore draft'
                    : confirm === 'another'
                      ? 'Start another board'
                      : confirm === 'storage'
                        ? 'Save board'
                        : 'Close editor'
          }
          pending={busy === 'save'}
          onClose={() => {
            setConfirm(null);
            if (blocker.state === 'blocked') blocker.reset();
          }}
          onConfirm={() => {
            if (blocker.state === 'blocked') {
              bypass.current = true;
              blocker.proceed();
              return;
            }
            if (confirm === 'saved') {
              adoptSaved();
              return;
            }
            if (confirm === 'storage') {
              storageAccepted.current = true;
              setConfirm(null);
              void send();
              return;
            }
            if (confirm === 'previous' && form.previous) {
              draft.checkpoint({
                ...form,
                current: form.previous.form,
                expectedRevision: form.previous.expectedRevision,
                previous: { form: form.current, expectedRevision: form.expectedRevision },
                pending: null,
              });
              setConfirm(null);
              return;
            }
            if (confirm === 'review' || confirm === 'another') {
              if (confirm === 'another') {
                draft.operationId.current = crypto.randomUUID();
                draft.savedId.current = null;
              }
              draft.checkpoint({ ...form, pending: null });
              setConfirm(null);
              setError('');
              setStatus('Draft ready for another review. Saving is still explicit.');
              return;
            }
            bypass.current = true;
            onClose();
          }}
        />
      )}
    </>,
    document.body,
  );
}
function DraftReadout({ form }: { form: BoardDraft['current'] }) {
  return (
    <div className="board-draft-readout">
      <h4>{form.name || 'Unnamed board'}</h4>
      <p>
        {boardLabels[form.kind]}
        {form.from ? ` · ${form.from}` : ''}
        {form.until ? ` → ${form.until}` : ''}
        {form.archived ? ' · Archived' : ''}
      </p>
      {form.introduction && <p>{form.introduction}</p>}
      <ol>
        {form.entries.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.name || 'Unnamed entry'}</strong>
            {(entry.day || entry.time || entry.location) && (
              <p>{[entry.day, entry.time, entry.location].filter(Boolean).join(' · ')}</p>
            )}
            {entry.note && <p>{entry.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
