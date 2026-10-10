const coversByName: Record<string, string> = {
  drinks: '/art/starter-covers/drinks-v2.svg',
  movies: '/art/starter-covers/movies-v2.svg',
  places: '/art/starter-covers/places-v2.svg',
  cars: '/art/starter-covers/cars-v2.svg',
};

export function starterCollectionCover(name: string): string | null {
  return coversByName[name.trim().toLocaleLowerCase()] ?? null;
}
