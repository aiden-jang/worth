import { X } from '@phosphor-icons/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api';
import { useAccountId } from '../hooks/useAccountId';
import {
  defaultSnapshotSelection,
  sourceReviewHash,
  type SourcePreview,
  type SourceSelection,
  type SnapshotField,
} from '../shared/record-snapshots';
import { AnnotatedPhoto } from './AnnotatedPhoto';
import { SnapshotProjection } from './SnapshotProjection';
const names: Record<SnapshotField, string> = {
  type: 'Type',
  decision: 'Personal call',
  rank: 'Collection rank',
  dates: 'Recorded dates',
  results: 'Recorded measurements',
  note: 'Private note',
};
export function CapsuleSourceReview({
  reference,
  mode = 'capsule',
  initial,
  maxPhotos,
  onUse,
  onClose,
}: {
  reference: { kind: 'item' | 'log'; id: string };
  mode?: 'capsule' | 'share';
  initial?: SourcePreview;
  maxPhotos: number;
  onUse: (preview: SourcePreview) => void;
  onClose: () => void;
}) {
  const owner = useAccountId(),
    dialog = useRef<HTMLDialogElement>(null),
    heading = useId(),
    live = useRef(true);
  const [selection, setSelection] = useState<SourceSelection>(
    initial?.selection ?? defaultSnapshotSelection(reference),
  );
  const [preview, setPreview] = useState<SourcePreview | null>(initial ?? null);
  const allowed: SnapshotField[] =
    reference.kind === 'item' ? ['type', 'decision', 'rank', 'dates', 'note'] : ['dates', 'results', 'note'];
  const kind = reference.kind === 'item' ? 'items' : 'logs';
  const gallery = useQuery({
    queryKey: ['capsule-source-gallery', owner, kind, reference.id],
    enabled: mode === 'capsule',
    queryFn: () => api.gallery(kind, reference.id),
  });
  useEffect(() => {
    live.current = true;
    const node = dialog.current;
    node?.showModal();
    return () => {
      live.current = false;
      node?.close();
    };
  }, []);
  const review = useMutation({
    mutationFn: async () => {
      const { preview } = await api.capsulePreview(selection);
      if ((await sourceReviewHash(preview)) !== preview.hash)
        throw new Error('This source preview could not be verified. Read the saved source again.');
      return preview;
    },
    onSuccess: (result) => {
      if (live.current) setPreview(result);
    },
  });
  const { mutate: readSource } = review;
  useEffect(() => {
    if (!initial) readSource();
  }, [initial, readSource]);
  const exact =
    !!preview &&
    JSON.stringify(selection) === JSON.stringify(preview.selection) &&
    selection.photoIds.length <= maxPhotos;
  const available = new Set(
    gallery.data?.gallery.entries.filter((entry) => entry.source.available).map((entry) => entry.id) ?? [],
  );
  return (
    <dialog
      ref={dialog}
      className="editor-dialog capsule-source-dialog"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dialog.current?.close();
      }}
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">COPY ONLY WHAT YOU CHOOSE</p>
            <h2 id={heading}>Review this snapshot</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close snapshot review"
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <p>
          Names are always copied. Choose the other fields to copy. Your original record stays unchanged.
          {mode === 'share' && ' Only these selected text fields will be shared. Photos stay private.'}
        </p>
        <fieldset className="capsule-field-choices" disabled={review.isPending}>
          <legend>Snapshot fields</legend>
          {allowed.map((field) => (
            <label className="capsule-check" key={field}>
              <input
                type="checkbox"
                checked={selection.fields.includes(field)}
                onChange={(event) => {
                  const chosen = new Set(selection.fields);
                  if (event.target.checked) chosen.add(field);
                  else chosen.delete(field);
                  setSelection({ ...selection, fields: allowed.filter((field) => chosen.has(field)) });
                }}
              />
              Include {names[field].toLowerCase()}
            </label>
          ))}
        </fieldset>
        {mode === 'capsule' && (
          <details className="record-extras">
            <summary>
              Source photos <span>optional</span>
            </summary>
            <p>
              Choose up to {maxPhotos} here. A capsule keeps up to four photo copies across all its snapshots.
              Captions and arrows are copied too.
            </p>
            {gallery.isPending && <p role="status">Loading source photos…</p>}
            {gallery.isError && (
              <p role="alert" className="error-banner">
                {gallery.error.message}
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => void gallery.refetch()}
                >
                  Retry source photos
                </button>
              </p>
            )}
            {gallery.data?.gallery.entries.length === 0 && <p>This record has no photos.</p>}
            <div className="capsule-photo-choices">
              {gallery.data?.gallery.entries.map((entry, index) => (
                <section key={entry.id}>
                  <label className="capsule-check">
                    <input
                      type="checkbox"
                      checked={selection.photoIds.includes(entry.id)}
                      disabled={
                        review.isPending ||
                        !entry.source.available ||
                        (!selection.photoIds.includes(entry.id) && selection.photoIds.length >= maxPhotos)
                      }
                      onChange={(event) =>
                        setSelection({
                          ...selection,
                          photoIds: event.target.checked
                            ? [...selection.photoIds, entry.id]
                            : selection.photoIds.filter((id) => id !== entry.id),
                        })
                      }
                    />
                    Include source photo {index + 1}
                  </label>
                  {entry.source.available ? (
                    <AnnotatedPhoto
                      src={`/api/${kind}/${reference.id}/photos/${entry.id}`}
                      entry={entry}
                      number={index + 1}
                      showCaption
                    />
                  ) : (
                    <p>Original image unavailable. Its caption and arrows remain in your archive.</p>
                  )}
                </section>
              ))}
            </div>
            {!!selection.photoIds.length && (
              <button
                type="button"
                className="button button-outline"
                disabled={review.isPending}
                onClick={() => setSelection({ ...selection, photoIds: [] })}
              >
                Keep this snapshot without photos
              </button>
            )}
            {gallery.data && selection.photoIds.some((id) => !available.has(id)) && (
              <p>
                A chosen original is no longer available. Choose this snapshot without photos, or review the
                source in your archive.
              </p>
            )}
          </details>
        )}
        <button
          type="button"
          className="button button-outline"
          disabled={review.isPending}
          onClick={() => review.mutate()}
        >
          {review.isPending ? 'Reading source…' : 'Review chosen fields and photos'}
        </button>
        {review.isError && (
          <p className="form-error" role="alert">
            {review.error.message}
          </p>
        )}
        {preview && (
          <>
            <SnapshotProjection label="Snapshot preview" data={preview.data} listName={preview.listName} />
            <div className="capsule-review-photos">
              {preview.photos.map((photo, index) => (
                <AnnotatedPhoto
                  key={photo.id}
                  src={`/api/${kind}/${reference.id}/photos/${photo.id}`}
                  entry={photo}
                  number={index + 1}
                  showCaption
                />
              ))}
            </div>
          </>
        )}
        {!exact && preview && (
          <p role="status">Choices changed. Review them again before keeping this snapshot.</p>
        )}
        <button
          type="button"
          className="button button-accent"
          disabled={!exact || review.isPending || review.isError}
          onClick={() => {
            if (preview) onUse(preview);
          }}
        >
          Keep reviewed snapshot
        </button>
      </div>
    </dialog>
  );
}
