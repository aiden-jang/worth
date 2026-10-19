import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, RequestError } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { usePhotoText } from '../hooks/usePhotoText';
import { useConnection } from '../hooks/useConnection';
import { usePageTitle } from '../hooks/usePageTitle';
import { checkTextPhoto } from '../shared/photo-text';
import { prepareReceiptCopy } from '../shared/receipt-photo';
import {
  emptyReceipt,
  receiptDraft,
  receiptPayload,
  receiptBody,
  receiptLineSuggestions,
  receiptDigest,
  type ReceiptDraft,
} from '../shared/receipts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ReceiptLineEditor } from '../components/ReceiptLineEditor';
import '../receipts.css';
export function ReceiptCapturePage() {
  usePageTitle('Review a receipt');
  const navigate = useNavigate(),
    client = useQueryClient(),
    online = useConnection();
  const draft = useDraft<ReceiptDraft>(
      'new-receipt',
      emptyReceipt(),
      (v): v is ReceiptDraft => receiptDraft.safeParse(v).success,
    ),
    source = useDraftPhoto('receipt-source'),
    prepared = useDraftPhoto('receipt-prepared');
  const form = draft.form.current,
    pending = draft.form.pending,
    pendingAttachment = pending?.input.attachment;
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [sourceError, setSourceError] = useState(''),
    [status, setStatus] = useState(''),
    [readable, setReadable] = useState(false),
    [decoded, setDecoded] = useState(false),
    [sourceUrl, setSourceUrl] = useState(''),
    [preparedUrl, setPreparedUrl] = useState('');
  const [confirm, setConfirm] = useState<
      'reading' | 'lines' | 'review' | 'clear' | 'storage' | 'another' | null
    >(null),
    [removed, setRemoved] = useState(false);
  const live = useRef(true),
    bypass = useRef(false),
    storageAccepted = useRef(false),
    job = useRef<number | null>(null),
    generation = useRef(0),
    revealCopy = useRef(false),
    copyPreview = useRef<HTMLElement>(null),
    copyHeading = useRef<HTMLHeadingElement>(null);
  const reader = usePhotoText((text) => {
    draft.setForm((previous) => ({
      ...previous,
      current: { ...previous.current, text: text.slice(0, 16000) },
    }));
    setStatus(
      text.length > 16000
        ? 'The reading is limited to the first 16,000 characters. Choose a smaller area for the rest.'
        : 'Check the text before choosing receipt lines.',
    );
  });
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      job.current = null;
    };
  }, []);
  useEffect(() => {
    if (!source.file) {
      setSourceUrl('');
      return;
    }
    const url = URL.createObjectURL(source.file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source.file]);
  useEffect(() => {
    setDecoded(false);
    setReadable(false);
    setPreparedUrl('');
    const file = prepared.file;
    if (!file) return;
    let active = true,
      url = '';
    const show = () => {
      if (!active) return;
      url = URL.createObjectURL(file);
      setPreparedUrl(url);
    };
    if (pendingAttachment) {
      void receiptDigest(file)
        .then((digest) => {
          if (!active) return;
          if (digest !== pendingAttachment.digest || file.type !== pendingAttachment.contentType) {
            setSourceError(
              'This device copy differs from the pending attachment. Your text is kept. Check the saved receipt before another review.',
            );
          } else show();
        })
        .catch(() => {
          if (active)
            setSourceError(
              'The pending copy could not be checked. Your text is kept; check the saved receipt before another review.',
            );
        });
    } else show();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [prepared.file, pendingAttachment]);
  useEffect(() => {
    if (preparedUrl && revealCopy.current) {
      revealCopy.current = false;
      copyPreview.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      copyHeading.current?.focus({ preventScroll: true });
    }
  }, [preparedUrl]);
  const locked = !!busy || !!pending || reader.busy;
  const dirty =
    JSON.stringify(draft.form) !== JSON.stringify(emptyReceipt()) || !!source.file || !!prepared.file;
  const blocker = useBlocker(() => !bypass.current && dirty);
  function begin(label: string) {
    if (job.current !== null) return null;
    const token = ++generation.current;
    job.current = token;
    setBusy(label);
    return token;
  }
  function current(token: number) {
    return live.current && job.current === token;
  }
  function end(token: number) {
    if (current(token)) {
      job.current = null;
      setBusy('');
    }
  }
  function edit(next: ReceiptDraft['current']) {
    if (locked || job.current !== null) return;
    draft.setForm({ ...draft.form, current: next });
    setError('');
    setStatus('');
  }
  function patchLine(id: string, patch: Partial<ReceiptDraft['current']['lines'][number]>) {
    edit({
      ...form,
      lines: form.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  async function choose(file: File | undefined) {
    if (!file || locked) return;
    const token = begin('Checking the photo…');
    if (token === null) return;
    setError('');
    setSourceError('');
    try {
      await checkTextPhoto(file);
      if (!current(token)) return;
      source.change(file);
      reader.reset();
      prepared.clear();
      setReadable(false);
      draft.setForm((previous) => ({ ...previous, current: { ...previous.current, attachment: null } }));
      setStatus('Photo chosen. Read it or keep reviewing the text; old text is not replaced automatically.');
    } catch (e) {
      if (current(token)) setSourceError(e instanceof Error ? e.message : 'Choose another photo.');
    } finally {
      end(token);
    }
  }
  async function prepare() {
    if (!source.file || locked) return;
    const file = source.file,
      token = begin('Preparing the attachment on this device…');
    if (token === null) return;
    setError('');
    setSourceError('');
    try {
      const blob = await prepareReceiptCopy(file);
      if (!current(token)) return;
      revealCopy.current = true;
      prepared.change(new File([blob], 'receipt-copy', { type: blob.type }));
      draft.setForm((previous) => ({ ...previous, current: { ...previous.current, attachment: null } }));
      setStatus('Check the exact attachment copy below. The source photo is unchanged while you review.');
    } catch (e) {
      if (current(token))
        setSourceError(e instanceof Error ? e.message : 'Could not prepare the attachment.');
    } finally {
      end(token);
    }
  }
  function finish(receipt: Awaited<ReturnType<typeof api.receipt>>['receipt']) {
    client.setQueryData(['receipt', receipt.id], { receipt });
    void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    draft.clear(emptyReceipt());
    draft.setForm(emptyReceipt());
    source.clear();
    prepared.clear();
    bypass.current = true;
    navigate(`/receipts/${receipt.id}`, { replace: true });
  }
  async function send() {
    if ((locked && !pending) || job.current !== null || !online || reader.busy) return;
    const needsCopy = !!(pending ? pending.input.attachment : form.attachment);
    if (
      (draft.status.includes('could not') ||
        (needsCopy && (prepared.status.includes('could not') || prepared.status.includes('unavailable')))) &&
      !storageAccepted.current
    ) {
      setConfirm('storage');
      return;
    }
    const token = begin('Checking the reviewed receipt…');
    if (token === null) return;
    const reviewed = form,
      copy = prepared.file;
    let frozen = pending;
    setError('');
    setStatus('');
    try {
      if (!frozen) {
        let attachment = null;
        if (reviewed.attachment) {
          if (!copy || !decoded || !readable)
            throw new Error('Review the exact attachment copy and confirm it is readable.');
          attachment = {
            contentType: copy.type as 'image/jpeg' | 'image/png' | 'image/webp',
            digest: await receiptDigest(copy),
            available: true,
          };
          const persisted = await prepared.freeze(copy);
          if (!current(token)) return;
          if (!persisted.stored && !storageAccepted.current) {
            setConfirm('storage');
            return;
          }
        }
        if (!current(token)) return;
        frozen = { id: draft.operationId.current, input: receiptPayload({ ...reviewed, attachment }) };
        draft.checkpoint({ current: { ...reviewed, attachment }, pending: frozen });
      }
      const blob = frozen.input.attachment ? copy : null;
      if (
        frozen.input.attachment &&
        (!blob ||
          blob.type !== frozen.input.attachment.contentType ||
          (await receiptDigest(blob)) !== frozen.input.attachment.digest)
      )
        throw new Error(
          'The exact pending attachment is unavailable on this device. Keep the text, check saved details, and choose another review only after checking.',
        );
      if (pending && blob) {
        const persisted = await prepared.freeze(blob);
        if (!current(token)) return;
        if (!persisted.stored && !storageAccepted.current) {
          setConfirm('storage');
          return;
        }
      }
      if (!current(token)) return;
      setBusy('Saving the reviewed receipt…');
      const response = await api.createReceipt(frozen.input, frozen.id, blob);
      if (current(token)) finish(response.receipt);
    } catch (e) {
      if (current(token)) {
        setError(
          e instanceof Error && 'issues' in e
            ? String(
                (e as { issues: { message: string }[] }).issues[0]?.message ?? 'Check the receipt details.',
              )
            : e instanceof Error
              ? e.message
              : 'Could not save this receipt.',
        );
        setRemoved(e instanceof RequestError && e.status === 410);
      }
    } finally {
      end(token);
    }
  }
  async function check() {
    if (!pending || job.current !== null || !online) return;
    const token = begin('Checking the saved receipt…');
    if (token === null) return;
    setError('');
    try {
      const response = await api.receipt(pending.id);
      if (!current(token)) return;
      if (JSON.stringify(receiptBody(response.receipt)) === JSON.stringify(pending.input))
        finish(response.receipt);
      else
        setError(
          'Saved details differ from this draft. Keep your copy and open the saved receipt before another review.',
        );
    } catch (e) {
      if (current(token)) setError(e instanceof Error ? e.message : 'Could not check saved details.');
    } finally {
      end(token);
    }
  }
  function lines() {
    edit({ ...form, lines: receiptLineSuggestions(form.text) });
    setConfirm(null);
  }
  return (
    <main className="light-page page-width receipt-capture-page">
      <header className="page-head">
        <div>
          <p className="overline">ON THIS DEVICE, THEN YOUR REVIEW</p>
          <h1>Keep a receipt.</h1>
          <p>A few lines worth keeping.</p>
        </div>
        <Link to="/receipts">Back to Receipts →</Link>
      </header>
      <p>
        Read English printed text on this device, or paste it. Check each line, then choose what to link or
        create. Recognition uses no external AI. Nothing is saved automatically.
      </p>
      <div className="receipt-capture-layout">
        <section className="receipt-source" aria-labelledby="receipt-source-heading">
          <p className="overline">01 / SOURCE</p>
          <h2 id="receipt-source-heading">The original stays here.</h2>
          <p>JPEG, PNG or WebP, up to 10 MB and 20 megapixels. Reading files load from Worth on first use.</p>
          <label className="button button-outline file-choice">
            Choose receipt photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={locked || !source.ready}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void choose(file);
              }}
            />
          </label>
          {sourceUrl && <img src={sourceUrl} alt="Receipt photo for on-device reading" />}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={locked || !source.file || typeof Worker === 'undefined'}
              onClick={() =>
                form.text ? setConfirm('reading') : source.file && void reader.read(source.file)
              }
            >
              Read receipt on this device
            </button>
            {reader.busy && (
              <button className="button button-outline" onClick={reader.stop}>
                Stop reading
              </button>
            )}
            {source.file && (
              <button
                className="button button-outline"
                disabled={locked}
                onClick={() => {
                  source.clear();
                  reader.reset();
                }}
              >
                Remove source photo
              </button>
            )}
          </div>
          {reader.busy && (
            <progress aria-label="Receipt reading progress" max={1} value={reader.progress ?? undefined} />
          )}
          {reader.status && <p role="status">{reader.status}</p>}
          {reader.error && <p role="alert">{reader.error}</p>}
          {source.status && <p role="status">{source.status}</p>}
          <h3>Attach a copy · optional</h3>
          <p>
            The original is used only for reading. Preparing a separate copy may resize it. Check the exact
            copy for readable text before choosing to upload it. Visible card numbers or personal information
            are not redacted automatically.
          </p>
          <button
            className="button button-outline"
            disabled={locked || !source.file || !prepared.ready}
            onClick={() => void prepare()}
          >
            Prepare exact attachment copy
          </button>
          {(busy.startsWith('Preparing the attachment') || busy === 'Checking the photo…') && (
            <p role="status">{busy}</p>
          )}
          {busy.startsWith('Preparing the attachment') && (
            <button
              className="button button-outline"
              onClick={() => {
                job.current = null;
                setBusy('');
                setStatus('Attachment preparation stopped. Your previous copy is kept.');
              }}
            >
              Stop attachment preparation
            </button>
          )}
          {sourceError && (
            <p className="form-error" role="alert">
              {sourceError}
            </p>
          )}
          {preparedUrl && (
            <section
              className="receipt-copy-preview"
              ref={copyPreview}
              aria-labelledby="receipt-copy-heading"
            >
              <h3 id="receipt-copy-heading" ref={copyHeading} tabIndex={-1}>
                Exact attachment copy
              </h3>
              <a href={preparedUrl} target="_blank" rel="noreferrer">
                Open the exact copy at full size →
              </a>
              <img
                src={preparedUrl}
                alt="Exact receipt attachment copy"
                onLoad={() => setDecoded(true)}
                onError={() => {
                  setDecoded(false);
                  setReadable(false);
                  setSourceError(
                    'This attachment copy could not be displayed. Prepare another or save without it.',
                  );
                }}
              />
              <label className="receipt-check">
                <input
                  type="checkbox"
                  disabled={locked || !decoded}
                  checked={!!form.attachment}
                  onChange={(e) =>
                    edit({
                      ...form,
                      attachment: e.target.checked
                        ? {
                            contentType: prepared.file!.type as 'image/jpeg' | 'image/png' | 'image/webp',
                            digest: '0'.repeat(64),
                            available: true,
                          }
                        : null,
                    })
                  }
                />
                Include this exact copy with the saved receipt
              </label>
              <label className="receipt-check">
                <input
                  type="checkbox"
                  disabled={locked || !decoded}
                  checked={!!pendingAttachment || readable}
                  onChange={(e) => setReadable(e.target.checked)}
                />
                I checked that this copy is readable
              </label>
              <button
                className="button button-outline"
                disabled={locked}
                onClick={() => {
                  prepared.clear();
                  setSourceError('');
                  edit({ ...form, attachment: null });
                }}
              >
                Remove attachment copy
              </button>
            </section>
          )}
          {!pending && form.attachment && prepared.ready && !prepared.file && (
            <p role="alert">
              The attachment copy is unavailable on this device. Keep reviewing the text or prepare another
              copy.
              <button
                className="button button-outline"
                disabled={locked}
                onClick={() => edit({ ...form, attachment: null })}
              >
                Save without an attachment copy
              </button>
            </p>
          )}
          {pendingAttachment && prepared.ready && !prepared.file && (
            <p role="alert">
              The pending attachment copy could not recover on this device. Your text is kept. Check the saved
              receipt before starting another review.
            </p>
          )}
          {prepared.status && <p role="status">{prepared.status}</p>}
          <p className="muted">
            Photo drafts can recover with this account on this device for seven days, until you save or clear
            the review. Your selected source file is unchanged.
          </p>
        </section>
        <section className="receipt-review" aria-labelledby="receipt-review-heading">
          <p className="overline">02 / REVIEW</p>
          <h2 id="receipt-review-heading">You choose the lines.</h2>
          <fieldset disabled={locked}>
            <legend className="sr-only">Receipt details</legend>
            <label>
              Receipt name
              <input
                maxLength={80}
                value={form.name}
                onChange={(e) => edit({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Merchant · optional
              <input
                maxLength={120}
                value={form.merchant}
                onChange={(e) => edit({ ...form, merchant: e.target.value })}
              />
            </label>
            <label>
              Receipt date · optional
              <input type="date" value={form.day} onChange={(e) => edit({ ...form, day: e.target.value })} />
            </label>
            <label>
              Read or pasted receipt text
              <textarea
                rows={7}
                maxLength={16000}
                value={form.text}
                onChange={(e) => edit({ ...form, text: e.target.value })}
              />
            </label>
            <button
              className="button button-outline"
              disabled={!form.text.trim()}
              onClick={() => (form.lines.length ? setConfirm('lines') : lines())}
            >
              Make line suggestions from this text
            </button>
            <p>
              Only literal lines are suggested, up to 30. Names, amounts, currency, tax, dates and purchases
              are not inferred. Suggestions remain unlinked.
            </p>
            <label>
              Receipt note · optional
              <textarea
                maxLength={2000}
                value={form.note}
                onChange={(e) => edit({ ...form, note: e.target.value })}
              />
            </label>
          </fieldset>
        </section>
      </div>
      <section className="receipt-lines" aria-labelledby="receipt-lines-heading">
        <div className="receipt-section-head">
          <h2 id="receipt-lines-heading">Reviewed lines · {form.lines.length}/30</h2>
          <button
            className="button button-outline"
            disabled={locked || form.lines.length >= 30}
            onClick={() =>
              edit({
                ...form,
                lines: [
                  ...form.lines,
                  {
                    id: crypto.randomUUID(),
                    label: '',
                    amount: '',
                    note: '',
                    mapping: { mode: 'none' },
                    referenceMissing: false,
                    createdHere: false,
                    createdName: '',
                  },
                ],
              })
            }
          >
            Add a receipt line
          </button>
        </div>
        <button
          className="button button-outline"
          disabled={locked || !online}
          onClick={() =>
            void client.invalidateQueries({
              predicate: (query) =>
                ['lists', 'archived-lists', 'receipt-map-items', 'receipt-map-current'].includes(
                  String(query.queryKey[0]),
                ),
            })
          }
        >
          Refresh record choices
        </button>
        <p>
          Choose which lines should link to a record. A new record starts unranked with the name you enter.
        </p>
        <ol>
          {form.lines.map((line, index) => (
            <ReceiptLineEditor
              key={line.id}
              line={line}
              index={index + 1}
              disabled={locked}
              onPatch={(patch) => patchLine(line.id, patch)}
              onRemove={() => edit({ ...form, lines: form.lines.filter((row) => row.id !== line.id) })}
            />
          ))}
        </ol>
      </section>
      <section className="receipt-save" aria-label="Review and save receipt">
        <h2>Keep this reviewed receipt</h2>
        <p>
          New unranked records: {form.lines.filter((l) => l.mapping.mode === 'create').length} · Existing
          links: {form.lines.filter((l) => l.mapping.mode === 'existing').length} ·{' '}
          {form.attachment ? 'One reviewed attachment copy' : 'No photo upload'}
        </p>
        <p>
          Receipt text and chosen links stay private. You can remove a receipt later; its linked or created
          records remain. Keep up to 100 receipts. Saved receipts are fixed snapshots of this review.
        </p>
        <p>
          After a confirmed save, this review closes and Worth clears its device drafts when storage is
          available. Choose an attachment above if Worth should keep an image copy.
        </p>
        {pending && (
          <>
            <p role="status">
              This pending save is fixed. Retry exactly or check its saved address before another review.
            </p>
            <ReceiptDraftReadout form={form} />
          </>
        )}
        <div className="data-actions">
          <button
            className="button button-accent"
            disabled={!!busy || reader.busy || !online || !source.ready || !prepared.ready}
            onClick={() => void send()}
          >
            {pending ? 'Retry exact receipt save' : 'Save reviewed receipt'}
          </button>
          {pending && (
            <button
              className="button button-outline"
              disabled={!!busy || !online}
              onClick={() => void check()}
            >
              Check saved receipt
            </button>
          )}
          {pending && error && <Link to={`/receipts/${pending.id}`}>Open this saved receipt address →</Link>}
          {pending && error && (
            <button
              className="button button-outline"
              disabled={!!busy}
              onClick={() => setConfirm(removed ? 'another' : 'review')}
            >
              {removed ? 'Start another receipt from this draft' : 'Review this receipt draft again'}
            </button>
          )}
        </div>
        {!online && (
          <p role="status">
            You’re offline. Device drafts remain when storage is available. Reconnect to save or load records.
          </p>
        )}
        {busy && !busy.startsWith('Preparing the attachment') && busy !== 'Checking the photo…' && (
          <p role="status">{busy}</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
            {form.attachment && preparedUrl && (
              <button
                className="button button-outline"
                onClick={() => {
                  copyPreview.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
                  copyHeading.current?.focus({ preventScroll: true });
                }}
              >
                Review the attachment copy ↑
              </button>
            )}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {draft.status && <p role="status">{draft.status}</p>}
      </section>
      <button className="button button-outline" disabled={locked} onClick={() => setConfirm('clear')}>
        Clear this receipt draft
      </button>
      {(confirm || blocker.state === 'blocked') && (
        <ConfirmDialog
          className="receipt-confirm"
          title={
            blocker.state === 'blocked'
              ? 'Leave this receipt draft?'
              : confirm === 'reading'
                ? 'Replace the receipt reading?'
                : confirm === 'lines'
                  ? 'Replace these line suggestions?'
                  : confirm === 'clear'
                    ? 'Clear this receipt draft?'
                    : confirm === 'storage'
                      ? 'Save without device recovery?'
                      : confirm === 'another'
                        ? 'Start another receipt?'
                        : 'Review this receipt again?'
          }
          description={
            confirm === 'reading'
              ? 'Replaces the read or pasted text. Your reviewed lines remain unchanged.'
              : confirm === 'lines'
                ? 'Replaces all current line text, amounts, notes and mappings with unlinked suggestions. Copy anything you want to keep first.'
                : confirm === 'clear'
                  ? 'Removes this device’s receipt text, original photo and prepared copy. Saved receipts and records remain.'
                  : confirm === 'storage'
                    ? 'This device cannot keep retry details or a photo copy. Keep this page open if a reply fails and check saved details before another review.'
                    : confirm === 'another'
                      ? 'The removed receipt cannot be recreated by an old retry. This starts another review; any records created earlier remain. Check your collections before choosing Create again.'
                      : 'Device drafts can recover for seven days when storage is available. If an earlier save arrived, a changed retry cannot overwrite it. Copy important text before leaving.'
          }
          confirmLabel={
            blocker.state === 'blocked'
              ? 'Leave page'
              : confirm === 'reading'
                ? 'Read again'
                : confirm === 'lines'
                  ? 'Replace suggestions'
                  : confirm === 'clear'
                    ? 'Clear draft'
                    : confirm === 'storage'
                      ? 'Save receipt'
                      : 'Review again'
          }
          pending={!!busy}
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
            if (confirm === 'reading') {
              setConfirm(null);
              if (source.file) void reader.read(source.file);
            } else if (confirm === 'lines') lines();
            else if (confirm === 'storage') {
              storageAccepted.current = true;
              setConfirm(null);
              void send();
            } else if (confirm === 'clear') {
              reader.reset();
              source.clear();
              prepared.clear();
              draft.clear(emptyReceipt());
              draft.setForm(emptyReceipt());
              setError('');
              setSourceError('');
              setStatus('');
              setConfirm(null);
            } else {
              if (confirm === 'another') draft.operationId.current = crypto.randomUUID();
              draft.checkpoint({ ...draft.form, pending: null });
              setConfirm(null);
              setError('');
            }
          }}
        />
      )}
    </main>
  );
}
function ReceiptDraftReadout({ form }: { form: ReceiptDraft['current'] }) {
  return (
    <div className="receipt-draft-readout">
      <h3>{form.name || 'Unnamed receipt'}</h3>
      <p>{[form.merchant, form.day].filter(Boolean).join(' · ')}</p>
      {form.note && <p>{form.note}</p>}
      <details>
        <summary>Read or pasted text kept for copying</summary>
        <p>{form.text}</p>
      </details>
      <ol>
        {form.lines.map((line) => (
          <li key={line.id}>
            <strong>{line.label || 'Unnamed line'}</strong>
            {line.amount && <p>{line.amount}</p>}
            {line.note && <p>{line.note}</p>}
            <p>
              {line.mapping.mode === 'none'
                ? 'Unlinked'
                : line.mapping.mode === 'existing'
                  ? 'Existing record chosen above'
                  : `New unranked record: ${line.mapping.title}`}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
