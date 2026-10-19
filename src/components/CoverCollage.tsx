import { X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBlocker } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../api';
import { useAccountId } from '../hooks/useAccountId';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import { coverCollage, collageColors, fitCollageFrame, type CollageFrame } from '../shared/cover-collage';
import { collagePhotoPath, privateCollageImage, renderCollage } from '../shared/collage-export';
import { saveLocalFile } from '../shared/booklet-export';
import type { Item, ListDetail, Log } from '../shared/models';
import { ConfirmDialog } from './ConfirmDialog';
import '../cover-collage.css';
const draftSchema = coverCollage.extend({ expectedVersion: z.number().int().nonnegative() }).strict();
type Draft = z.infer<typeof draftSchema>;
type Ready = { signature: string; file: File };

export function CoverCollage({
  list,
  items,
  logs,
  onClose,
}: {
  list: ListDetail;
  items: Item[];
  logs: Log[];
  onClose: () => void;
}) {
  const owner = useAccountId(),
    online = useConnection(),
    client = useQueryClient();
  const draft = useDraft<Draft>(
    `cover-collage:${list.id}`,
    { frames: [], background: 'sage', expectedVersion: list.coverRevision ?? 0 },
    (v): v is Draft => draftSchema.safeParse(v).success,
  );
  const { form, setForm } = draft;
  const dialog = useRef<HTMLDialogElement>(null),
    controller = useRef<AbortController | null>(null),
    active = useRef(true);
  const [ready, setReady] = useState<Ready | null>(null),
    [preview, setPreview] = useState('');
  const [review, setReview] = useState<{ list: ListDetail; photo: Blob | null } | null>(null),
    [reviewUrl, setReviewUrl] = useState('');
  const [reviewImage, setReviewImage] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'prepare' | 'save' | 'review' | null>(null),
    [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [choice, setChoice] = useState(''),
    [source, setSource] = useState('');
  const blocker = useBlocker(() => form.frames.length > 0 || busy !== null);
  const records = [
    ...items.map((i) => ({ kind: 'items' as const, id: i.id, name: i.title, hasPhoto: i.hasPhoto })),
    ...logs.map((l) => ({
      kind: 'logs' as const,
      id: l.id,
      name: `${l.happenedOn} · ${l.title || 'Visit'}`,
      hasPhoto: l.hasPhoto,
    })),
  ];
  const [kind, recordId] = source.split(':') as ['items' | 'logs', string];
  const gallery = useQuery({
    queryKey: ['photo-gallery', kind, recordId],
    queryFn: () => api.gallery(kind, recordId),
    enabled: !!source,
  });
  const signature = JSON.stringify({ frames: form.frames, background: form.background });
  const current = ready?.signature === signature ? ready : null;
  useEffect(() => {
    const node = dialog.current;
    active.current = true;
    node?.showModal();
    return () => {
      active.current = false;
      controller.current?.abort();
      node?.close();
    };
  }, []);
  useEffect(() => {
    if (!current) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(current.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [current]);
  useEffect(() => {
    if (!review?.photo) {
      setReviewUrl('');
      return;
    }
    const url = URL.createObjectURL(review.photo);
    setReviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [review]);
  function close() {
    if (busy === 'save') return;
    if (form.frames.length || busy) setConfirm(true);
    else onClose();
  }
  function edit(next: Draft) {
    setForm(next);
    setReady(null);
    setError('');
    setStatus('');
  }
  function update(id: string, patch: Partial<CollageFrame>) {
    edit({ ...form, frames: form.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }
  function move(index: number, by: number) {
    const frames = [...form.frames];
    [frames[index], frames[index + by]] = [frames[index + by], frames[index]];
    edit({ ...form, frames });
  }
  async function job(task: 'prepare' | 'save' | 'review') {
    if (busy || !owner || !online) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(task);
    setError('');
    setStatus('');
    try {
      if (task === 'prepare') {
        const file = await renderCollage(
          { frames: form.frames, background: form.background },
          owner,
          abort.signal,
        );
        if (active.current && controller.current === abort) {
          setReady({ signature, file });
          setStatus('Image ready. Review the exact image below before saving or downloading.');
        }
      } else if (task === 'review') {
        const saved = (await api.list(list.id)).list;
        abort.signal.throwIfAborted();
        const photo = saved.hasCoverPhoto
          ? await privateCollageImage(
              `/api/lists/${list.id}/cover`,
              owner,
              abort.signal,
              saved.coverRevision ?? 0,
            )
          : null;
        if (active.current && controller.current === abort) {
          setReviewImage(photo ? 'loading' : 'ready');
          setReview({ list: saved, photo });
        }
      } else if (current) {
        // Freeze the inspected file and version for this attempt; no automatic retry with a fresh version.
        const saved = await api.uploadListCover(list.id, current.file, form.expectedVersion);
        if (active.current && controller.current === abort) {
          const next = { ...form, expectedVersion: saved.revision };
          draft.checkpoint(next);
          setReview(null);
          setStatus('Collage saved as the private collection cover. Source photos are unchanged.');
          for (const key of [['list', list.id], ['lists'], ['overview']])
            void client.invalidateQueries({ queryKey: key });
        }
      }
    } catch (failure) {
      if (active.current && controller.current === abort && !abort.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Could not finish. Try again.');
    } finally {
      if (active.current && controller.current === abort) setBusy(null);
    }
  }
  return createPortal(
    <>
      <dialog
        ref={dialog}
        className="editor-dialog cover-collage-dialog"
        aria-labelledby="collage-heading"
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
              <p className="overline">{list.name}</p>
              <h2 id="collage-heading">Cover collage</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Close collage"
              disabled={busy === 'save'}
              onClick={close}
            >
              <X size={22} />
            </button>
          </div>
          <p>
            Arrange up to six saved photos. Source images stay intact. Only the prepared image becomes this
            collection’s private cover.
          </p>
          <fieldset disabled={!!busy} className="collage-fields">
            <legend className="sr-only">Collage arrangement</legend>
            <div className="collage-browse">
              <label>
                Record or visit
                <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                  <option value="">Choose a record</option>
                  {records.map((r) => (
                    <option key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>
                      {r.name}
                      {r.kind === 'logs' ? ' · Visit' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button-outline"
                disabled={!choice || !online}
                onClick={() => {
                  if (choice === source) void gallery.refetch();
                  else setSource(choice);
                }}
              >
                Load its photos
              </button>
            </div>
            {!records.length && <p>Save a record and add photos in its details first.</p>}
            {gallery.isFetching && <p role="status">Opening saved photos…</p>}
            {gallery.isError && (
              <p role="alert">
                {gallery.error.message}{' '}
                <button className="button button-outline" onClick={() => void gallery.refetch()}>
                  Retry photos
                </button>
              </p>
            )}
            {gallery.data && (
              <div className="collage-sources" aria-label="Available photos">
                {!gallery.data.gallery.entries.length && (
                  <p>No photos yet. Add one from the record’s Manage photos controls.</p>
                )}
                {gallery.data.gallery.entries.map((entry, i) => (
                  <button
                    className="button button-outline"
                    key={entry.id}
                    aria-description={entry.caption || 'No saved caption'}
                    disabled={!entry.source.available || form.frames.length >= 6}
                    onClick={() =>
                      edit({
                        ...form,
                        frames: [
                          ...form.frames,
                          {
                            id: crypto.randomUUID(),
                            kind,
                            recordId,
                            photoId: entry.id,
                            name: (records.find((r) => r.id === recordId)?.name || 'Saved photo').slice(
                              0,
                              240,
                            ),
                            caption: '',
                            x: 10,
                            y: 10,
                            width: 50,
                            height: 50,
                          },
                        ],
                      })
                    }
                  >
                    {entry.source.available && (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={`/api/${kind}/${recordId}/photos/${entry.id}`}
                        alt=""
                      />
                    )}
                    Add photo {i + 1}
                    {!entry.source.available ? ' · Original unavailable' : ''}
                  </button>
                ))}
              </div>
            )}
            <label>
              Background
              <select
                value={form.background}
                onChange={(e) => edit({ ...form, background: e.target.value as Draft['background'] })}
              >
                {Object.keys(collageColors).map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Frames run from the left/top edge (0%) to the right/bottom edge (100%). Later frames sit in
              front. Photos fit inside each frame without cropping.
            </p>
            <div
              className="collage-layout"
              aria-label="Arrangement sketch"
              style={{ background: collageColors[form.background] }}
            >
              {form.frames.map((f, i) => (
                <div
                  key={f.id}
                  className="collage-layout-frame"
                  style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.width}%`, height: `${f.height}%` }}
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={collagePhotoPath(f)}
                    alt={`Frame ${i + 1}: ${f.name}`}
                  />
                  <span>
                    {i + 1}
                    {f.caption ? ` · ${f.caption}` : ''}
                  </span>
                </div>
              ))}
            </div>
            <p className="muted">
              This sketch helps position frames. Prepare the exact image to check captions, layering and photo
              fit.
            </p>
            <ol className="collage-frame-list">
              {form.frames.map((f, i) => (
                <li key={f.id}>
                  <h3>Frame {i + 1}</h3>
                  <p>{f.name}</p>
                  <label>
                    Caption for frame {i + 1} · optional
                    <input
                      maxLength={80}
                      value={f.caption}
                      onChange={(e) => update(f.id, { caption: e.target.value })}
                    />
                  </label>
                  <div className="collage-coordinates">
                    {(
                      [
                        ['x', 'Across'],
                        ['y', 'Down'],
                        ['width', 'Width'],
                        ['height', 'Height'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label} for frame {i + 1} · {f[key]}%
                        <input
                          type="range"
                          min={key === 'width' || key === 'height' ? 20 : 0}
                          max={
                            key === 'x'
                              ? 100 - f.width
                              : key === 'y'
                                ? 100 - f.height
                                : key === 'width'
                                  ? 100 - f.x
                                  : 100 - f.y
                          }
                          step={1}
                          value={f[key]}
                          onChange={(e) => update(f.id, fitCollageFrame(f, key, Number(e.target.value)))}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="data-actions">
                    <button className="button button-outline" disabled={i === 0} onClick={() => move(i, -1)}>
                      Move frame {i + 1} back
                    </button>
                    <button
                      className="button button-outline"
                      disabled={i === form.frames.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      Move frame {i + 1} forward
                    </button>
                    <button
                      className="button button-outline"
                      onClick={() =>
                        edit({ ...form, frames: form.frames.filter((frame) => frame.id !== f.id) })
                      }
                    >
                      Remove frame {i + 1}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </fieldset>
          <p role="status">
            {draft.status ||
              'Arrangements can recover on this account/device for seven days. Prepared images stay in this tab.'}
          </p>
          {!online && (
            <p role="status">
              You’re offline. Keep arranging; reconnect to load originals or prepare and save the cover.
            </p>
          )}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!!busy || !online || !form.frames.length}
              onClick={() => void job('prepare')}
            >
              Prepare exact image
            </button>
            <button
              className="button button-outline"
              disabled={!busy || busy === 'save'}
              onClick={() => {
                controller.current?.abort();
                controller.current = null;
                setBusy(null);
                setStatus('Preparation stopped. Your arrangement is kept.');
              }}
            >
              Stop preparation
            </button>
          </div>
          {busy && (
            <p role="status">
              {busy === 'prepare'
                ? 'Preparing the image…'
                : busy === 'save'
                  ? 'Saving this cover…'
                  : 'Opening the current cover…'}
            </p>
          )}
          {current && preview && (
            <section className="collage-prepared" aria-label="Exact prepared cover">
              <h3>Exact cover preview</h3>
              <img src={preview} alt="Exact prepared collage" />
              <p>
                This 1280 × 800 image includes only these photos and captions. Existing covers will be
                replaced. Shelf crops may vary.
              </p>
              <div className="data-actions">
                <button
                  className="button button-accent"
                  disabled={!!busy || !online}
                  onClick={() => void job('save')}
                >
                  Save as collection cover
                </button>
                <button
                  className="button button-outline"
                  disabled={!!busy}
                  onClick={() => saveLocalFile(current.file)}
                >
                  Download cover image
                </button>
              </div>
            </section>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}{' '}
              {current ? 'Your arrangement and prepared image are kept.' : 'Your arrangement is kept.'}
            </p>
          )}
          {status && <p role="status">{status}</p>}
          <section className="collage-cover-review" aria-label="Current cover review">
            <h3>Review the saved cover</h3>
            <p>
              After a failed save, retry the same prepared image or open the current cover. A changed
              collection requires your review before another replacement.
            </p>
            <button
              className="button button-outline"
              disabled={!!busy || !online}
              onClick={() => void job('review')}
            >
              Review current cover
            </button>
            {review && (
              <>
                <p>Current collection: {review.list.name}. Your arrangement remains above.</p>
                {reviewUrl ? (
                  <img
                    src={reviewUrl}
                    alt="Current saved collection cover"
                    onLoad={() => setReviewImage('ready')}
                    onError={() => setReviewImage('error')}
                  />
                ) : (
                  <p>No private cover is saved. Collection artwork is showing.</p>
                )}
                {reviewImage === 'error' && (
                  <p role="alert">
                    The saved cover could not be displayed. Retry current cover review before replacing it.
                  </p>
                )}
                <button
                  className="button button-outline"
                  disabled={!!busy || reviewImage !== 'ready'}
                  onClick={() => {
                    draft.checkpoint({ ...form, expectedVersion: review.list.coverRevision ?? 0 });
                    setReview(null);
                    setStatus(
                      'Current cover reviewed. Prepare or inspect your image, then choose Save as collection cover to replace it.',
                    );
                  }}
                >
                  Use this reviewed cover version
                </button>
              </>
            )}
          </section>
        </div>
      </dialog>
      {(confirm || blocker.state === 'blocked') && (
        <ConfirmDialog
          className="cover-collage-confirm"
          title={blocker.state === 'blocked' ? 'Leave this page?' : 'Close the collage?'}
          description="Your arrangement can recover for seven days when device storage is available. If storage is blocked, copy captions before leaving. Prepared images stay only in this tab; download one first if you need it."
          confirmLabel={blocker.state === 'blocked' ? 'Leave page' : 'Close collage'}
          pending={busy === 'save'}
          onConfirm={() => {
            controller.current?.abort();
            setConfirm(false);
            if (blocker.state === 'blocked') blocker.proceed();
            else onClose();
          }}
          onClose={() => {
            setConfirm(false);
            if (blocker.state === 'blocked') blocker.reset();
          }}
        />
      )}
    </>,
    document.body,
  );
}
