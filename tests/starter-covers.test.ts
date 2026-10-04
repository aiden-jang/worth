import { describe, expect, test } from 'vitest';
import { starterCollectionCover } from '../src/shared/starter-covers';

describe('starterCollectionCover', () => {
  test('keeps the named starter collections visually recognizable after creation', () => {
    expect(starterCollectionCover('Drinks')).toBe('/art/starter-covers/drinks-v1.webp');
    expect(starterCollectionCover(' Movies ')).toBe('/art/starter-covers/movies-v1.webp');
    expect(starterCollectionCover('PLACES')).toBe('/art/starter-covers/places-v1.webp');
    expect(starterCollectionCover('cars')).toBe('/art/starter-covers/cars-v1.webp');
  });

  test('does not invent a cover for a personal collection', () => {
    expect(starterCollectionCover('Sunday drives')).toBeNull();
  });
});
