import { useEffect, useRef, useState } from 'react';
import { renderRankingImage, type RankingImage } from '../shared/ranking-image';

export function RankingImageShare({ data }: { data: RankingImage }) {
  const [ready, setReady] = useState<{ data: RankingImage; file: File } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  useEffect(() => {
    let active = true;
    setMessage('');
    if (!navigator.share || !navigator.canShare || !data.entries.length) return;
    // Prepare before the click so image rendering cannot consume the share gesture.
    void renderRankingImage(data)
      .then((blob) => {
        const name =
          data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 64) || 'ranking';
        const file = new File([blob], `worth-${name}-${new Date().toISOString().slice(0, 10)}.png`, {
          type: 'image/png',
        });
        if (active && navigator.canShare({ files: [file] })) setReady({ data, file });
      })
      .catch(() => {
        // Download remains available when preparing a native share is unsupported.
      });
    return () => {
      active = false;
    };
  }, [data]);
  if (!ready || ready.data !== data) return null;
  return (
    <div>
      <button
        type="button"
        className="button button-outline"
        disabled={busy}
        onClick={async () => {
          if (sharing.current) return;
          sharing.current = true;
          setBusy(true);
          setMessage('');
          try {
            await navigator.share({ files: [ready.file] });
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
      <p role="status">{message}</p>
    </div>
  );
}
