import { createPortal } from 'react-dom';
import { PhotoComparison } from './PhotoComparison';
import { useImperativeHandle, useEffect, useRef, useState, type Ref } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from '@phosphor-icons/react';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { useConnection } from '../hooks/useConnection';
import {
  galleryDraft,
  galleryPatch,
  type GalleryDraft,
  type PhotoGallery as Gallery,
} from '../shared/photo-gallery';
import { preparePhoto } from '../shared/photos';
import { ConfirmDialog } from './ConfirmDialog';
import { DraftPhoto } from './DraftPhoto';
import { GalleryPhoto } from './GalleryPhoto';
import '../photo-gallery.css';

type Closing = { requestClose: () => void };
const metadata = (gallery: Gallery): GalleryDraft['current'] => ({
  expectedRevision: gallery.revision,
  coverId: gallery.coverId,
  entries: gallery.entries.map(({ id, caption, arrows }) => ({ id, caption, arrows })),
});
export function PhotoGallery({
  kind,
  id,
  onClose,
}: {
  kind: 'items' | 'logs';
  id: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    editor = useRef<Closing>(null);
  const query = useQuery({ queryKey: ['photo-gallery', kind, id], queryFn: () => api.gallery(kind, id) });
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  const close = () => (editor.current ? editor.current.requestClose() : onClose());
  return createPortal(
    <dialog
      ref={dialog}
      className="editor-dialog photo-gallery-dialog"
      aria-labelledby="photo-gallery-heading"
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">A FEW MORE ANGLES</p>
            <h2 id="photo-gallery-heading">Photos</h2>
          </div>
          <button className="icon-button" aria-label="Close photos" onClick={close}>
            <X size={22} />
          </button>
        </div>
        <p>
          Keep up to 12 photos. Captions and arrows sit over the saved originals; they never change their
          pixels. Choose a cover separately. Changes here do not set a call or rank.
        </p>
        {query.isPending && <p role="status">Opening saved photos…</p>}
        {query.isError && (
          <p role="alert">
            {query.error.message}{' '}
            <button className="button button-outline" onClick={() => void query.refetch()}>
              Try photos again
            </button>
          </p>
        )}
        {query.data && <GalleryEditor ref={editor} gallery={query.data.gallery} onClose={onClose} />}
      </div>
    </dialog>,
    document.body,
  );
}
function GalleryEditor({
  gallery,
  onClose,
  ref,
}: {
  gallery: Gallery;
  onClose: () => void;
  ref: Ref<Closing>;
}) {
  const client = useQueryClient(),
    online = useConnection();
  const draft = useDraft<GalleryDraft>(
    `gallery:${gallery.kind}:${gallery.recordId}`,
    { current: metadata(gallery), previous: null },
    (value): value is GalleryDraft => galleryDraft.safeParse(value).success,
  );
  const form = draft.form.current;
  const [saved, setSaved] = useState(() => metadata(gallery)),
    [review, setReview] = useState<Gallery | null>(null),
    [confirm, setConfirm] = useState<'leave' | 'reload' | 'previous' | null>(null),
    [removing, setRemoving] = useState<string | null>(null),
    [message, setMessage] = useState(''),
    [uploadMessage, setUploadMessage] = useState('');
  const uploadDraft = useDraftPhoto(`gallery-upload:${gallery.kind}:${gallery.recordId}`);
  const changed = JSON.stringify(form) !== JSON.stringify(saved);
  const savedUpload = gallery.entries.some((entry) => entry.id === uploadDraft.operationId.current);
  const source = new Map(gallery.entries.map((entry) => [entry.id, entry.source]));
  function edit(patch: Partial<typeof form>) {
    draft.setForm({ ...draft.form, current: { ...form, ...patch } });
    setMessage('');
  }
  function update(id: string, patch: Partial<(typeof form.entries)[number]>) {
    edit({ entries: form.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) });
  }
  function refresh(next: Gallery) {
    const current = metadata(next),
      nextDraft = { ...draft.form, current };
    draft.setForm(nextDraft);
    setSaved(current);
    if (nextDraft.previous) draft.checkpoint(nextDraft);
    else draft.clear(nextDraft);
    sync(next);
  }
  function sync(next: Gallery) {
    client.setQueryData(['photo-gallery', gallery.kind, gallery.recordId], { gallery: next });
    for (const key of [
      [gallery.kind, gallery.listId],
      [gallery.kind, next.listId],
      ['list', gallery.listId],
      ['list', next.listId],
      ['lists'],
      ['overview'],
    ])
      void client.invalidateQueries({ queryKey: key });
  }
  const save = useMutation({
    mutationFn: () => {
      const parsed = galleryPatch.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the photo details.');
      return api.changeGallery(gallery.kind, gallery.recordId, parsed.data);
    },
    onSuccess: ({ gallery: next }) => {
      refresh(next);
      setMessage('Photo choices saved.');
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!uploadDraft.file) throw new Error('Choose a photo first.');
      const key = uploadDraft.operationId.current,
        blob = await preparePhoto(uploadDraft.file);
      const frozen = await uploadDraft.freeze(blob, key);
      return api.addGalleryPhoto(
        gallery.kind,
        gallery.recordId,
        frozen.key,
        frozen.file,
        form.expectedRevision,
      );
    },
    onSuccess: ({ gallery: next }) => {
      uploadDraft.clear();
      if (changed) {
        sync(next);
        setReview(next);
        setMessage(
          'Photo saved. Your caption draft is kept above; compare saved photos before replacing it.',
        );
      } else {
        refresh(next);
        setUploadMessage('Photo saved. It is now the cover unless that choice changed elsewhere.');
      }
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      api.removeGalleryPhoto(gallery.kind, gallery.recordId, removing!, form.expectedRevision),
    onSuccess: ({ gallery: next }) => {
      setRemoving(null);
      refresh(next);
      setMessage('Original and its captions/arrows removed.');
    },
  });
  const reload = useMutation({
    mutationFn: () => api.gallery(gallery.kind, gallery.recordId),
    onSuccess: ({ gallery: next }) => setReview(next),
  });
  const busy = save.isPending || upload.isPending || remove.isPending;
  useImperativeHandle(ref, () => ({
    requestClose: () => {
      if (busy) return;
      if (changed || uploadDraft.file || draft.form.previous) setConfirm('leave');
      else onClose();
    },
  }));
  function applySaved() {
    if (!review) return;
    const current = metadata(review),
      nextDraft = { current, previous: changed ? form : draft.form.previous };
    draft.checkpoint(nextDraft);
    setSaved(current);
    client.setQueryData(['photo-gallery', gallery.kind, gallery.recordId], { gallery: review });
    setReview(null);
    setConfirm(null);
    save.reset();
    upload.reset();
    remove.reset();
    setMessage('Saved photos loaded. Any replaced draft is kept below.');
  }
  const error = save.error?.message || reload.error?.message;
  return (
    <>
      <fieldset className="gallery-editor-fields" disabled={busy}>
        <legend className="sr-only">Photo captions, order and cover</legend>
        <label className="gallery-cover-choice">
          <input
            type="radio"
            name={`cover-${gallery.kind}-${gallery.recordId}`}
            checked={form.coverId === null}
            onChange={() => edit({ coverId: null })}
          />
          No cover selected
        </label>
        <ol className="gallery-entries">
          {form.entries.map((entry, index) => {
            const original = source.get(entry.id);
            return (
              <li key={entry.id}>
                <div className="gallery-photo-heading">
                  <h3>Photo {index + 1}</h3>
                  <label className="gallery-cover-choice">
                    <input
                      type="radio"
                      name={`cover-${gallery.kind}-${gallery.recordId}`}
                      checked={form.coverId === entry.id}
                      disabled={!original?.available}
                      onChange={() => edit({ coverId: entry.id })}
                    />
                    Use as cover
                  </label>
                </div>
                {original?.available ? (
                  <GalleryPhoto
                    kind={gallery.kind}
                    recordId={gallery.recordId}
                    entry={entry}
                    number={index + 1}
                  />
                ) : (
                  <p className="gallery-unavailable">
                    Original unavailable. This caption and its arrows are kept for recovery; a records-only
                    backup does not contain image files.
                  </p>
                )}
                <label>
                  Caption for photo {index + 1}
                  <textarea
                    aria-label={`Caption for photo ${index + 1}`}
                    value={entry.caption}
                    maxLength={500}
                    onChange={(e) => update(entry.id, { caption: e.target.value })}
                  />
                </label>
                <div className="gallery-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={index === 0}
                    aria-label={`Move photo ${index + 1} earlier`}
                    onClick={() => {
                      const entries = [...form.entries];
                      [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
                      edit({ entries });
                    }}
                  >
                    Earlier
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={index === form.entries.length - 1}
                    aria-label={`Move photo ${index + 1} later`}
                    onClick={() => {
                      const entries = [...form.entries];
                      [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
                      edit({ entries });
                    }}
                  >
                    Later
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={changed || !online}
                    aria-label={`Remove original photo ${index + 1}`}
                    onClick={() => setRemoving(entry.id)}
                  >
                    Remove original
                  </button>
                </div>
                <details className="gallery-arrows">
                  <summary>
                    Arrows <span>{entry.arrows.length}/6</span>
                  </summary>
                  <p>
                    Positions run from the left/top edge (0%) to the right/bottom edge (100%). Check the
                    preview above; labels also remain readable below it.
                  </p>
                  {entry.arrows.map((arrow, arrowIndex) => (
                    <fieldset key={arrow.id}>
                      <legend>Arrow {arrowIndex + 1}</legend>
                      <label>
                        Arrow label {arrowIndex + 1} for photo {index + 1}
                        <input
                          value={arrow.label}
                          maxLength={120}
                          onChange={(e) =>
                            update(entry.id, {
                              arrows: entry.arrows.map((a) =>
                                a.id === arrow.id ? { ...a, label: e.target.value } : a,
                              ),
                            })
                          }
                        />
                      </label>
                      <div className="gallery-coordinate-grid">
                        {(
                          [
                            ['fromX', 'Start across'],
                            ['fromY', 'Start down'],
                            ['toX', 'End across'],
                            ['toY', 'End down'],
                          ] as const
                        ).map(([field, label]) => (
                          <label key={field}>
                            {label} · {Math.round(arrow[field] * 100)}%
                            <input
                              aria-label={`${label} for arrow ${arrowIndex + 1} on photo ${index + 1}`}
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={Math.round(arrow[field] * 100)}
                              onChange={(e) =>
                                update(entry.id, {
                                  arrows: entry.arrows.map((a) =>
                                    a.id === arrow.id ? { ...a, [field]: Number(e.target.value) / 100 } : a,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() =>
                          update(entry.id, { arrows: entry.arrows.filter((a) => a.id !== arrow.id) })
                        }
                      >
                        Remove arrow {arrowIndex + 1}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={entry.arrows.length >= 6 || !original?.available}
                    onClick={() =>
                      update(entry.id, {
                        arrows: [
                          ...entry.arrows,
                          { id: crypto.randomUUID(), fromX: 0.2, fromY: 0.2, toX: 0.7, toY: 0.7, label: '' },
                        ],
                      })
                    }
                  >
                    Add arrow to photo {index + 1}
                  </button>
                </details>
              </li>
            );
          })}
        </ol>
        {!form.entries.length && <p>No saved photos yet. Add an original below.</p>}
      </fieldset>
      <div className="gallery-actions">
        <button
          type="button"
          className="button button-accent"
          disabled={!changed || busy || !online}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save photo choices'}
        </button>
        <button
          type="button"
          className="button button-outline"
          disabled={busy || reload.isPending || !online}
          onClick={() => reload.mutate()}
        >
          Load saved photos to compare
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {changed && <p>Save captions, arrows and order before adding or removing originals.</p>}
      {error && <p role="alert">{error} Your photo draft is kept.</p>}
      {review && (
        <section className="gallery-review" aria-label="Current saved photo choices">
          <h3>Currently saved</h3>
          <p>{review.entries.length} photos. Your draft is still above.</p>
          <ol>
            {review.entries.map((entry, index) => (
              <li key={entry.id}>
                Photo {index + 1}
                {review.coverId === entry.id ? ' · Cover' : ''}
                <p>{entry.caption || 'No caption'}</p>
                {entry.arrows.map((arrow, i) => (
                  <p key={arrow.id}>
                    Arrow {i + 1}: {arrow.label || 'No label'}
                  </p>
                ))}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="button button-outline"
            onClick={() => (changed ? setConfirm('reload') : applySaved())}
          >
            Use saved photo choices
          </button>
        </section>
      )}
      <PhotoComparison gallery={gallery} />
      <section className="gallery-upload" aria-label="Add an original photo">
        <h3>Add a photo</h3>
        <p>
          New uploads start as the cover. Earlier photos stay in this gallery. Saved sources use Worth’s
          upload size limit; captions and annotations never alter them.
        </p>
        <DraftPhoto
          file={uploadDraft.file}
          helper="Choose the upload button to send or retry this selected file. It can recover on this account/device for seven days when storage is available."
          onChange={(file) => {
            uploadDraft.change(file);
            setUploadMessage('');
            upload.reset();
          }}
          disabled={busy || changed || !uploadDraft.ready}
        />
        <p role="status">{uploadDraft.status}</p>
        <button
          type="button"
          className="button button-outline"
          disabled={
            !uploadDraft.file ||
            busy ||
            (changed && !savedUpload) ||
            !online ||
            (form.entries.length >= 12 && !savedUpload)
          }
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? 'Uploading…' : savedUpload ? 'Retry exact upload' : 'Upload selected photo'}
        </button>
        {upload.error && <p role="alert">{upload.error.message} Your photo draft is kept.</p>}
        {uploadMessage && <p role="status">{uploadMessage}</p>}
      </section>
      {draft.form.previous && (
        <details className="gallery-previous">
          <summary>Previous replaced draft</summary>
          <p>
            One previous draft is kept on this account/device for seven days when storage is available. Copy
            anything you want to reuse before replacing it again.
          </p>
          <ol>
            {draft.form.previous.entries.map((entry, index) => (
              <li key={entry.id}>
                Photo {index + 1}
                <p>{entry.caption || 'No caption'}</p>
                {entry.arrows.map((arrow, i) => (
                  <p key={arrow.id}>
                    Arrow {i + 1}: {arrow.label || 'No label'} · start {Math.round(arrow.fromX * 100)}%,{' '}
                    {Math.round(arrow.fromY * 100)}%; end {Math.round(arrow.toX * 100)}%,{' '}
                    {Math.round(arrow.toY * 100)}%
                  </p>
                ))}
              </li>
            ))}
          </ol>
          <button type="button" className="button button-outline" onClick={() => setConfirm('previous')}>
            Discard previous draft
          </button>
        </details>
      )}
      <p role="status">
        {draft.status || 'Photo choices can recover on this account/device for seven days.'}
      </p>
      {!online && (
        <p role="status">You are offline. Keep editing this device draft, then reconnect before saving.</p>
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this original photo?"
          description="This permanently removes this saved source and its caption/arrows. If it is the cover, the cover is cleared. Other photos and the record stay intact."
          confirmLabel="Remove original"
          pending={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate()}
          onClose={() => setRemoving(null)}
        />
      )}
      {confirm === 'leave' && (
        <ConfirmDialog
          title="Leave these photo drafts?"
          description="Drafts can recover for seven days when device storage is available. If storage is blocked, copy captions and keep your source file before leaving."
          confirmLabel="Leave photos"
          onConfirm={onClose}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'reload' && (
        <ConfirmDialog
          title="Start from the saved photo choices?"
          description="Your current captions, arrows and order will be kept as one previous draft on this device. An earlier previous draft will be replaced; copy it first if needed."
          confirmLabel="Use saved choices"
          onConfirm={applySaved}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'previous' && (
        <ConfirmDialog
          title="Discard the previous draft?"
          description="This clears only the previous device draft. Saved photos and your current draft stay intact."
          confirmLabel="Discard previous draft"
          onConfirm={() => {
            draft.setForm({ ...draft.form, previous: null });
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}
