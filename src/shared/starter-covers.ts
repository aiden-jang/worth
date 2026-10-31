import type { CollectionArt } from './models';

const coversByName: Record<string, string> = {
  drinks: '/art/starter-covers/drinks-v2.svg',
  movies: '/art/starter-covers/movies-v2.svg',
  places: '/art/starter-covers/places-v2.svg',
  cars: '/art/starter-covers/cars-v2.svg',
  skincare: '/art/starter-covers/skincare.svg',
  fragrance: '/art/starter-covers/fragrance.svg',
  'food & snacks': '/art/collection-choices/snack-clay.svg',
  recipes: '/art/starter-covers/recipes.svg',
  'clothing & gear': '/art/starter-covers/clothing.svg',
};

export function starterCollectionCover(name: string, artwork?: CollectionArt | null): string | null {
  if (artwork) return `/art/collection-choices/${artwork.object}-${artwork.tone}.svg`;
  return coversByName[name.trim().toLocaleLowerCase()] ?? null;
}
