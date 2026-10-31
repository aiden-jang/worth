import type { CollectionArt } from './models';
import { starterCollectionCover } from './starter-covers';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const charactersOf = (text: string) => Array.from(segmenter.segment(text), ({ segment }) => segment);

export interface RankingImage {
  title: string;
  entries: { title: string; type: string }[];
  artwork?: CollectionArt | null;
}

export async function renderRankingImage({ title, entries, artwork }: RankingImage) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  const paperHeight = Math.max(1, Math.min(entries.length, 5)) * 139 + 77;
  canvas.height = 424 + paperHeight + 154;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image creation is unavailable in this browser.');
  ctx.fillStyle = '#181915';
  ctx.fillRect(0, 0, 1080, canvas.height);
  const source = starterCollectionCover(title, artwork);
  if (
    typeof source === 'string' &&
    /^\/art\/(?:starter-covers|collection-choices)\/[a-z0-9-]+\.svg$/.test(source)
  ) {
    const illustration = new Image();
    illustration.src = source;
    let timer: number | undefined;
    try {
      await Promise.race([
        illustration.decode(),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error('Artwork could not load.')), 5000);
        }),
      ]);
      ctx.save();
      try {
        ctx.beginPath();
        ctx.roundRect(808, 48, 200, 125, 18);
        ctx.clip();
        ctx.drawImage(illustration, 808, 48, 200, 125);
      } finally {
        ctx.restore();
      }
    } catch {
      // A missing decorative asset must not prevent downloading the ranking.
    } finally {
      window.clearTimeout(timer);
      illustration.src = '';
    }
  }
  ctx.fillStyle = '#e8dc9d';
  ctx.font = '500 32px "DM Sans", sans-serif';
  ctx.fillText('worth', 72, 100);
  ctx.fillStyle = '#aaa99b';
  ctx.font = '400 22px "DM Mono", monospace';
  ctx.fillText('A PERSONAL RANKING', 72, 173);
  ctx.fillStyle = '#f0ecdf';
  ctx.font = '500 72px "DM Sans", sans-serif';
  drawLines(ctx, title, 72, 267, 936, 84, 2);
  ctx.fillStyle = '#eae5d5';
  ctx.beginPath();
  ctx.roundRect(56, 424, 968, paperHeight, 28);
  ctx.fill();
  entries.slice(0, 5).forEach((entry, index) => {
    const top = 488 + index * 139;
    ctx.fillStyle = '#67695b';
    ctx.font = '400 22px "DM Mono", monospace';
    ctx.fillText(String(index + 1).padStart(2, '0'), 92, top);
    ctx.fillStyle = '#181915';
    ctx.font = '500 32px "DM Sans", sans-serif';
    drawLines(ctx, entry.title, 160, top, 804, 37, 2);
    ctx.fillStyle = '#67695b';
    ctx.font = '400 21px "DM Sans", sans-serif';
    drawLines(ctx, entry.type, 160, top + 82, 804, 26, 1);
    if (index < Math.min(entries.length, 5) - 1) {
      ctx.strokeStyle = '#c9c6b8';
      ctx.beginPath();
      ctx.moveTo(92, top + 112);
      ctx.lineTo(988, top + 112);
      ctx.stroke();
    }
  });
  ctx.fillStyle = '#aaa99b';
  ctx.font = '400 24px "DM Sans", sans-serif';
  ctx.fillText('Opinions may vary. Yours, mostly.', 72, canvas.height - 79);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not create the image.'))),
      'image/png',
    ),
  );
  return blob;
}

export function saveRankingImage(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.download = file.name;
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  maxLines: number,
) {
  const pieces = Array.from(wordSegmenter.segment(text), ({ segment }) => segment).flatMap((piece) =>
    ctx.measureText(piece).width > width ? charactersOf(piece) : [piece],
  );
  let line = '',
    row = 0;
  for (const piece of pieces) {
    const next = line + piece;
    if (line && ctx.measureText(next.trimEnd()).width > width) {
      if (row === maxLines - 1) {
        line = next.trimEnd();
        while (ctx.measureText(line + '…').width > width) line = charactersOf(line).slice(0, -1).join('');
        ctx.fillText(line.trimEnd() + '…', x, y + row * lineHeight);
        return;
      }
      ctx.fillText(line.trimEnd(), x, y + row * lineHeight);
      row += 1;
      line = piece.trimStart();
    } else line = next;
  }
  if (line) ctx.fillText(line.trimEnd(), x, y + row * lineHeight);
}
