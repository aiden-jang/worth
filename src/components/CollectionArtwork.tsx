/** Category artwork and monograms are decorative; private covers always take precedence. */
export function CollectionArtwork({
  name,
  cover,
  neutral = false,
}: {
  name: string;
  cover?: string | null;
  neutral?: boolean;
}) {
  if (cover)
    return (
      <div className="collection-artwork" aria-hidden="true">
        <img src={cover} alt="" />
      </div>
    );
  const letters = Array.from(name.trim());
  const tone = neutral
    ? 'sage'
    : ['sage', 'clay', 'butter'][letters.reduce((sum, letter) => sum + (letter.codePointAt(0) ?? 0), 0) % 3];
  return (
    <div className="collection-artwork cabinet-monogram" data-tone={tone} aria-hidden="true">
      <span className="monogram-sheet" />
      <span className="monogram-letter">{letters[0] || '?'}</span>
      <span className="monogram-orbit" />
    </div>
  );
}
