import { useEffect, useRef, useState } from 'react';
import { useAccountId } from '../hooks/useAccountId';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePhotoText } from '../hooks/usePhotoText';
import { checkTextPhoto } from '../shared/photo-text';
import { stageIncomingCapture } from '../shared/incoming-capture';
import '../photo-text.css';

const textDraft = z
  .object({ text: z.string().max(16000), title: z.string().max(120), note: z.string().max(4000) })
  .strict();
type TextDraft = z.infer<typeof textDraft>;
const empty: TextDraft = { text: '', title: '', note: '' };

export function PhotoTextPage() {
  usePageTitle('Read a photo');
  const navigate = useNavigate();
  const owner = useAccountId();
  const draft = useDraft<TextDraft>(
    'photo-text',
    empty,
    (value): value is TextDraft => textDraft.safeParse(value).success,
  );
  const photo = useDraftPhoto('photo-text-source');
  const form = draft.form;
  const [notesOpen, setNotesOpen] = useState(Boolean(form.note));
  const [preview, setPreview] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<'read' | 'note' | 'clear' | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const reader = usePhotoText((text) => {
    draft.setForm({ ...form, text: text.slice(0, 16000) });
    setNotice(
      text.length > 16000
        ? 'Only the first 16,000 characters are shown. Choose a smaller part of the photo if you need the rest.'
        : '',
    );
  });
  const busy = reader.busy || checking;
  const supported =
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof createImageBitmap !== 'undefined';
  const lines = [
    ...new Set(
      form.text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && line.length <= 120),
    ),
  ].slice(0, 100);
  useEffect(() => {
    if (!photo.file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(photo.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo.file]);
  async function choose(file: File | undefined) {
    if (!file) return;
    setChecking(true);
    setError('');
    try {
      await checkTextPhoto(file);
      if (live.current) {
        reader.reset();
        photo.change(file);
        if (form.text.trim())
          setNotice(
            'Photo changed. Read again to replace the old text; your chosen name and note stay as they are.',
          );
      }
    } catch (cause) {
      if (live.current) setError(cause instanceof Error ? cause.message : 'Choose another photo.');
    } finally {
      if (live.current) setChecking(false);
    }
  }
  function read() {
    setConfirm(null);
    if (photo.file) void reader.read(photo.file);
  }
  function copyNote() {
    draft.setForm({ ...form, note: form.text });
    setConfirm(null);
  }
  return (
    <main className="light-page page-width photo-text-page">
      <header className="page-head">
        <div>
          <p className="overline">ON THIS DEVICE</p>
          <h1>Read a photo.</h1>
          <p>Keep the words. You choose what follows.</p>
        </div>
        <Link to="/capture">Back to capture →</Link>
      </header>
      <p className="photo-text-intro">
        Read English printed text from a photo, then check and edit it. Recognition stays in your browser;
        your photo is not uploaded for processing. You can paste text instead.
      </p>
      <div className="photo-text-layout">
        <section className="photo-text-source" aria-labelledby="photo-source-title">
          <p className="overline">01 / PHOTO</p>
          <h2 id="photo-source-title">A clear view helps.</h2>
          <p>
            Choose an upright JPEG, PNG or WebP, up to 10 MB and 20 megapixels. The first use downloads
            reading files from Worth. No AI provider is used.
          </p>
          <label className="button button-outline file-choice">
            Choose photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || !photo.ready}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void choose(file);
              }}
            />
          </label>
          {checking && <p role="status">Checking this photo…</p>}
          {preview && (
            <figure>
              <img src={preview} alt="Selected photo for text reading" />
              <figcaption>{photo.file?.name}</figcaption>
            </figure>
          )}
          {!supported && (
            <p role="status">Photo reading is unavailable in this browser. Paste or type the words below.</p>
          )}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!photo.file || busy || !supported}
              onClick={() => {
                if (form.text.trim()) setConfirm('read');
                else read();
              }}
            >
              Read text on this device
            </button>
            {reader.busy && (
              <button className="button button-outline" onClick={reader.stop}>
                Stop reading
              </button>
            )}
            {photo.file && (
              <button className="button button-outline" disabled={busy} onClick={photo.clear}>
                Remove photo
              </button>
            )}
          </div>
          {reader.busy && (
            <progress aria-label="Text reading progress" max={1} value={reader.progress ?? undefined} />
          )}
          {reader.status && <p role="status">{reader.status}</p>}
          {(error || reader.error) && (
            <p className="form-error" role="alert">
              {error || reader.error}
            </p>
          )}
          {photo.status && (
            <p className="draft-status" role="status">
              {photo.status}
            </p>
          )}
          <p className="muted">
            The photo can recover on this device for seven days, until you remove it or clear device drafts.
            It is not attached to a saved record.
          </p>
        </section>
        <section className="photo-text-review" aria-labelledby="photo-review-title">
          <p className="overline">02 / REVIEW</p>
          <h2 id="photo-review-title">Your words, checked.</h2>
          <p>
            Nothing is saved automatically. Names, prices and dates can be misread; Worth doesn’t fill those
            fields for you.
          </p>
          <label>
            Read or pasted text
            <textarea
              rows={5}
              maxLength={16000}
              value={form.text}
              disabled={busy}
              onChange={(event) => {
                draft.setForm({ ...form, text: event.target.value });
                setNotice('');
              }}
              placeholder="Read a photo, paste text, or type here"
            />
          </label>
          <p>Up to 16,000 characters. Type a name below if the line you want is not listed.</p>
          {notice && <p role="status">{notice}</p>}
          {!!lines.length && (
            <label>
              Choose a line for the name
              <select
                value=""
                disabled={busy}
                onChange={(event) => {
                  if (event.target.value !== '')
                    draft.setForm({ ...form, title: lines[Number(event.target.value)] });
                }}
              >
                <option value="">Choose a line, or type a name below</option>
                {lines.map((line, index) => (
                  <option key={index} value={index}>
                    {line}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Name to keep
            <input
              maxLength={120}
              value={form.title}
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
                rows={3}
                maxLength={4000}
                value={form.note}
                disabled={busy}
                onChange={(event) => draft.setForm({ ...form, note: event.target.value })}
              />
            </label>
            <button
              className="button button-outline"
              disabled={busy || !form.text || form.text.length > 4000}
              onClick={() => {
                if (form.note) setConfirm('note');
                else copyNote();
              }}
            >
              Use this text as the note
            </button>
            {form.text.length > 4000 && (
              <p>The note holds 4,000 characters. Copy the part you want into the note field.</p>
            )}
          </details>
          <p>
            Next, review this name and note in capture and choose Inbox or a collection. Your photo and the
            rest of the text are not sent with them.
          </p>
          <button
            className="button button-accent"
            disabled={busy || !form.title.trim() || !owner}
            onClick={() => {
              if (!owner) return;
              stageIncomingCapture({ title: form.title.trim(), text: form.note, url: '' }, owner);
              navigate('/capture');
            }}
          >
            Review this capture →
          </button>
          {draft.status && (
            <p className="draft-status" role="status">
              {draft.status}
            </p>
          )}
        </section>
      </div>
      <button className="button button-outline" disabled={busy} onClick={() => setConfirm('clear')}>
        Clear photo and text draft
      </button>
      {confirm === 'read' && (
        <ConfirmDialog
          title="Replace this reading?"
          description="Replaces the read or pasted text with a new reading. Your chosen name and private note stay as they are."
          confirmLabel="Read photo again"
          onClose={() => setConfirm(null)}
          onConfirm={read}
        />
      )}
      {confirm === 'note' && (
        <ConfirmDialog
          title="Replace this private note?"
          description="Copies all the text above into the note. Check it before continuing."
          confirmLabel="Replace note"
          onClose={() => setConfirm(null)}
          onConfirm={copyNote}
        />
      )}
      {confirm === 'clear' && (
        <ConfirmDialog
          title="Clear this photo and text draft?"
          description="Removes this device’s photo, read text, name and note draft. Saved records and any draft already sent to capture stay as they are."
          confirmLabel="Clear draft"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            photo.clear();
            reader.reset();
            draft.clear(empty);
            draft.setForm(empty);
            setNotice('');
            setError('');
            setNotesOpen(false);
            setConfirm(null);
          }}
        />
      )}
    </main>
  );
}
