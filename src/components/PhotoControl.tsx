import { Camera, Trash } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useRef, useState } from 'react';
const PhotoGallery = lazy(() =>
  import('./PhotoGallery').then((module) => ({ default: module.PhotoGallery })),
);
import { api } from '../api';
import type { CollectionArt } from '../shared/models';
import { preparePhoto } from '../shared/photos';
import { starterCollectionCover } from '../shared/starter-covers';
import { ConfirmDialog } from './ConfirmDialog';

export function PhotoControl({
  kind,
  id,
  hasPhoto,
  version,
}: {
  kind: 'items' | 'logs';
  id: string;
  hasPhoto: boolean;
  version: number;
}) {
  const controls = useRef<HTMLDivElement>(null),
    manage = useRef<HTMLButtonElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  return (
    <div className="photo-control" ref={controls}>
      {hasPhoto && <img src={`/api/${kind}/${id}/photo?v=${version}`} alt="Your uploaded cover photo" />}
      <div className="photo-actions">
        <p className="photo-state">{hasPhoto ? 'Private cover photo' : 'No cover image available'}</p>
        <button
          type="button"
          className="button button-outline"
          ref={manage}
          onClick={() => setGalleryOpen(true)}
        >
          <Camera size={17} />
          Manage photos
        </button>
      </div>
      {galleryOpen && (
        <Suspense fallback={<p role="status">Opening photo controls…</p>}>
          <PhotoGallery
            kind={kind}
            id={id}
            onClose={() => {
              const disclosure = controls.current?.closest('details');
              if (disclosure) disclosure.open = true;
              setGalleryOpen(false);
              requestAnimationFrame(() => manage.current?.focus());
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

export function CollectionCoverControl({
  listId,
  listName,
  artwork,
  hasCoverPhoto,
  version,
}: {
  listId: string;
  listName: string;
  artwork?: CollectionArt | null;
  hasCoverPhoto: boolean;
  version: number;
}) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const upload = useMutation({
    mutationFn: async (file: File) => api.uploadListCover(listId, await preparePhoto(file)),
    onSuccess: () => {
      setError('');
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (failure) => setError(failure.message),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteListCover(listId),
    onSuccess: () => {
      setConfirmingRemoval(false);
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (failure) => setError(failure.message),
  });
  const starterCover = hasCoverPhoto ? null : starterCollectionCover(listName, artwork);
  const coverSource = hasCoverPhoto ? `/api/lists/${listId}/cover?v=${version}` : starterCover;
  const coverState = hasCoverPhoto
    ? 'Private cover'
    : starterCover
      ? 'Collection artwork'
      : 'No cover attached';

  return (
    <section className="collection-cover-control" aria-label="Collection cover">
      <div>
        <p className="overline">COLLECTION COVER</p>
        <p>
          {hasCoverPhoto
            ? 'A private cover for this collection.'
            : starterCover
              ? 'Your artwork is showing. You can use a private photo instead.'
              : 'Add an optional private cover photo.'}
        </p>
      </div>
      {coverSource && (hasCoverPhoto || !artwork) && <img src={coverSource} alt="Collection cover" />}
      <div className="photo-actions">
        <p className="photo-state">{coverState}</p>
        <div className="photo-buttons">
          <label className="button button-outline">
            <Camera size={17} />{' '}
            {hasCoverPhoto ? 'Replace cover' : starterCover ? 'Use my photo' : 'Add a cover'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="photo-file-input"
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
          </label>
          {hasCoverPhoto && (
            <button
              className="icon-button"
              aria-label="Remove collection cover"
              disabled={remove.isPending}
              onClick={() => setConfirmingRemoval(true)}
            >
              <Trash size={18} />
            </button>
          )}
        </div>
      </div>
      {upload.isPending && (
        <p className="muted" role="status">
          Uploading cover…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {confirmingRemoval && (
        <ConfirmDialog
          eyebrow="REMOVE COVER"
          title="Remove this collection cover?"
          description="This permanently removes the private cover image. Your collection and records stay intact."
          confirmLabel="Remove cover"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmingRemoval(false)}
        />
      )}
    </section>
  );
}
