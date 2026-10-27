import { BookletPreview } from './BookletPreview';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import { createPortal } from 'react-dom';
import { cleanOrder } from '../shared/workbench';
import '../publishing.css';
import { useDraft } from '../hooks/useDraft';
import { bookletEntries, type BookletData, type RecommendationCard } from '../shared/booklet';
import { prepareBooklet, renderRecommendationCard, saveLocalFile } from '../shared/booklet-export';
import type { Item, ListDetail } from '../shared/models';

const publishingDraft = z
  .object({
    mode: z.enum(['booklet', 'card']),
    title: z.string().max(120),
    dedication: z.string().max(280),
    ids: z.array(z.string().max(100)).max(12),
    captions: z.record(z.string(), z.string().max(300)).refine((value) => Object.keys(value).length <= 500),
    ranks: z.boolean(),
    calls: z.boolean(),
    notes: z.boolean(),
    photos: z.boolean(),
    cardId: z.string().max(100),
    message: z.string().max(500),
    recipient: z.string().max(80),
    cardCollection: z.boolean(),
  })
  .strict();
type PublishingDraft = z.infer<typeof publishingDraft>;
type Ready = { signature: string; file: File; html?: string; booklet?: BookletData };

export function CollectionPublishing({ list, items }: { list: ListDetail; items: Item[] }) {
  const draft = useDraft<PublishingDraft>(
    `publishing:${list.id}`,
    {
      mode: 'booklet',
      title: list.name,
      dedication: '',
      ids: [],
      captions: {},
      ranks: false,
      calls: false,
      notes: false,
      photos: false,
      cardId: '',
      message: '',
      recipient: '',
      cardCollection: false,
    },
    (value): value is PublishingDraft => publishingDraft.safeParse(value).success,
  );
  const { form, setForm } = draft;
  const cardDescription = useId();
  const [search, setSearch] = useState('');
  const [ready, setReady] = useState<Ready | null>(null);
  const [preview, setPreview] = useState<{ signature: string; url: string } | null>(null);
  const [printReady, setPrintReady] = useState('');
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  const sharingNow = useRef(false);
  const sequence = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready || ready.html) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(ready.file);
    setPreview({ signature: ready.signature, url });
    return () => URL.revokeObjectURL(url);
  }, [ready]);
  const selectedIds = cleanOrder(form.ids, items);
  const entries = bookletEntries(items, selectedIds, list.rankedIds, form, form.captions);
  const data: BookletData = { title: form.title.trim() || list.name, dedication: form.dedication, entries };
  const selectedCard = items.find((item) => item.id === form.cardId);
  const card: RecommendationCard | null = selectedCard
    ? {
        title: selectedCard.title,
        type: selectedCard.type,
        message: form.message,
        recipient: form.recipient,
        collection: form.cardCollection ? list.name : '',
        ...(form.photos && selectedCard.hasPhoto
          ? { photo: `/api/items/${encodeURIComponent(selectedCard.id)}/photo?v=${selectedCard.updatedAt}` }
          : {}),
      }
    : null;
  const signature = JSON.stringify(
    form.mode === 'booklet' ? { mode: form.mode, data } : { mode: form.mode, card },
  );
  const current = ready?.signature === signature ? ready : null;
  useEffect(() => {
    if (!current?.booklet) {
      setPrintReady('');
      return;
    }
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) setPrintReady(current.signature);
    });
    return () => {
      live = false;
    };
  }, [current]);
  const filtered = items.filter((item) =>
    `${item.title} ${item.type}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const filename = (title: string, extension: string) =>
    `worth-${
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64) || 'collection'
    }.${extension}`;
  async function prepare() {
    if (busy || (form.mode === 'booklet' ? !entries.length : !card)) return;
    const request = ++sequence.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setReady(null);
    setError('');
    setStatus('Preparing the previewed file…');
    try {
      const prepared =
        form.mode === 'booklet' ? await prepareBooklet(data, controller.current.signal) : undefined;
      const html = prepared?.html;
      const blob =
        html === undefined
          ? await renderRecommendationCard(card!, controller.current.signal)
          : new Blob([html], { type: 'text/html;charset=utf-8' });
      if (!active.current || request !== sequence.current) return;
      const file = new File(
        [blob],
        filename(html === undefined ? card!.title : data.title, html === undefined ? 'png' : 'html'),
        { type: html === undefined ? 'image/png' : 'text/html' },
      );
      setReady({ signature, file, html, booklet: prepared?.data });
      setPrintReady('');
      setStatus('File ready. Review it below before downloading or sharing.');
    } catch (failure) {
      if (active.current && request === sequence.current) {
        setError(failure instanceof Error ? failure.message : 'Could not prepare the file. Try again.');
        setStatus('');
      }
    } finally {
      if (active.current && request === sequence.current) setBusy(false);
    }
  }
  let canShare = false;
  try {
    canShare =
      !!current &&
      !current.html &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [current.file] });
  } catch {
    /* Downloads remain available when file sharing is unsupported. */
  }
  return (
    <section className="workbench-section publishing-tools" aria-label="Booklets and cards">
      <p>
        Make something to keep or share yourself. Files include only the fields in this preview; they cannot
        be revoked after you share a copy.
      </p>
      <fieldset className="publishing-kind" disabled={busy || sharing}>
        <legend>Make a file</legend>
        {(['booklet', 'card'] as const).map((mode) => (
          <label key={mode} className="workbench-check">
            <input
              type="radio"
              name={`publishing-${list.id}`}
              checked={form.mode === mode}
              onChange={() => setForm({ ...form, mode })}
            />
            {mode === 'booklet' ? 'Collection booklet' : 'Recommendation card'}
          </label>
        ))}
      </fieldset>
      <fieldset className="publishing-fields" disabled={busy || sharing}>
        <legend>{form.mode === 'booklet' ? 'Choose up to 12 records' : 'Choose one record'}</legend>
        <label>
          Find a record
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search names and types"
          />
        </label>
        <div className="publishing-selection">
          {filtered.slice(0, 100).map((item) => (
            <label key={item.id} className="workbench-check">
              <input
                type={form.mode === 'booklet' ? 'checkbox' : 'radio'}
                name={`publishing-record-${list.id}`}
                checked={form.mode === 'booklet' ? selectedIds.includes(item.id) : form.cardId === item.id}
                disabled={
                  form.mode === 'booklet' && selectedIds.length >= 12 && !selectedIds.includes(item.id)
                }
                onChange={(event) =>
                  setForm(
                    form.mode === 'booklet'
                      ? {
                          ...form,
                          ids: event.target.checked
                            ? [...selectedIds, item.id]
                            : selectedIds.filter((id) => id !== item.id),
                        }
                      : { ...form, cardId: item.id },
                  )
                }
              />
              {item.title}
            </label>
          ))}
        </div>
        {filtered.length > 100 && <p>Showing the first 100 matches. Search to narrow the selection.</p>}
        {form.mode === 'booklet' && (
          <>
            <p>{entries.length}/12 selected. Names and types are always included.</p>
            <label>
              Cover title
              <input
                value={form.title}
                maxLength={120}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label>
              Dedication
              <textarea
                value={form.dedication}
                maxLength={280}
                rows={2}
                onChange={(event) => setForm({ ...form, dedication: event.target.value })}
                placeholder="For rainy Sundays"
              />
            </label>
            {(
              [
                ['ranks', 'Include collection ranks'],
                ['calls', 'Include personal calls'],
                ['notes', 'Include private notes'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="workbench-check">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                />
                {label}
              </label>
            ))}
            {entries.map((entry) => (
              <label key={entry.id}>
                Caption for {entry.title}
                <textarea
                  maxLength={300}
                  value={form.captions[entry.id] ?? ''}
                  rows={2}
                  onChange={(event) =>
                    setForm({ ...form, captions: { ...form.captions, [entry.id]: event.target.value } })
                  }
                />
              </label>
            ))}
          </>
        )}
        {form.mode === 'card' && (
          <>
            <p>
              Cards include the chosen name/type and the message you write here. Private notes, calls, dates,
              history, purchase and loan details are excluded.
            </p>
            <label>
              Your reason or message
              <textarea
                rows={3}
                maxLength={500}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="The one I was telling you about."
              />
            </label>
            <label>
              For someone
              <input
                value={form.recipient}
                maxLength={80}
                onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                placeholder="Optional name"
              />
            </label>
            <label className="workbench-check">
              <input
                type="checkbox"
                checked={form.cardCollection}
                onChange={(event) => setForm({ ...form, cardCollection: event.target.checked })}
              />
              Include collection name
            </label>
          </>
        )}
        <label className="workbench-check">
          <input
            type="checkbox"
            checked={form.photos}
            onChange={(event) => setForm({ ...form, photos: event.target.checked })}
          />
          Include private photos
        </label>
      </fieldset>
      <p className="draft-state" role="status">
        {draft.status || 'Export drafts can recover on this device for seven days.'}
      </p>
      <div className="data-actions">
        <button
          className="button button-accent"
          disabled={busy || sharing || (form.mode === 'booklet' ? !entries.length : !card)}
          onClick={() => void prepare()}
        >
          {busy ? 'Preparing…' : form.mode === 'booklet' ? 'Prepare booklet' : 'Prepare card'}
        </button>
        <button
          className="button button-outline"
          disabled={!current || busy || sharing}
          onClick={() => {
            if (current) {
              saveLocalFile(current.file);
              setStatus('File downloaded.');
            }
          }}
        >
          Download {form.mode === 'booklet' ? 'booklet (.html)' : 'card (.png)'}
        </button>
        {current?.html && (
          <button
            className="button button-outline"
            disabled={busy || printReady !== signature}
            onClick={() => window.print()}
          >
            Print / save PDF
          </button>
        )}
        {canShare && (
          <button
            className="button button-outline"
            disabled={sharing || busy}
            onClick={async () => {
              if (!current || sharingNow.current) return;
              sharingNow.current = true;
              setSharing(true);
              setError('');
              try {
                await navigator.share({ files: [current.file] });
                if (active.current) setStatus('Card handed to the share sheet.');
              } catch (failure) {
                if (active.current && !(failure instanceof DOMException && failure.name === 'AbortError'))
                  setError('Could not open sharing. Try again or download the card.');
              } finally {
                sharingNow.current = false;
                if (active.current) setSharing(false);
              }
            }}
          >
            {sharing ? 'Opening share sheet…' : 'Share card'}
          </button>
        )}
      </div>
      {ready && !current && (
        <p role="status">The preview changed. Prepare a new file to include these changes.</p>
      )}
      {status && <p role="status">{status}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {form.mode === 'booklet' && (
        <>
          <p>
            Booklets download as a self-contained file. Open it in a browser to read, print or save as PDF.
            Fonts and selected photos are embedded.
          </p>
          <BookletPreview data={current?.booklet ?? data} />
        </>
      )}
      {form.mode === 'card' && card && (
        <div className="recommendation-preview" role="region" aria-label="Recommendation card preview">
          {current && preview?.signature === signature ? (
            <>
              <img
                src={preview.url}
                alt={`Prepared recommendation card: ${card.title}`}
                aria-describedby={cardDescription}
              />
              <p id={cardDescription} className="sr-only">
                {[
                  card.recipient ? `For ${card.recipient}` : '',
                  card.title,
                  card.type,
                  card.message,
                  card.collection ? `From ${card.collection}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </>
          ) : (
            <article className="booklet-paper">
              {card.recipient && <p className="publishing-eyebrow">For {card.recipient}</p>}
              <h3 className="booklet-title">{card.title}</h3>
              {card.type && <p>{card.type}</p>}
              {card.photo && <img src={card.photo} alt={`Selected photo for ${card.title}`} />}
              {card.message && <p className="publishing-caption">{card.message}</p>}
              {card.collection && <p>From {card.collection}</p>}
              <footer>worth</footer>
            </article>
          )}
        </div>
      )}
      {current?.booklet &&
        createPortal(
          <div className="booklet-print-root">
            <style>{'@page{size:A5;margin:12mm}'}</style>
            <BookletPreview data={current.booklet} print />
          </div>,
          document.body,
        )}
    </section>
  );
}
