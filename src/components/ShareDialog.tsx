import { Check, Copy, LinkSimple, X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { Item, ListDetail } from '../shared/models';
import { rankedItems } from '../shared/ranking';
import { ConfirmDialog } from './ConfirmDialog';
import { RankingImageExport } from './RankingImageExport';

function expiryLabel(expiresAt: number): string {
  const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function ShareDialog({
  list,
  items,
  onClose,
}: {
  list: ListDetail;
  items: Item[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [limit, setLimit] = useState<5 | 10 | 'all'>(5);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [shareToRevoke, setShareToRevoke] = useState<string | null>(null);
  const shares = useQuery({ queryKey: ['shares', list.id], queryFn: () => api.shares(list.id) });
  const ranked = useMemo(() => rankedItems(list, items), [list, items]);
  const preview = useMemo(() => (limit === 'all' ? ranked : ranked.slice(0, limit)), [limit, ranked]);
  const imageData = useMemo(
    () => ({
      title: list.name,
      artwork: list.artwork,
      entries: preview.slice(0, 5).map(({ title, type }) => ({ title, type })),
    }),
    [list.name, list.artwork, preview],
  );
  const activeShares = (shares.data?.shares ?? []).filter(
    (share) => !share.revokedAt && share.expiresAt > Date.now(),
  );
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  const create = useMutation({
    mutationFn: () => api.createShare(list.id, limit),
    onSuccess: ({ token }) => {
      setLink(`${window.location.origin}/s/${token}`);
      void client.invalidateQueries({ queryKey: ['shares', list.id] });
    },
  });
  const revoke = useMutation({
    mutationFn: api.revokeShare,
    onSuccess: () => {
      setShareToRevoke(null);
      void client.invalidateQueries({ queryKey: ['shares', list.id] });
    },
  });

  async function copy() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError('Couldn’t copy the link. Select it above and copy it manually, or try again.');
    }
  }

  return (
    <dialog
      className="share-dialog"
      aria-labelledby="share-dialog-title"
      ref={dialog}
      onClose={(event) => {
        event.stopPropagation();
        // Ignore close events queued by Strict Mode cleanup if the dialog reopened.
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (create.isPending || revoke.isPending) event.preventDefault();
      }}
      onClick={(event) => {
        if (!create.isPending && !revoke.isPending && event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="share-inner">
        <div className="editor-head">
          <div>
            <p className="overline">SHARE A RANKING</p>
            <h2 id="share-dialog-title">{list.name}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close"
            disabled={create.isPending || revoke.isPending}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <p className="share-explainer">
          Links include the collection name and ranked titles and types. Calls, notes, photos, dates, and
          history stay private.
        </p>
        <label className="share-limit">
          Include
          <select
            value={limit}
            disabled={create.isPending}
            onChange={(event) => {
              const value = event.target.value;
              setLimit(value === 'all' ? 'all' : value === '10' ? 10 : 5);
              setLink('');
              setCopied(false);
              setCopyError('');
            }}
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value="all">Full ranking</option>
          </select>
        </label>
        <div className="share-preview">
          <span className="overline">LINK PREVIEW</span>
          <h3>{list.name}</h3>
          {preview.map((item, index) => (
            <div key={item.id}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <span>
                {item.title}
                {item.type && <small>{item.type}</small>}
              </span>
            </div>
          ))}
          {!preview.length && <p>Rank an item first, then it can appear here.</p>}
        </div>
        <RankingImageExport data={imageData} />
        {link ? (
          <div className="created-link">
            <p>
              <Check size={17} /> Link ready. It expires in 7 days.
            </p>
            <div>
              <input
                readOnly
                aria-label="Share link"
                value={link}
                onFocus={(event) => event.target.select()}
              />
              <button className="button button-dark" onClick={() => void copy()}>
                <Copy size={17} /> {copied ? 'Link copied' : 'Copy link'}
              </button>
            </div>
            <small>This link only appears once. Make another if you lose it.</small>
            {copyError && (
              <p className="form-error" role="alert">
                {copyError}
              </p>
            )}
          </div>
        ) : (
          <button
            className="button button-accent share-create"
            disabled={!preview.length || create.isPending}
            onClick={() => create.mutate()}
          >
            <LinkSimple size={18} /> Create link
          </button>
        )}
        {create.isError && (
          <p className="form-error" role="alert">
            {create.error.message}
          </p>
        )}
        {shares.isPending && <p role="status">Opening active links…</p>}
        {shares.isError && (
          <div className="form-error" role="alert">
            <p>Couldn’t open your active links. Try again to review or revoke them.</p>
            <button
              className="button button-outline"
              disabled={shares.isFetching}
              onClick={() => void shares.refetch()}
            >
              Try again
            </button>
          </div>
        )}
        {!!activeShares.length && (
          <div className="active-shares">
            <h3>Active links</h3>
            {activeShares.map((share) => (
              <div key={share.id}>
                <span>
                  {share.title}
                  <small>{expiryLabel(share.expiresAt)}</small>
                </span>
                <button
                  className="text-danger"
                  disabled={revoke.isPending}
                  onClick={() => setShareToRevoke(share.id)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        {revoke.isError && (
          <p className="form-error" role="alert">
            {revoke.error.message}
          </p>
        )}
      </div>
      {shareToRevoke && (
        <ConfirmDialog
          eyebrow="REVOKE LINK"
          title="Revoke this shared ranking?"
          description="Anyone with this link will lose access immediately. You can always create a new link later."
          confirmLabel="Revoke link"
          pending={revoke.isPending}
          error={revoke.isError ? revoke.error.message : undefined}
          onConfirm={() => revoke.mutate(shareToRevoke)}
          onClose={() => setShareToRevoke(null)}
        />
      )}
    </dialog>
  );
}
