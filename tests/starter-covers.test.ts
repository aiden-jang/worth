import { describe, expect, test } from 'vitest';
import { starterActivityCover, starterCollectionCover } from '../src/shared/starter-covers';

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
    for (const name of ['Haircare', 'Makeup', 'Shows', 'Experiences', 'Books', 'Music', 'Games'])
      expect(starterCollectionCover(name)).toBe(`/art/starter-covers/${name.toLowerCase()}.svg`);
  });

  test('activity artwork stays neutral and exact-name matched', () => {
    expect(starterActivityCover(' Gym ')).toBe('/art/starter-covers/gym.svg');
    expect(starterActivityCover('RUNS')).toBe('/art/collection-choices/sneaker-sage.svg');
    expect(starterActivityCover('Upkeep')).toBe('/art/starter-covers/upkeep.svg');
    expect(starterActivityCover('Books')).toBeNull();
    expect(starterActivityCover('My workouts')).toBeNull();
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
