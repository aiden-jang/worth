import type { CollectionArt } from '../shared/models';
import { starterCollectionCover } from '../shared/starter-covers';
import { CollectionArtwork } from './CollectionArtwork';

const objects = [
  ['cup', 'Cup'],
  ['ticket', 'Ticket'],
  ['place', 'Place'],
  ['car', 'Car'],
  ['snack', 'Snack'],
  ['bag', 'Bag'],
  ['ramen', 'Ramen'],
  ['sneaker', 'Sneaker'],
  ['plant', 'Plant'],
  ['camera', 'Camera'],
] as const;
const tones = ['sage', 'clay', 'butter'] as const;
export function CollectionArtworkPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: CollectionArt | null;
  onChange: (value: CollectionArt | null) => void;
}) {
  return (
    <fieldset className="artwork-picker">
      <legend>
        Artwork <span className="optional">optional</span>
      </legend>
      <button type="button" className="artwork-auto" aria-pressed={!value} onClick={() => onChange(null)}>
        Automatic
      </button>
      <div className="artwork-objects">
        {objects.map(([object, label]) => (
          <button
            type="button"
            key={object}
            aria-pressed={value?.object === object}
            onClick={() => onChange({ object, tone: value?.tone ?? 'sage' })}
          >
            <CollectionArtwork
              name={name}
              cover={starterCollectionCover(name, { object, tone: value?.tone ?? 'sage' })}
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="artwork-tones" aria-label="Artwork color">
        {tones.map((tone) => (
          <button
            type="button"
            key={tone}
            disabled={!value}
            aria-pressed={value?.tone === tone}
            onClick={() => value && onChange({ ...value, tone })}
          >
            <i data-tone={tone} />
            {tone[0].toUpperCase() + tone.slice(1)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
