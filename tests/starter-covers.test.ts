import { describe, expect, test } from 'vitest';
import { starterCollectionCover } from '../src/shared/starter-covers';

describe('starterCollectionCover', () => {
  test('keeps the named starter collections visually recognizable after creation', () => {
    expect(starterCollectionCover('Drinks')).toBe('/art/starter-covers/drinks-v2.svg');
    expect(starterCollectionCover(' Movies ')).toBe('/art/starter-covers/movies-v2.svg');
    expect(starterCollectionCover('PLACES')).toBe('/art/starter-covers/places-v2.svg');
    expect(starterCollectionCover('cars')).toBe('/art/starter-covers/cars-v2.svg');
    expect(starterCollectionCover(' Skincare ')).toBe('/art/starter-covers/skincare.svg');
    expect(starterCollectionCover('FRAGRANCE')).toBe('/art/starter-covers/fragrance.svg');
    expect(starterCollectionCover('Food & snacks')).toBe('/art/collection-choices/snack-clay.svg');
    expect(starterCollectionCover('Recipes')).toBe('/art/starter-covers/recipes.svg');
    expect(starterCollectionCover('Clothing & gear')).toBe('/art/starter-covers/clothing.svg');
  });

  test('does not invent a cover for a personal collection', () => {
    expect(starterCollectionCover('Sunday drives')).toBeNull();
  });

  test('keeps an explicit artwork choice ahead of a starter name', () => {
    expect(starterCollectionCover('Skincare', { object: 'plant', tone: 'clay' })).toBe(
      '/art/collection-choices/plant-clay.svg',
    );
  });
});
