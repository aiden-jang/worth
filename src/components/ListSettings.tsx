import { X } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { CollectionArt } from '../shared/models';
import { CollectionArtworkPicker } from './CollectionArtworkPicker';
import { ConfirmDialog } from './ConfirmDialog';
import { CollectionCoverControl } from './PhotoControl';

export function ListSettings({
  listId,
  archived = false,
  name,
  description,
  isCollection,
  artwork,
  hasCoverPhoto,
  updatedAt,
  onClose,
  onDeleted,
}: {
  listId: string;
  archived?: boolean;
  name: string;
  description: string;
  isCollection: boolean;
  artwork: CollectionArt | null;
  hasCoverPhoto: boolean;
  updatedAt: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const client = useQueryClient();
  const [nextArtwork, setNextArtwork] = useState(artwork);
  const [nextName, setNextName] = useState(name);
  const [nextDescription, setNextDescription] = useState(description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const cleanName = nextName.trim();
  const cleanDescription = nextDescription.trim();
  const hasChanges =
    cleanName !== name ||
    cleanDescription !== description ||
    JSON.stringify(nextArtwork) !== JSON.stringify(artwork);
  const update = useMutation({
    mutationFn: () =>
      api.updateList(listId, { name: cleanName, description: cleanDescription, artwork: nextArtwork }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      onClose();
    },
  });
  const archiving = useMutation({
    mutationFn: (target: boolean) => api.updateList(listId, { archived: target }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['list', listId] });
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      void client.invalidateQueries({ queryKey: ['search'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteList(listId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['lists'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      void client.invalidateQueries({ queryKey: ['patterns'] });
      onDeleted();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (cleanName && hasChanges) update.mutate();
  }

  function requestClose() {
    if (hasChanges) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  return (
    <section className="settings-panel">
      <div className="panel-title">
        <div>
          <p className="overline">LIST SETTINGS</p>
          <h2>{name}</h2>
        </div>
        <button className="icon-button" aria-label="Close settings" onClick={requestClose}>
          <X size={19} />
        </button>
      </div>
      <form onSubmit={submit} className="settings-form">
        <label>
          Name
          <input
            required
            maxLength={80}
            value={nextName}
            onChange={(event) => setNextName(event.target.value)}
            aria-describedby={update.isError ? 'list-settings-error' : undefined}
          />
        </label>
        <label>
          Description
          <input
            maxLength={280}
            value={nextDescription}
            onChange={(event) => setNextDescription(event.target.value)}
          />
        </label>
        {isCollection && (
          <CollectionArtworkPicker name={nextName} value={nextArtwork} onChange={setNextArtwork} />
        )}
        {isCollection && hasCoverPhoto && (
          <p className="muted">Your uploaded cover shows first. Artwork appears when you remove it.</p>
        )}
        <button className="button button-accent" disabled={!cleanName || !hasChanges || update.isPending}>
          Save changes
        </button>
        {update.isError && (
          <p className="form-error" id="list-settings-error" role="alert">
            {update.error.message}
          </p>
        )}
      </form>
      {isCollection && (
        <CollectionCoverControl
          listId={listId}
          listName={name}
          artwork={artwork}
          hasCoverPhoto={hasCoverPhoto}
          version={updatedAt}
        />
      )}
      {isCollection && (
        <section className="settings-archive" aria-label="Archive collection">
          <div>
            <p className="overline">{archived ? 'ARCHIVED COLLECTION' : 'ARCHIVE COLLECTION'}</p>
            <p>
              {archived
                ? 'Bring this collection back to the everyday view.'
                : 'Hide this collection from home, the sidebar and everyday collection choices. Find it under Collections → Archived or in Search.'}
            </p>
            <p className="muted">
              Records, ranks, photos and backups stay available. Existing public links keep their access and
              expiry.
            </p>
            {hasChanges && <p className="muted">Save or discard your settings changes first.</p>}
          </div>
          <button
            className="button button-outline"
            disabled={hasChanges || archiving.isPending || update.isPending || remove.isPending}
            onClick={() => archiving.mutate(!archived)}
          >
            {archiving.isPending ? 'Saving…' : archived ? 'Unarchive collection' : 'Archive collection'}
          </button>
          {archiving.isError && (
            <p className="form-error" role="alert">
              {archiving.error.message}
            </p>
          )}
        </section>
      )}
      <div className="settings-danger">
        <span>Lists and their contents can be restored from Trash for 30 days.</span>
        <button
          className="text-danger"
          disabled={remove.isPending || archiving.isPending}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete this list
        </button>
      </div>
      {remove.isError && <p className="form-error">{remove.error.message}</p>}
      {confirmingDelete && (
        <ConfirmDialog
          eyebrow="DELETE LIST"
          title={`Delete ${name}?`}
          description="This moves the list, its items, logs, routines and private photos to Trash for 30 days. Public links are revoked and stay revoked after restoring."
          confirmLabel="Delete list"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
      {confirmingDiscard && (
        <ConfirmDialog
          eyebrow="DISCARD CHANGES"
          title="Leave list settings?"
          description="Your changes to this list's name, description and artwork will be lost."
          cancelLabel="Keep editing"
          confirmLabel="Discard changes"
          onConfirm={() => {
            setConfirmingDiscard(false);
            onClose();
          }}
          onClose={() => setConfirmingDiscard(false)}
        />
      )}
    </section>
  );
}
