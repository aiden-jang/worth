import { useId, useState } from 'react';
import type { GalleryEntry } from '../shared/photo-gallery';
export function AnnotatedPhoto({
  src,
  entry,
  number,
  available = true,
  label = 'Original',
  showCaption = false,
}: {
  src: string;
  entry: GalleryEntry;
  number: number;
  available?: boolean;
  label?: string;
  showCaption?: boolean;
}) {
  const marker = useId().replaceAll(':', '');
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  return (
    <figure className="gallery-figure">
      <div className="gallery-image">
        {failed || !available ? (
          <p role={failed ? 'alert' : undefined}>
            {available
              ? `${label} unavailable. Your caption and arrows are kept.`
              : 'Image bytes were not included in this backup. Caption and arrows are kept.'}{' '}
            {available && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setFailed(false);
                  setAttempt(attempt + 1);
                }}
              >
                Retry {label.toLowerCase()} photo {number}
              </button>
            )}
          </p>
        ) : (
          <img
            src={`${src}${src.includes('?') ? '&' : '?'}r=${attempt}`}
            loading="lazy"
            decoding="async"
            alt={showCaption ? `${label} photo ${number}` : entry.caption || `Saved photo ${number}`}
            onError={() => setFailed(true)}
          />
        )}
        {!!entry.arrows.length && !failed && available && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker
                id={marker}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M1 1 7 4 1 7" fill="none" stroke="#e8dc9d" strokeWidth="1.4" />
              </marker>
            </defs>
            {entry.arrows.map((arrow) => (
              <g key={arrow.id}>
                <line
                  x1={arrow.fromX * 100}
                  y1={arrow.fromY * 100}
                  x2={arrow.toX * 100}
                  y2={arrow.toY * 100}
                  stroke="#181915"
                  strokeWidth="5"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={arrow.fromX * 100}
                  y1={arrow.fromY * 100}
                  x2={arrow.toX * 100}
                  y2={arrow.toY * 100}
                  stroke="#e8dc9d"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  markerEnd={`url(#${marker})`}
                />
              </g>
            ))}
          </svg>
        )}
      </div>
      {(!!entry.arrows.length || (showCaption && !!entry.caption)) && (
        <figcaption>
          {showCaption && entry.caption && <p>{entry.caption}</p>}
          {!!entry.arrows.length && (
            <ol>
              {entry.arrows.map((arrow, index) => (
                <li key={arrow.id}>
                  Arrow {index + 1}
                  {arrow.label ? `: ${arrow.label}` : ''}
                </li>
              ))}
            </ol>
          )}
        </figcaption>
      )}
    </figure>
  );
}
