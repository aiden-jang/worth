import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cropCover } from '../shared/cover-crop';

export function CoverCrop({
  file,
  onSave,
  onClose,
}: {
  file: File;
  onSave: (file: File) => Promise<unknown>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const [source, setSource] = useState('');
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50, zoom: 1 });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    heading.current?.focus({ preventScroll: true });
    if (node) node.scrollTop = 0;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return () => node?.close();
    }
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => {
      node?.close();
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return createPortal(
    <dialog
      ref={dialog}
      className="editor-dialog cover-crop-dialog"
      aria-labelledby={titleId}
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (pending) event.preventDefault();
      }}
    >
      <form
        className="editor-form cover-crop-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || pending) return;
          setPending(true);
          setError('');
          void cropCover(file, position.x, position.y, position.zoom)
            .then(onSave)
            .then(onClose)
            .catch((failure: unknown) => {
              setError(failure instanceof Error ? failure.message : 'Couldn’t save the cover. Try again.');
            })
            .finally(() => setPending(false));
        }}
      >
        <header>
          <p className="overline">COLLECTION COVER</p>
          <h2 ref={heading} tabIndex={-1} id={titleId}>
            Frame your cover.
          </h2>
        </header>
        <p className="muted">Adjust the crop before uploading. Your current cover stays until you save.</p>
        <div className="cover-crop-preview">
          {source && (
            <img
              src={source}
              alt="Cover crop preview"
              onLoad={() => setReady(true)}
              onError={() => setError('Couldn’t read this image. Try another one.')}
              style={{
                objectPosition: `${position.x}% ${position.y}%`,
                transform: `scale(${position.zoom})`,
                transformOrigin: `${position.x}% ${position.y}%`,
              }}
            />
          )}
        </div>
        {(['x', 'y', 'zoom'] as const).map((key) => (
          <label key={key} className="cover-crop-range">
            <span>{key === 'x' ? 'Horizontal position' : key === 'y' ? 'Vertical position' : 'Zoom'}</span>
            <input
              type="range"
              min={key === 'zoom' ? 1 : 0}
              max={key === 'zoom' ? 3 : 100}
              step={key === 'zoom' ? 0.05 : 1}
              value={position[key]}
              disabled={pending || !ready}
              onChange={(event) => setPosition({ ...position, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button className="button button-accent" disabled={pending || !ready}>
            {pending ? 'Saving cover…' : 'Save cover'}
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
