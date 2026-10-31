import { useRef } from 'react';
import { collectionStarters } from '../shared/collection-starters';
import { starterCollectionCover } from '../shared/starter-covers';
import { CollectionArtwork } from './CollectionArtwork';
import '../starters.css';

export function CollectionStarters({
  name,
  disabled,
  onChoose,
}: {
  name: string;
  disabled: boolean;
  onChoose: (name: string) => void;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={disclosure} className="collection-starters">
      <summary>
        Choose a starter <span className="optional">optional</span>
      </summary>
      <div className="collection-starter-grid" role="group" aria-label="Collection starters">
        {collectionStarters
          .filter((starter) => starter.kind === 'collection')
          .map((starter) => (
            <button
              className="collection-starter"
              type="button"
              key={starter.name}
              aria-pressed={name.trim().toLowerCase() === starter.name.toLowerCase()}
              disabled={disabled}
              onClick={() => {
                if (disclosure.current) disclosure.current.open = false;
                onChoose(starter.name);
              }}
            >
              <CollectionArtwork name={starter.name} cover={starterCollectionCover(starter.name)} />
              <span>{starter.name}</span>
            </button>
          ))}
      </div>
      <p className="muted">Places includes restaurants, cafés and other stops.</p>
    </details>
  );
}
