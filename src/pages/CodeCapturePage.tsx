import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAccountId } from '../hooks/useAccountId';
import { useBarcode } from '../hooks/useBarcode';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import { lookupBook } from '../shared/book-lookup';
import {
  bookDetails,
  captureCode,
  codeCaptureDraft,
  emptyCodeCapture,
  type CodeCaptureDraft,
} from '../shared/code-capture';
import { stageIncomingCapture } from '../shared/incoming-capture';
import { checkTextPhoto } from '../shared/photo-text';
import '../photo-text.css';
import '../code-capture.css';

export function CodeCapturePage() {
  usePageTitle('Read a code');
  const owner = useAccountId(),
    online = useConnection(),
    navigate = useNavigate();
  const draft = useDraft<CodeCaptureDraft>(
    'code-capture',
    emptyCodeCapture,
    (value): value is CodeCaptureDraft => codeCaptureDraft.safeParse(value).success,
  );
  const form = draft.form;
  const [photo, setPhoto] = useState<File | null>(null),
    [preview, setPreview] = useState('');
  const [checking, setChecking] = useState(false),
    [looking, setLooking] = useState(false);
  const [notesOpen, setNotesOpen] = useState(Boolean(form.note));
  const [lookupOpen, setLookupOpen] = useState(Boolean(form.suggestion));
  const [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'read' | 'title' | 'note' | 'clear' | null>(null);
  const lookup = useRef<AbortController | null>(null),
    generation = useRef(0),
    live = useRef(true);
  const abortLookup = useCallback(() => {
    generation.current++;
    lookup.current?.abort();
    lookup.current = null;
  }, []);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      abortLookup();
    };
  }, [abortLookup]);
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const reader = useBarcode((code) => {
    draft.setForm({ ...form, code, suggestion: null, keepSource: false });
    setNotice('Check the code, name and note. Book lookup is a separate, optional action.');
  });
  const busy = checking || looking || reader.busy;
  const supported =
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined';
  let parsed: ReturnType<typeof captureCode> | null = null,
    codeError = '';
  if (form.code.trim()) {
    try {
      parsed = captureCode(form.code);
    } catch (cause) {
      codeError = (cause as Error).message;
    }
  }
  const book = form.suggestion?.code === parsed?.code ? form.suggestion : null;
  const keptNote = [
    form.keepCode && parsed ? `${parsed.isbn ? 'ISBN' : 'Barcode'}: ${parsed.code}` : '',
    form.note,
  ]
    .filter(Boolean)
    .join('\n\n');
  const source = book && form.keepSource ? `https://openlibrary.org/isbn/${book.code}` : '';
  const valid =
    !!form.title.trim() && (!form.keepCode || !form.code.trim() || !!parsed) && keptNote.length <= 4000;
  async function choose(file?: File) {
    if (!file) return;
    setChecking(true);
    setError('');
    try {
      await checkTextPhoto(file);
      if (live.current) {
        reader.reset();
        setPhoto(file);
      }
    } catch (cause) {
      if (live.current) setError((cause as Error).message);
    } finally {
      if (live.current) setChecking(false);
    }
  }
  function cancelLookup() {
    abortLookup();
    setLooking(false);
  }
  async function findBook() {
    if (!parsed?.isbn || busy) return;
    const current = ++generation.current,
      controller = new AbortController();
    lookup.current?.abort();
    lookup.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLooking(true);
    setLookupOpen(true);
    setError('');
    setNotice('');
    try {
      const suggestion = await lookupBook(parsed.code, controller.signal);
      if (!live.current || current !== generation.current) return;
      draft.setForm({ ...form, suggestion, keepSource: false });
      setNotice(
        suggestion
          ? 'Book details found. Check the edition before copying anything.'
          : 'No book found for this ISBN. You can keep the code and name it yourself.',
      );
    } catch (cause) {
      if (live.current && current === generation.current)
        setError(
          controller.signal.aborted
            ? 'Book lookup took too long. Try again, or enter the name manually.'
            : (cause as Error).message,
        );
    } finally {
      clearTimeout(timeout);
      if (live.current && current === generation.current) {
        lookup.current = null;
        setLooking(false);
      }
    }
  }
  function copyTitle() {
    if (!book) return;
    draft.setForm({ ...form, title: book.title.slice(0, 120) });
    setNotice(
      book.title.length > 120
        ? 'The name was shortened to 120 characters. Edit it before keeping.'
        : 'Title copied to your draft. Check it before keeping.',
    );
    setConfirm(null);
  }
  function copyDetails() {
    if (!book) return;
    draft.setForm({ ...form, note: bookDetails(book) });
    setNotesOpen(true);
    setConfirm(null);
  }
  return (
    <main className="light-page page-width photo-text-page code-capture-page">
      <header className="page-head">
        <div>
          <p className="overline">BARCODES & BOOKS</p>
          <h1>Read a code.</h1>
          <p>Small lines. Useful clues.</p>
        </div>
        <Link to="/capture">Back to capture →</Link>
      </header>
      <p className="photo-text-intro">
        Read a product barcode from a photo on this device, or type the digits. An optional ISBN lookup can
        suggest a book title. You check what to keep.
      </p>
      <div className="photo-text-layout">
        <section className="photo-text-source" aria-labelledby="code-source-title">
          <p className="overline">01 / CODE</p>
          <h2 id="code-source-title">Start with the digits.</h2>
          <p>
            Photos support EAN-8, EAN-13 and UPC-A barcodes. ISBN-10 and ISBN-13 can also be typed or pasted.
            QR codes and general product lookup are not supported.
          </p>
          <label className="button button-outline file-choice">
            Choose barcode photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void choose(file);
              }}
            />
          </label>
          {preview ? (
            <figure>
              <img src={preview} alt="Selected barcode photo" />
              <figcaption>{photo?.name}</figcaption>
            </figure>
          ) : (
            <svg className="code-paper" aria-hidden="true" viewBox="0 0 120 90">
              <path d="M20 9h67l15 15v54H20z" fill="#eae5d5" />
              <path d="M87 9v15h15" fill="#c9c6b4" />
              <path
                d="M33 34v28m7-28v28m10-28v28m5-28v28m12-28v28m6-28v28m10-28v28m5-28v28"
                stroke="#38392f"
                strokeWidth="3"
              />
              <path d="M33 69h36" stroke="#737566" strokeWidth="2" />
            </svg>
          )}
          <p className="muted">
            JPEG, PNG or WebP, up to 10 MB and 20 megapixels. The photo stays in this page and is discarded
            when you leave; it is not uploaded or attached.
          </p>
          {!supported && (
            <p role="status">
              Barcode reading is unavailable in this browser. Type or paste the digits below.
            </p>
          )}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!photo || busy || !supported}
              onClick={() => {
                if (form.code.trim()) setConfirm('read');
                else if (photo) void reader.read(photo);
              }}
            >
              Read barcode on this device
            </button>
            {reader.busy && (
              <button className="button button-outline" onClick={reader.stop}>
                Stop reading
              </button>
            )}
            {photo && (
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => {
                  setPhoto(null);
                  reader.reset();
                }}
              >
                Remove photo
              </button>
            )}
          </div>
          {reader.status && <p role="status">{reader.status}</p>}
          {reader.error && (
            <p role="alert" className="form-error">
              {reader.error}
            </p>
          )}
          <label>
            Barcode or ISBN
            <input
              value={form.code}
              maxLength={80}
              disabled={busy}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                cancelLookup();
                draft.setForm({ ...form, code: event.target.value, suggestion: null, keepSource: false });
                setError('');
                setNotice(
                  form.title || form.note
                    ? 'Code changed. Check your earlier name and note before keeping.'
                    : '',
                );
              }}
            />
          </label>
          {codeError && <p className="form-error">{codeError}</p>}
          {parsed && (
            <p>
              {parsed.isbn ? 'ISBN' : 'Product barcode'} · Check digit matches. Confirm the printed digits
              too.
            </p>
          )}
          <details
            className="record-extras code-lookup-help"
            open={lookupOpen}
            onToggle={(event) => setLookupOpen(event.currentTarget.open)}
          >
            <summary>
              Book lookup <span className="optional">optional</span>
            </summary>
            <p>
              Looking up a book sends only this ISBN from your browser to Open Library, which also receives
              your IP address. No photo, notes or account credentials are sent. This is a free metadata
              lookup, with no AI provider.
            </p>
            <button
              className="button button-outline"
              disabled={!parsed?.isbn || busy || !online}
              onClick={() => void findBook()}
            >
              Look up ISBN with Open Library
            </button>
            {!online && <p>Book lookup needs a connection. You can still type a name.</p>}
            {parsed && !parsed.isbn && <p>Book lookup needs an ISBN. Name other products yourself.</p>}
            {looking && (
              <p role="status">
                Looking up this ISBN…{' '}
                <button
                  className="button button-outline"
                  onClick={() => {
                    cancelLookup();
                    setNotice('Book lookup stopped. Your draft stays here.');
                  }}
                >
                  Stop lookup
                </button>
              </p>
            )}
          </details>
          {book && (
            <section className="code-book-result" aria-labelledby="code-book-title">
              <p className="overline">OPEN LIBRARY / CHECK THE EDITION</p>
              <h3 id="code-book-title">{book.title}</h3>
              <dl className="code-metadata">
                <dt>Author</dt>
                <dd>{book.authors.join(', ') || 'Not supplied'}</dd>
                <dt>Publisher</dt>
                <dd>{book.publishers.join(', ') || 'Not supplied'}</dd>
                <dt>Published</dt>
                <dd>{book.published || 'Not supplied'}</dd>
              </dl>
              <div className="data-actions">
                <button
                  className="button button-outline"
                  disabled={busy}
                  onClick={() => {
                    if (form.title && form.title !== book.title.slice(0, 120)) setConfirm('title');
                    else copyTitle();
                  }}
                >
                  Use this title
                </button>
                {bookDetails(book) && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => {
                      if (form.note && form.note !== bookDetails(book)) setConfirm('note');
                      else copyDetails();
                    }}
                  >
                    Use book details as note
                  </button>
                )}
              </div>
            </section>
          )}
          {checking && <p role="status">Checking this photo…</p>}
          {notice && <p role="status">{notice}</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </section>
        <section className="photo-text-review" aria-labelledby="code-review-title">
          <p className="overline">02 / REVIEW</p>
          <h2 id="code-review-title">A name you recognize.</h2>
          <p>
            No name, opinion or ranking is inferred from a code. Type a name or explicitly copy a suggested
            book title.
          </p>
          <label>
            Name to keep
            <input
              value={form.title}
              maxLength={120}
              disabled={busy}
              onChange={(event) => draft.setForm({ ...form, title: event.target.value })}
              placeholder="Something worth remembering"
            />
          </label>
          <details
            className="record-extras photo-text-note"
            open={notesOpen}
            onToggle={(event) => setNotesOpen(event.currentTarget.open)}
          >
            <summary>
              Private note <span className="optional">optional</span>
            </summary>
            <label>
              Private note to keep
              <textarea
                rows={4}
                value={form.note}
                maxLength={4000}
                disabled={busy}
                onChange={(event) => draft.setForm({ ...form, note: event.target.value })}
              />
            </label>
          </details>
          <label className="code-option">
            <input
              type="checkbox"
              checked={form.keepCode}
              disabled={busy}
              onChange={(event) => draft.setForm({ ...form, keepCode: event.target.checked })}
            />
            Keep the code in the private note
          </label>
          {book && (
            <label className="code-option">
              <input
                type="checkbox"
                checked={form.keepSource}
                disabled={busy}
                onChange={(event) => draft.setForm({ ...form, keepSource: event.target.checked })}
              />
              Keep the Open Library source link
            </label>
          )}
          <div className="code-kept-preview">
            <h3>What goes to capture</h3>
            <dl className="code-metadata">
              <dt>Private note</dt>
              <dd>{keptNote || 'None'}</dd>
              <dt>Source link</dt>
              <dd>{source || 'None'}</dd>
            </dl>
          </div>
          {form.keepCode && codeError && (
            <p>Correct the code, or uncheck Keep the code to continue with just your name and note.</p>
          )}
          {keptNote.length > 4000 && (
            <p role="alert">
              The combined note is too long. Shorten it or uncheck Keep the code. Notes hold 4,000 characters.
            </p>
          )}
          <p>
            Next, review this name, note and source in capture and choose Inbox or a collection. Nothing is
            saved here.
          </p>
          <button
            className="button button-accent"
            disabled={busy || !valid || !owner}
            onClick={() => {
              if (!valid || !owner) return;
              stageIncomingCapture({ title: form.title.trim(), text: keptNote, url: source }, owner);
              navigate('/capture');
            }}
          >
            Review this capture →
          </button>
          {draft.status && (
            <p role="status" className="draft-status">
              {draft.status}
            </p>
          )}
        </section>
      </div>
      <button className="button button-outline" disabled={busy} onClick={() => setConfirm('clear')}>
        Clear code draft
      </button>
      {confirm === 'read' && (
        <ConfirmDialog
          title="Replace this code?"
          description="Reads the selected photo and replaces the code if found. Your name and note stay as they are; earlier book suggestions are cleared."
          confirmLabel="Read barcode again"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            if (photo) void reader.read(photo);
          }}
        />
      )}
      {confirm === 'title' && (
        <ConfirmDialog
          title="Replace this name?"
          description="Copies the suggested book title over the name in your draft. Check the edition before keeping it."
          confirmLabel="Use this title"
          onClose={() => setConfirm(null)}
          onConfirm={copyTitle}
        />
      )}
      {confirm === 'note' && (
        <ConfirmDialog
          title="Replace this private note?"
          description="Copies the supplied author, publisher and publication text over your note. Nothing is saved yet."
          confirmLabel="Use book details as note"
          onClose={() => setConfirm(null)}
          onConfirm={copyDetails}
        />
      )}
      {confirm === 'clear' && (
        <ConfirmDialog
          title="Clear this code draft?"
          description="Removes this device’s code, name, note and book suggestion, plus this page’s photo. Saved records and drafts already sent to capture stay as they are."
          confirmLabel="Clear draft"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            cancelLookup();
            reader.reset();
            setPhoto(null);
            draft.clear(emptyCodeCapture);
            draft.setForm(emptyCodeCapture);
            setNotesOpen(false);
            setLookupOpen(false);
            setError('');
            setNotice('');
            setConfirm(null);
          }}
        />
      )}
    </main>
  );
}
