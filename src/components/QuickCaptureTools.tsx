import { useEffect, useRef, useState } from 'react';
import { Barcode, Image, LinkSimple, X } from '@phosphor-icons/react';
import { usePhotoText } from '../hooks/usePhotoText';
import { useBarcode } from '../hooks/useBarcode';
import { lookupBook } from '../shared/book-lookup';
import { bookDetails, captureCode, type BookSuggestion } from '../shared/code-capture';
import { suggestLink } from '../shared/reviewed-capture';
import type { CaptureSuggestion } from '../shared/capture-assist';
import { emptyCaptureSource, type CaptureSourceDraft } from '../shared/quick-entry';

type Mode = 'link' | 'photo' | 'code';

export function QuickCaptureTools({
  title,
  disabled,
  onApply,
  onBusyChange,
  source = emptyCaptureSource,
  onSourceChange,
}: {
  title: string;
  disabled: boolean;
  onApply: (suggestion: CaptureSuggestion) => boolean;
  onBusyChange: (busy: boolean) => void;
  source?: CaptureSourceDraft;
  onSourceChange: (patch: Partial<CaptureSourceDraft>) => void;
}) {
  const { mode, link, text, code, book, bookTitle } = source;
  const setMode = (mode: Mode | null) => onSourceChange({ mode });
  const setLink = (link: string) => onSourceChange({ link });
  const setText = (text: string) => onSourceChange({ text });
  const setCode = (code: string) => onSourceChange({ code });
  const setBook = (book: BookSuggestion | null) => onSourceChange({ book });
  const setBookTitle = (bookTitle: string) => onSourceChange({ bookTitle });
  const [lineLimit, setLineLimit] = useState(6);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [looking, setLooking] = useState(false);
  const [lookupStatus, setLookupStatus] = useState('');
  const [error, setError] = useState('');
  const lookup = useRef<AbortController | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef<Partial<Record<Mode, HTMLButtonElement | null>>>({});
  const textReader = usePhotoText((value) => {
    setText(value.slice(0, 16000));
    setLineLimit(6);
  });
  const barcodeReader = useBarcode((value) => {
    setCode(value);
    setBook(null);
    setLookupStatus('');
  });
  const busy = textReader.busy || barcodeReader.busy || looking;
  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);
  useEffect(
    () => () => {
      lookup.current?.abort();
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function cancelLookup() {
    lookup.current?.abort();
    lookup.current = null;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = null;
    setLooking(false);
  }
  function close() {
    textReader.reset();
    barcodeReader.reset();
    cancelLookup();
    const previous = mode;
    setMode(null);
    setError('');
    if (previous) requestAnimationFrame(() => triggers.current[previous]?.focus());
  }
  function apply(suggestion: CaptureSuggestion) {
    if (onApply(suggestion)) {
      close();
      onSourceChange(emptyCaptureSource);
    }
  }
  async function findBook() {
    cancelLookup();
    const controller = new AbortController();
    lookup.current = controller;
    lookupTimer.current = setTimeout(() => controller.abort(), 18000);
    setLooking(true);
    setError('');
    setLookupStatus('');
    setBook(null);
    try {
      const result = await lookupBook(code, controller.signal);
      if (lookup.current !== controller) return;
      setBook(result);
      setBookTitle(result?.title ?? '');
      setLookupStatus(
        result
          ? 'Book found. Check its details before using them.'
          : 'No book found for this ISBN. You can still keep the code with a name.',
      );
    } catch (cause) {
      if (lookup.current === controller)
        setError(
          controller.signal.aborted
            ? 'Book lookup timed out. Try again or enter a name.'
            : cause instanceof Error
              ? cause.message
              : 'Book lookup is unavailable.',
        );
    } finally {
      if (lookup.current === controller) {
        if (lookupTimer.current) clearTimeout(lookupTimer.current);
        lookupTimer.current = null;
        lookup.current = null;
        setLooking(false);
      }
    }
  }
  let parsedCode: ReturnType<typeof captureCode> | null = null;
  try {
    parsedCode = captureCode(code);
  } catch {
    /* Partial digits stay editable. */
  }
  let linked: ReturnType<typeof suggestLink> | null = null;
  try {
    linked = suggestLink(link);
  } catch {
    /* Validate when Use link is chosen. */
  }
  const lines = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && line.length <= 120),
    ),
  ];
  const supported =
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof createImageBitmap !== 'undefined';
  return (
    <div className="quick-capture-tools">
      <div className="quick-capture-methods" role="group" aria-label="Other ways to add">
        {(
          [
            ['link', 'Paste link', LinkSimple],
            ['photo', 'Photo text', Image],
            ['code', 'Barcode', Barcode],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            ref={(node) => {
              triggers.current[value] = node;
            }}
            key={value}
            type="button"
            disabled={disabled}
            aria-expanded={mode === value}
            onClick={() => {
              if (mode === value) close();
              else {
                textReader.reset();
                barcodeReader.reset();
                cancelLookup();
                setError('');
                setMode(value);
              }
            }}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      {mode && (
        <section
          className="quick-capture-panel"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
          }}
          aria-label={
            mode === 'link' ? 'Add from a link' : mode === 'photo' ? 'Read photo text' : 'Read a barcode'
          }
        >
          <div className="quick-capture-panel-head">
            <strong>
              {mode === 'link'
                ? 'Keep the link. Skip some typing.'
                : mode === 'photo'
                  ? 'Let the photo do some typing.'
                  : 'Start with the code.'}
            </strong>
            <button type="button" className="icon-button" aria-label="Close capture tools" onClick={close}>
              <X size={18} />
            </button>
          </div>
          {mode === 'link' && (
            <>
              <label>
                Link
                <input
                  autoFocus
                  type="url"
                  maxLength={1000}
                  value={link}
                  disabled={disabled}
                  placeholder="https://…"
                  onChange={(event) => {
                    setLink(event.target.value);
                    setError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (linked) apply(linked);
                    }
                  }}
                />
              </label>
              {linked && (
                <p className="quick-entry-helper">
                  Suggested name: <strong>{linked.title}</strong>
                </p>
              )}
              <p className="quick-entry-helper">
                Uses the address to suggest a name and saves the source link. Check the name before saving.
              </p>
              <button
                type="button"
                className="button button-outline"
                disabled={disabled || !link.trim()}
                onClick={() => {
                  try {
                    apply(suggestLink(link));
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Check the link.');
                  }
                }}
              >
                Use link
              </button>
            </>
          )}
          {mode === 'photo' && (
            <>
              <p className="quick-entry-helper">
                Read printed English text on this device, then choose a name. This photo is not attached to
                the item.
              </p>
              <label className="button button-outline quick-capture-file">
                Choose photo to read
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled || busy || !supported}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      setPhoto(file);
                      setText('');
                      void textReader.read(file);
                    }
                  }}
                />
              </label>
              {!supported && (
                <p className="quick-entry-helper">
                  Photo reading is unavailable here. Paste text below or type a name above.
                </p>
              )}
              {preview && <img className="quick-capture-image" src={preview} alt="Photo used to read text" />}
              {textReader.busy && (
                <>
                  <progress
                    aria-label="Text reading progress"
                    max={1}
                    value={textReader.progress ?? undefined}
                  />
                  <button type="button" onClick={textReader.stop}>
                    Stop reading
                  </button>
                </>
              )}
              {textReader.status && (
                <p role="status" className="quick-entry-helper">
                  {textReader.status}
                </p>
              )}
              {textReader.error && (
                <p role="alert" className="form-error">
                  {textReader.error}
                </p>
              )}
              <label>
                Read or pasted text
                <textarea
                  rows={3}
                  maxLength={16000}
                  value={text}
                  disabled={disabled || busy}
                  placeholder="You can paste text here, too."
                  onChange={(event) => {
                    setText(event.target.value);
                    setLineLimit(6);
                  }}
                />
              </label>
              {!!lines.length && (
                <div className="quick-capture-lines" role="group" aria-label="Choose a name from the text">
                  {lines.slice(0, lineLimit).map((line) => (
                    <button
                      type="button"
                      key={line}
                      disabled={disabled || busy}
                      onClick={() => apply({ title: line })}
                    >
                      Use {line}
                    </button>
                  ))}
                  {lines.length > lineLimit && (
                    <button type="button" onClick={() => setLineLimit((value) => value + 10)}>
                      More lines
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {mode === 'code' && (
            <>
              <p className="quick-entry-helper">
                Read a barcode on this device, or type its digits. An ISBN can also suggest book details.
              </p>
              <label className="button button-outline quick-capture-file">
                Choose barcode photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={disabled || busy || !supported}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      setBook(null);
                      setLookupStatus('');
                      void barcodeReader.read(file);
                    }
                  }}
                />
              </label>
              <label>
                Barcode or ISBN
                <input
                  autoFocus
                  maxLength={80}
                  value={code}
                  disabled={disabled || busy}
                  onChange={(event) => {
                    cancelLookup();
                    setCode(event.target.value);
                    setBook(null);
                    setLookupStatus('');
                    setError('');
                  }}
                />
              </label>
              {barcodeReader.busy && (
                <button type="button" onClick={barcodeReader.stop}>
                  Stop reading
                </button>
              )}
              {barcodeReader.status && (
                <p role="status" className="quick-entry-helper">
                  {barcodeReader.status}
                </p>
              )}
              {barcodeReader.error && (
                <p role="alert" className="form-error">
                  {barcodeReader.error}
                </p>
              )}
              {parsedCode?.isbn && (
                <>
                  <p className="quick-entry-helper">Look up sends only this ISBN to Open Library.</p>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={disabled || busy}
                    onClick={() => void findBook()}
                  >
                    {looking ? 'Looking up…' : 'Look up book'}
                  </button>
                </>
              )}
              {lookupStatus && (
                <p role="status" className="quick-entry-helper">
                  {lookupStatus}
                </p>
              )}
              {book && (
                <div className="quick-capture-book">
                  <label>
                    Suggested book name
                    <input
                      maxLength={120}
                      value={bookTitle}
                      onChange={(event) => setBookTitle(event.target.value)}
                    />
                  </label>
                  <p>{bookDetails(book)}</p>
                  {bookTitle.length > 120 && (
                    <p className="form-error">Shorten the name to 120 characters.</p>
                  )}
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={disabled || busy || !bookTitle.trim() || bookTitle.length > 120}
                    onClick={() =>
                      apply({ title: bookTitle, code: book.code, type: 'Book', note: bookDetails(book) })
                    }
                  >
                    Use book details
                  </button>
                  <p className="quick-entry-helper">
                    Fills the name and code, suggests Book as the type, and adds the supplied details to your
                    note.
                  </p>
                </div>
              )}
              {!book && (
                <>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={disabled || busy || !parsedCode || !title.trim()}
                    onClick={() => {
                      if (parsedCode) apply({ title, code: parsedCode.code });
                    }}
                  >
                    Use barcode with this name
                  </button>
                  {!title.trim() && (
                    <p className="quick-entry-helper">Add a name above, or look up an ISBN first.</p>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
