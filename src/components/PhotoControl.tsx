import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash } from '@phosphor-icons/react';
import { api } from '../api';

async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size <= 3 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('This photo could not be prepared. Try another one.'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!compressed || compressed.size > 3 * 1024 * 1024) throw new Error('This photo is still too large. Try a smaller one.');
  return compressed;
}

export function PhotoControl({ kind, id, hasPhoto, version, listId }: {
  kind: 'items' | 'logs'; id: string; hasPhoto: boolean; version: number; listId: string;
}) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const upload = useMutation({ mutationFn: async (file: File) => api.uploadPhoto(kind, id, await preparePhoto(file)),
    onSuccess: () => { setError(''); void client.invalidateQueries({ queryKey: [kind, listId] });
      void client.invalidateQueries({ queryKey: ['overview'] }); },
    onError: (failure) => setError(failure.message),
  });
  const remove = useMutation({ mutationFn: () => api.deletePhoto(kind, id), onSuccess: () => {
    void client.invalidateQueries({ queryKey: [kind, listId] });
    void client.invalidateQueries({ queryKey: ['overview'] });
  }, onError: (failure) => setError(failure.message) });

  return <div className="photo-control">
    {hasPhoto && <img src={`/api/${kind}/${id}/photo?v=${version}`} alt="Your uploaded memory" />}
    <div className="photo-actions"><label className="button button-outline"><Camera size={17} /> {hasPhoto ? 'Replace photo' : 'Add a photo'}
      <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={upload.isPending}
        onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); event.target.value = ''; }} />
    </label>{hasPhoto && <button className="icon-button" aria-label="Remove photo" disabled={remove.isPending}
      onClick={() => { if (window.confirm('Remove this photo?')) remove.mutate(); }}><Trash size={18} /></button>}</div>
    {upload.isPending && <p className="muted">Uploading photo…</p>}
    {error && <p className="form-error">{error}</p>}
  </div>;
}
