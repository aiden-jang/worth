const coversByName: Record<string, string> = {
  drinks: '/art/starter-covers/drinks-v1.webp',
  movies: '/art/starter-covers/movies-v1.webp',
  places: '/art/starter-covers/places-v1.webp',
  cars: '/art/starter-covers/cars-v1.webp',
};

export function starterCollectionCover(name: string): string | null {
  return coversByName[name.trim().toLocaleLowerCase()] ?? null;
}
