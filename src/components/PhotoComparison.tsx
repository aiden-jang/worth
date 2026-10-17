import { useId, useState } from 'react';
import type { PhotoGallery } from '../shared/photo-gallery';
import { useDraft } from '../hooks/useDraft';
const empty = { before: '', after: '', mode: 'slider' as 'slider' | 'side' };
function valid(value: unknown): value is typeof empty {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.before === 'string' &&
    data.before.length <= 36 &&
    typeof data.after === 'string' &&
    data.after.length <= 36 &&
    (data.mode === 'slider' || data.mode === 'side')
  );
}
export function PhotoComparison({ gallery }: { gallery: PhotoGallery }) {
  const draft = useDraft(`photo-comparison:${gallery.kind}:${gallery.recordId}`, empty, valid),
    form = draft.form;
  const [reveal, setReveal] = useState(50),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const labelId = useId();
  const selected = (id: string) => gallery.entries.find((entry) => entry.id === id && entry.source.available);
  const before = selected(form.before),
    after = selected(form.after),
    ready = !!before && !!after && before.id !== after.id;
  function change(next: Partial<typeof form>) {
    draft.setForm({ ...form, ...next });
    setFailed(false);
    setAttempt(0);
  }
  const url = (id: string) => `/api/${gallery.kind}/${gallery.recordId}/photos/${id}?r=${attempt}`;
  return (
    <details className="photo-comparison">
      <summary>Before / after comparison</summary>
      <p>
        Choose two originals and their labels yourself. Worth does not infer which came first. Different crops
        and angles may not align.
      </p>
      <div className="photo-comparison-choices">
        {(['before', 'after'] as const).map((key) => (
          <label key={key}>
            {key === 'before' ? 'Before photo' : 'After photo'}
            <select value={form[key]} onChange={(e) => change({ [key]: e.target.value })}>
              <option value="">Choose an original</option>
              {form[key] && !selected(form[key]) && (
                <option value={form[key]}>Previous original unavailable</option>
              )}
              {gallery.entries.map((entry, index) =>
                entry.source.available ? (
                  <option key={entry.id} value={entry.id}>
                    Photo {index + 1}
                    {entry.caption ? ` · ${entry.caption.slice(0, 70)}` : ''}
                  </option>
                ) : null,
              )}
            </select>
          </label>
        ))}
      </div>
      <div className="gallery-actions" role="group" aria-label="Comparison view">
        <button
          type="button"
          className="button button-outline"
          aria-pressed={form.mode === 'slider'}
          onClick={() => change({ mode: 'slider' })}
        >
          Slider
        </button>
        <button
          type="button"
          className="button button-outline"
          aria-pressed={form.mode === 'side'}
          onClick={() => change({ mode: 'side' })}
        >
          Side by side
        </button>
      </div>
      {!ready && <p>Choose two different available photos to compare.</p>}
      {before && after && ready && !failed && (
        <>
          {form.mode === 'slider' ? (
            <>
              <label className="photo-comparison-range">
                Reveal after photo
                <input
                  aria-label="Reveal after photo"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={reveal}
                  onChange={(e) => setReveal(Number(e.target.value))}
                />
              </label>
              <div className="photo-comparison-frame" role="img" aria-labelledby={labelId}>
                <img src={url(before.id)} alt="" onError={() => setFailed(true)} />
                <img
                  src={url(after.id)}
                  alt=""
                  style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}
                  onError={() => setFailed(true)}
                />
                <span
                  className="photo-comparison-divider"
                  style={{ left: `${reveal}%` }}
                  aria-hidden="true"
                />
              </div>
              <p id={labelId}>
                Before: {before.caption || 'Selected original'}. After: {after.caption || 'Selected original'}
                . The after photo covers {reveal}% of the frame from the left.
              </p>

              <p>Use the slider with a pointer or arrow keys. Side by side shows both originals in full.</p>
            </>
          ) : (
            <div className="photo-comparison-side">
              {[
                { photo: before, label: 'Before' },
                { photo: after, label: 'After' },
              ].map(({ photo, label }) => (
                <figure key={photo.id}>
                  <img
                    src={url(photo.id)}
                    alt={`${label}: ${photo.caption || 'Selected original photo'}`}
                    onError={() => setFailed(true)}
                  />
                  <figcaption>
                    {label}
                    {photo.caption ? `: ${photo.caption}` : ''}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </>
      )}
      {failed && (
        <p role="alert">
          A selected original is unavailable. Your choices are kept.{' '}
          <button
            type="button"
            className="button button-outline"
            onClick={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            Try comparison photos again
          </button>
        </p>
      )}
      <p role="status">
        {draft.status || 'Comparison choices can recover on this account/device for seven days.'}
      </p>
    </details>
  );
}
