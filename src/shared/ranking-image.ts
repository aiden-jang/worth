export interface RankingImage {
  title: string;
  entries: { title: string; type: string }[];
}

export async function renderRankingImage({ title, entries }: RankingImage) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  const paperHeight = Math.max(1, Math.min(entries.length, 5)) * 139 + 77;
  canvas.height = 424 + paperHeight + 154;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image creation is unavailable in this browser.');
  ctx.fillStyle = '#181915';
  ctx.fillRect(0, 0, 1080, canvas.height);
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

export async function saveRankingImage(data: RankingImage) {
  const blob = await renderRankingImage(data);
  const { title } = data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const name =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'ranking';
  anchor.download = `worth-${name}-${new Date().toISOString().slice(0, 10)}.png`;
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
  const characters = Array.from(text);
  let line = '',
    row = 0;
  while (characters.length) {
    const character = characters.shift()!;
    if (ctx.measureText(line + character).width > width) {
      if (row === maxLines - 1) {
        while (ctx.measureText(line + '…').width > width) line = Array.from(line).slice(0, -1).join('');
        ctx.fillText(line + '…', x, y + row * lineHeight);
        return;
      }
      ctx.fillText(line, x, y + row * lineHeight);
      row += 1;
      line = '';
    }
    line += character;
  }
  if (line) ctx.fillText(line, x, y + row * lineHeight);
}
