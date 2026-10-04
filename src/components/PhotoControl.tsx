import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash } from '@phosphor-icons/react';
import { api } from '../api';
import { ConfirmDialog } from './ConfirmDialog';

async function preparePhoto(file: File): Promise<Blob> {
  const maxBytes = 900_000;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size <= maxBytes) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This photo could not be prepared. Try another one.');
  }
  try {
    for (const [maxSide, quality] of [
      [1200, 0.78],
      [950, 0.68],
      [750, 0.55],
    ]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      );
      if (compressed && compressed.size <= maxBytes) return compressed;
    }
    throw new Error('This photo is still too large. Try a smaller one.');
  } finally {
    bitmap.close();
  }
}

export function PhotoControl({
  kind,
  id,
  hasPhoto,
  version,
  listId,
}: {
  kind: 'items' | 'logs';
  id: string;
  hasPhoto: boolean;
  version: number;
  listId: string;
}) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const upload = useMutation({
    mutationFn: async (file: File) => api.uploadPhoto(kind, id, await preparePhoto(file)),
    onSuccess: () => {
      setError('');
      void client.invalidateQueries({ queryKey: [kind, listId] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (failure) => setError(failure.message),
  });
  const remove = useMutation({
    mutationFn: () => api.deletePhoto(kind, id),
    onSuccess: () => {
      setConfirmingRemoval(false);
      void client.invalidateQueries({ queryKey: [kind, listId] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (failure) => setError(failure.message),
  });

  return (
    <div className="photo-control">
      {hasPhoto && <img src={`/api/${kind}/${id}/photo?v=${version}`} alt="Your uploaded memory" />}
      <div className="photo-actions">
        <p className="photo-state">{hasPhoto ? 'Private photo' : 'No photo attached'}</p>
        <div className="photo-buttons">
          <label className="button button-outline">
            <Camera size={17} /> {hasPhoto ? 'Replace photo' : 'Add a photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
          </label>
          {hasPhoto && (
            <button
              className="icon-button"
              aria-label="Remove photo"
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
          Uploading photo…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {confirmingRemoval && (
        <ConfirmDialog
          eyebrow="REMOVE PHOTO"
          title="Remove this photo?"
          description="This permanently removes the private photo from this record. The record and its notes stay intact."
          confirmLabel="Remove photo"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmingRemoval(false)}
        />
      )}
    </div>
  );
}

export function CollectionCoverControl({
  listId,
  hasCoverPhoto,
  version,
}: {
  listId: string;
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

  return (
    <section className="collection-cover-control" aria-label="Collection cover">
      <div>
        <p className="overline">COLLECTION COVER</p>
        <p>
          {hasCoverPhoto ? 'A private cover for this collection.' : 'Add an optional private cover photo.'}
        </p>
      </div>
      {hasCoverPhoto && <img src={`/api/lists/${listId}/cover?v=${version}`} alt="Collection cover" />}
      <div className="photo-actions">
        <p className="photo-state">{hasCoverPhoto ? 'Private cover' : 'No cover attached'}</p>
        <div className="photo-buttons">
          <label className="button button-outline">
            <Camera size={17} /> {hasCoverPhoto ? 'Replace cover' : 'Add a cover'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
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
