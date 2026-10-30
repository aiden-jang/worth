import { loginUrl } from '@aidenjang/auth-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePageTitle } from '../hooks/usePageTitle';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { useIncomingCapture } from '../hooks/useIncomingCapture';
import { captureIssueText, suggestLink } from '../shared/reviewed-capture';
import { duplicateIdentity } from '../shared/record-identity';
import {
  captureBookmarklet,
  captureItem,
  emptyWebCapture,
  webCaptureDraft,
  type WebCaptureDraft,
} from '../shared/web-capture';
import '../web-capture.css';

export function CaptureSignIn({ authOrigin }: { authOrigin: string }) {
  usePageTitle('Capture');
  const share = useIncomingCapture();
  return (
    <main className="light-page capture-signin page-width">
      <p className="product-wordmark">worth</p>
      <h1>Keep this find.</h1>
      <p>
        Sign in to review the name, source and note, then keep it in Unfiled or a collection. Nothing is added
        automatically.
      </p>
      {share.incoming && (
        <section className="incoming-capture">
          <h2>Incoming share</h2>
          <IncomingPreview value={share.incoming} />
        </section>
      )}
      {share.error && <p role="alert">{share.error}</p>}
      {share.storageFailed && (
        <p role="alert">
          This tab couldn’t keep the incoming share. Copy its text before signing in, then paste it into
          capture.
        </p>
      )}
      <a
        className="button button-accent"
        href={loginUrl(authOrigin, new URL('/capture', location.origin).href)}
      >
        Sign in to review
      </a>
      <p>
        <Link to="/">Back to Worth</Link>
      </p>
    </main>
  );
}

function IncomingPreview({ value }: { value: { title: string; url: string; text: string } }) {
  return (
    <dl className="incoming-preview">
      <dt>Name</dt>
      <dd>{value.title || 'No shared name'}</dd>
      <dt>Source</dt>
      <dd>{value.url || 'No source link'}</dd>
      <dt>Text</dt>
      <dd>{value.text || 'No shared text'}</dd>
    </dl>
  );
}

export function CapturePage() {
  usePageTitle('Capture');
  const reviewRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const client = useQueryClient(),
    online = useConnection();
  const owner = client.getQueryData<{ user: { displayName: string; email: string } }>(['me'])?.user;
  const share = useIncomingCapture();
  const draft = useDraft<WebCaptureDraft>(
    'web-capture',
    emptyWebCapture,
    (value): value is WebCaptureDraft => webCaptureDraft.safeParse(value).success,
  );
  const form = draft.form,
    frozen = form.frozen;
  useEffect(() => {
    if (!form.review) return;
    reviewRef.current?.focus({ preventScroll: true });
    reviewRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [form.review]);
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const collections = lists.data?.lists.filter((list) => list.kind === 'collection') ?? [];
  const toInbox = form.listId === 'inbox';
  const chosen = collections.find((list) => list.id === form.listId);
  const destinationReady = toInbox || !!chosen;
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox, enabled: toInbox });
  const items = useQuery({
    queryKey: ['items', form.listId],
    queryFn: () => api.items(form.listId),
    enabled: !!chosen,
  });
  const [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const [replace, setReplace] = useState(false),
    [reset, setReset] = useState(false);
  const [saved, setSaved] = useState<{ id: string; listId: string | null } | null>(null);
  const [bookmarkCopied, setBookmarkCopied] = useState(false);
  const parsed = (() => {
    try {
      return { item: captureItem(form), error: '' };
    } catch (error) {
      return {
        item: null,
        error:
          error instanceof Error && 'issues' in error
            ? captureIssueText((error as import('zod').ZodError).issues)
            : 'Review the capture fields.',
      };
    }
  })();
  const reviewedItem = frozen?.item ?? parsed.item;
  const duplicate =
    !!parsed.item &&
    !!(toInbox ? inbox.data?.entries : items.data?.items)?.some(
      (item) => duplicateIdentity(item) === duplicateIdentity(parsed.item!),
    );
  const save = useMutation({
    mutationFn: async (pending: NonNullable<WebCaptureDraft['frozen']>) => {
      if ('inbox' in pending) {
        const { entry } = await api.createInbox(pending.item, draft.operationId.current);
        return { id: entry.id, listId: null };
      }
      const { items } = await api.importItems(pending.listId, [pending.item], draft.operationId.current);
      return { id: items[0].id, listId: pending.listId };
    },
    onSuccess: (result, pending) => {
      const next = { ...emptyWebCapture, listId: result.listId ?? 'inbox' };
      draft.clear(next);
      draft.setForm(next);
      draft.operationId.current = crypto.randomUUID();
      setSaved(result);
      setStatus(`“${pending.item.title}” saved.`);
      setError('');
      for (const key of [
        ['inbox'],
        ['search'],
        ['items', result.listId],
        ['list', result.listId],
        ['lists'],
        ['overview'],
        ['patterns'],
      ])
        void client.invalidateQueries({ queryKey: key });
    },
  });
  function edit(patch: Partial<WebCaptureDraft>) {
    draft.setForm({ ...form, ...patch, review: false, approvedDuplicate: false });
    setError('');
    setStatus('');
    save.reset();
    setSaved(null);
  }
  function applyIncoming() {
    if (!share.incoming) return;
    const value = share.incoming;
    draft.checkpoint({ ...emptyWebCapture, title: value.title, note: value.text, sourceUrl: value.url });
    share.dismiss();
    setReplace(false);
    setError('');
    setStatus(
      'Incoming share copied into this draft. Review it, then keep it in Unfiled or choose a collection.',
    );
  }
  function confirmSave() {
    if (!frozen && (!destinationReady || !parsed.item || (duplicate && !form.approvedDuplicate))) return;
    const pending =
      frozen ??
      (toInbox ? { inbox: true as const, item: parsed.item! } : { listId: form.listId, item: parsed.item! });
    draft.checkpoint({ ...form, frozen: pending, review: true });
    save.mutate(pending);
  }
  const locked = !!frozen || save.isPending;
  return (
    <main className="light-page page-width web-capture-page">
      <header className="page-head">
        <div>
          <p className="overline">CAPTURE</p>
          <h1>Keep a name.</h1>
          <p>A name is enough. Keep it in Unfiled now, or choose a collection before saving.</p>
        </div>
      </header>
      <p>Saving as {owner?.email || owner?.displayName || 'your signed-in account'}.</p>
      {!online && (
        <p className="error-banner" role="status">
          You’re offline. This draft can stay on this device; saving needs a connection.
        </p>
      )}
      {share.storageFailed && (
        <p role="alert">
          Incoming content couldn’t be kept in this tab’s storage. Keep this page open until you use or copy
          it.
        </p>
      )}
      {share.error && (
        <p className="form-error" role="alert">
          {share.error}
        </p>
      )}
      {share.incoming && (
        <section className="incoming-capture" aria-label="Incoming share">
          <h2>Incoming share</h2>
          <IncomingPreview value={share.incoming} />
          <div className="data-actions">
            <button
              className="button button-outline"
              disabled={locked}
              onClick={() => {
                if (form.title || form.sourceUrl || form.note || form.type || (form.listId && !toInbox))
                  setReplace(true);
                else applyIncoming();
              }}
            >
              Use incoming share
            </button>
            <button className="button button-outline" onClick={share.dismiss}>
              Dismiss incoming share
            </button>
          </div>
        </section>
      )}
      {lists.isError && (
        <p role="alert">
          {lists.error.message}{' '}
          <button className="button button-outline" onClick={() => void lists.refetch()}>
            Retry collections
          </button>
        </p>
      )}
      {lists.isPending && <p role="status">Loading collections…</p>}
      {lists.data && !collections.length && (
        <p>
          <Link to="/lists?kind=collection&create=1">Create a collection</Link> when you’re ready to file. You
          can save to Unfiled first.
        </p>
      )}
      <section className={`capture-panel${form.review ? ' has-review' : ''}`} aria-label="Web capture draft">
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!destinationReady || !parsed.item) {
              setError(parsed.error || 'Choose a collection.');
              return;
            }
            draft.setForm({ ...form, review: true });
            setError('');
          }}
        >
          <label>
            Destination
            <select
              value={form.listId}
              disabled={locked}
              onChange={(event) => edit({ listId: event.target.value })}
            >
              <option value="">Choose a destination</option>
              <option value="inbox">Unfiled — file later</option>
              {collections.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
          {form.listId && lists.data && !destinationReady && (
            <p role="alert">This destination is unavailable. Choose a current collection before saving.</p>
          )}
          <label>
            Name
            <input
              ref={nameRef}
              value={form.title}
              maxLength={1000}
              disabled={locked}
              onChange={(event) => edit({ title: event.target.value })}
              placeholder="Something worth keeping"
            />
          </label>
          <p className="muted">Up to 120 characters. Shared names remain editable.</p>
          <details className="record-extras">
            <summary>
              Source, note and type <span className="optional">optional</span>
            </summary>
            <label>
              Source link
              <input
                type="text"
                inputMode="url"
                value={form.sourceUrl}
                maxLength={4000}
                disabled={locked}
                onChange={(event) => edit({ sourceUrl: event.target.value })}
                placeholder="https://…"
              />
            </label>
            <p>Up to 1,000 characters. Worth does not open this link to extract a name or content.</p>
            <button
              type="button"
              className="button button-outline"
              disabled={locked || !form.sourceUrl}
              onClick={() => {
                try {
                  edit({ title: suggestLink(form.sourceUrl).title });
                } catch {
                  setError('Use a complete http or https source link without login credentials.');
                }
              }}
            >
              Suggest name from address
            </button>
            <label>
              Type
              <input
                value={form.type}
                maxLength={60}
                disabled={locked}
                onChange={(event) => edit({ type: event.target.value })}
                placeholder="Coffee, book, place…"
              />
            </label>
            <label>
              Private note
              <textarea
                value={form.note}
                maxLength={16000}
                disabled={locked}
                rows={4}
                onChange={(event) => edit({ note: event.target.value })}
              />
            </label>
            <p>Up to 4,000 characters. Shared text is included only if you keep it here.</p>
          </details>
          <label className="workbench-check capture-check">
            <input
              type="checkbox"
              checked={form.wantToTry}
              disabled={locked}
              onChange={(event) => edit({ wantToTry: event.target.checked })}
            />
            Want to try
          </label>
          {!frozen && !form.review && (
            <button
              className="button button-accent"
              disabled={!destinationReady || !form.title.trim()}
              type="submit"
            >
              Review capture
            </button>
          )}
        </form>
        {toInbox && inbox.isError && (
          <p role="alert">
            {inbox.error.message}{' '}
            <button className="button button-outline" onClick={() => void inbox.refetch()}>
              Retry Unfiled duplicate check
            </button>
          </p>
        )}
        {!toInbox && items.isError && (
          <p role="alert">
            {items.error.message}{' '}
            <button className="button button-outline" onClick={() => void items.refetch()}>
              Retry duplicate check
            </button>
          </p>
        )}
        {form.review && reviewedItem && (
          <section className="capture-review" aria-label="Capture review" ref={reviewRef} tabIndex={-1}>
            <p className="overline">REVIEW BEFORE SAVING</p>
            <h2>{reviewedItem.title}</h2>
            <p>
              Destination: {toInbox ? 'Unfiled / unfiled' : chosen?.name || 'Unavailable collection'} ·
              Unranked · No call
            </p>
            <dl className="incoming-preview">
              <dt>Type</dt>
              <dd>{reviewedItem.type || 'None'}</dd>
              <dt>Source</dt>
              <dd>{reviewedItem.context.sourceUrl || 'None'}</dd>
              <dt>Private note</dt>
              <dd>{reviewedItem.note || 'None'}</dd>
              <dt>Want to try</dt>
              <dd>{reviewedItem.wantToTry ? 'Yes' : 'No'}</dd>
            </dl>
            {duplicate && !frozen && (
              <label className="capture-check">
                <input
                  type="checkbox"
                  checked={form.approvedDuplicate}
                  onChange={(event) => draft.setForm({ ...form, approvedDuplicate: event.target.checked })}
                />
                A record with this name and type already exists. Keep a separate record.
              </label>
            )}
            {frozen && (
              <p>
                This request is held for a safe retry. Its destination and contents stay fixed until confirmed
                or discarded.
              </p>
            )}
            <div className="data-actions">
              <button
                className="button button-accent"
                disabled={
                  save.isPending ||
                  !online ||
                  !destinationReady ||
                  (toInbox ? inbox.isPending || inbox.isError : items.isPending || items.isError) ||
                  (!frozen && duplicate && !form.approvedDuplicate)
                }
                onClick={confirmSave}
              >
                {frozen ? 'Retry same capture' : 'Save reviewed capture'}
              </button>
              {!frozen && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    draft.setForm({ ...form, review: false });
                    nameRef.current?.focus();
                  }}
                >
                  Back to draft
                </button>
              )}
            </div>
          </section>
        )}
        {draft.status && (
          <p className="draft-status" role="status">
            {draft.status}
          </p>
        )}
        {(error || save.isError) && (
          <p className="form-error" role="alert">
            {error || save.error?.message}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {saved && (
          <p>
            <Link
              to={saved.listId ? `/lists/${saved.listId}?focus=item:${saved.id}` : `/inbox?focus=${saved.id}`}
            >
              {saved.listId ? 'Open saved record →' : 'Open Unfiled find →'}
            </Link>
          </p>
        )}
        <button className="button button-outline" disabled={save.isPending} onClick={() => setReset(true)}>
          Clear capture draft
        </button>
      </section>
      <nav className="capture-tools" aria-label="Other ways to capture">
        <Link to="/receipts">Review a receipt and choose its record links →</Link>
        <Link to="/read">Read text from a photo on this device →</Link>
        <Link to="/code">Read a barcode or look up an ISBN →</Link>
      </nav>
      <details className="browser-capture-help">
        <summary>Capture from your browser</summary>
        <p>
          On supported browsers, installing Worth makes it available in the Share menu for text and links.
          Otherwise, open this page and paste a name or source link. Photos and other files are not accepted
          here.
        </p>
        <p>
          On desktop you can create a bookmark named “Save to Worth”, then replace its address with the code
          below. Clicking it on a page opens a review draft with that page’s title, address and selected text.
          Some browsers or pages block bookmarklets; manual paste always works.
        </p>
        <label>
          Browser capture bookmark code
          <textarea
            rows={4}
            readOnly
            value={captureBookmarklet(location.origin)}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <button
          className="button button-outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(captureBookmarklet(location.origin));
              setBookmarkCopied(true);
            } catch {
              setError('Select and copy the bookmark code manually.');
            }
          }}
        >
          Copy bookmark code
        </button>
        {bookmarkCopied && <p role="status">Bookmark code copied.</p>}
        <p>
          <Link to="/quick">Open shortlist and saved-find shortcuts →</Link>
        </p>
      </details>
      {replace && (
        <ConfirmDialog
          title="Replace this capture draft?"
          description="Copies the incoming name, source and text into this draft. The destination resets to Unfiled. Nothing is saved yet."
          confirmLabel="Use incoming share"
          onConfirm={applyIncoming}
          onClose={() => setReplace(false)}
        />
      )}
      {reset && (
        <ConfirmDialog
          title="Clear this capture draft?"
          description="Removes this device’s draft. An unconfirmed request may already have saved; check Unfiled and your collections before starting again."
          confirmLabel="Clear draft"
          onClose={() => setReset(false)}
          onConfirm={() => {
            draft.clear(emptyWebCapture);
            draft.setForm(emptyWebCapture);
            draft.operationId.current = crypto.randomUUID();
            save.reset();
            setReset(false);
            setError('');
            setStatus('Draft cleared.');
          }}
        />
      )}
    </main>
  );
}
