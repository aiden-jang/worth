import { useEffect, useRef, useState } from 'react';
import { renderRankingImage, saveRankingImage, type RankingImage } from '../shared/ranking-image';

function canShare(file: File): boolean {
  try {
    return !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

export function RankingImageExport({ data }: { data: RankingImage }) {
  const [ready, setReady] = useState<{ data: RankingImage; file: File; url: string } | null>(null);
  const [failed, setFailed] = useState<RankingImage | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  const current = ready?.data === data ? ready : null;
  const error = failed === data;

  useEffect(() => {
    let active = true;
    let url: string | undefined;
    setMessage('');
    if (!data.entries.length) return;
    // Preparing ahead of the click preserves the native share gesture and the exact preview.
    void renderRankingImage(data)
      .then((blob) => {
        if (!active) return;
        const name =
          data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 64) || 'ranking';
        const file = new File([blob], `worth-${name}-${new Date().toISOString().slice(0, 10)}.png`, {
          type: 'image/png',
        });
        url = URL.createObjectURL(file);
        setReady({ data, file, url });
      })
      .catch(() => {
        if (active) setFailed(data);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data, attempt]);

  return (
    <section className="ranking-image-export" aria-label="Ranking image">
      <details className="ranking-image-preview">
        <summary>Preview image</summary>
        {current ? (
          <img src={current.url} alt={`Ranking image for ${data.title}`} width={1080} />
        ) : (
          <p>
            {error
              ? 'Image preview is unavailable.'
              : data.entries.length
                ? 'Preparing image…'
                : 'Rank an item first.'}
          </p>
        )}
      </details>
      <p className="share-explainer">
        Image: collection name, up to five ranked titles and types, and built-in artwork when available.
        Private photos stay out. Downloaded images cannot be revoked.
      </p>
      <div className="ranking-image-actions">
        {error ? (
          <button
            className="button button-outline"
            onClick={() => {
              setFailed(null);
              setMessage('');
              setAttempt((value) => value + 1);
            }}
          >
            Retry image
          </button>
        ) : (
          <button
            className="button button-outline"
            disabled={!current || busy}
            onClick={() => {
              if (!current) return;
              try {
                saveRankingImage(current.file);
                setMessage('Download started.');
              } catch {
                setMessage('Couldn’t save the image. Try again.');
              }
            }}
          >
            {!current && data.entries.length ? 'Preparing image…' : 'Save ranking image'}
          </button>
        )}
        {current && canShare(current.file) && (
          <button
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={async () => {
              if (sharing.current || !current) return;
              sharing.current = true;
              setBusy(true);
              setMessage('');
              try {
                await navigator.share({ files: [current.file] });
                setMessage('Image handed to the share sheet.');
              } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError'))
                  setMessage('Couldn’t share the image. Try again, or save it instead.');
              } finally {
                sharing.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? 'Opening share sheet…' : 'Share ranking image'}
          </button>
        )}
      </div>
      {error && <p role="alert">Couldn’t prepare the image. Try again.</p>}
      <p role="status">{message}</p>
    </section>
  );
}
