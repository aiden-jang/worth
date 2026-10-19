import fontLicense from '@fontsource/dm-sans/LICENSE?raw';
import type { Item } from './models';
import { decisionLabel } from './decisions';

export type BookletOptions = { ranks: boolean; calls: boolean; notes: boolean; photos: boolean };
export type BookletEntry = {
  id: string;
  title: string;
  type: string;
  caption: string;
  rank?: number | null;
  call?: string;
  note?: string;
  photo?: string;
};
export type BookletData = { format?: 'guide'; title: string; dedication: string; entries: BookletEntry[] };
export type RecommendationCard = {
  title: string;
  type: string;
  message: string;
  recipient: string;
  collection: string;
  photo?: string;
};

export function bookletEntries(
  items: Item[],
  ids: string[],
  rankedIds: string[],
  options: BookletOptions,
  captions: Record<string, string>,
): BookletEntry[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return [...new Set(ids)].slice(0, 12).flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];
    return [
      {
        id,
        title: item.title,
        type: item.type,
        caption: captions[id] ?? '',
        ...(options.ranks ? { rank: rankedIds.includes(id) ? rankedIds.indexOf(id) + 1 : null } : {}),
        ...(options.calls ? { call: decisionLabel(item.decision) || 'No call' } : {}),
        ...(options.notes ? { note: item.note } : {}),
        ...(options.photos && item.hasPhoto
          ? { photo: `/api/items/${encodeURIComponent(id)}/photo?v=${item.updatedAt}` }
          : {}),
      },
    ];
  });
}

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
const safePhoto = (value: string) => {
  if (!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new Error('A booklet photo could not be embedded safely.');
  return value;
};

export function bookletHtml(data: BookletData, fonts: { weight: 400 | 500; data: string }[] = []): string {
  if (!data.entries.length || data.entries.length > 12)
    throw new Error('Choose between one and twelve records.');
  const faces = fonts
    .map((font) => {
      if (![400, 500].includes(font.weight)) throw new Error('Unsupported font weight.');
      if (!/^data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}$/.test(font.data))
        throw new Error('Could not embed the booklet font.');
      return `@font-face{font-family:Worth; font-weight:${font.weight};src:url(${font.data}) format('woff2')}`;
    })
    .join('');
  for (const entry of data.entries)
    if (
      entry.rank !== undefined &&
      entry.rank !== null &&
      (!Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 500)
    )
      throw new Error('Unsupported collection rank.');
  const pages = data.entries
    .map(
      (entry, index) =>
        `<article class="page record"><p class="eyebrow">RECORD ${String(index + 1).padStart(2, '0')}${entry.rank === undefined ? '' : entry.rank === null ? ' · UNRANKED' : ` · COLLECTION RANK ${entry.rank}`}</p><h2>${escape(entry.title)}</h2>${entry.type ? `<p class="type">${escape(entry.type)}</p>` : ''}${entry.photo ? `<img src="${safePhoto(entry.photo)}" alt="${escape(entry.title)}"/>` : ''}${entry.call ? `<p class="call">${escape(entry.call)}</p>` : ''}${entry.caption ? `<p class="caption">${escape(entry.caption)}</p>` : ''}${entry.note ? `<section class="note"><h3>Private note</h3><p>${escape(entry.note)}</p></section>` : ''}<footer>worth</footer></article>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(data.title)} · Worth ${data.format === 'guide' ? 'field guide' : 'booklet'}</title><style>${faces}
    *{box-sizing:border-box}body{margin:0;background:#292a23;color:#181915;font:400 16px/1.6 Worth,system-ui,sans-serif}main{max-width:720px;margin:32px auto}.page{background:#eae5d5;padding:56px;margin-bottom:24px;overflow-wrap:anywhere}.cover{min-height:780px;display:flex;flex-direction:column;justify-content:center}.eyebrow{font-size:12px;letter-spacing:.08em;color:#626456}h1{font-size:56px;font-weight:500;line-height:1.08;letter-spacing:-.04em}h2{font-size:38px;font-weight:500;line-height:1.15;letter-spacing:-.03em}h3{font-size:16px;font-weight:500}.type{color:#626456}.dedication,.caption,.note p{white-space:pre-wrap}.dedication{font-size:22px}img{display:block;width:100%;max-height:360px;object-fit:contain;margin:32px 0}.call{display:inline-block;border:1px solid #737566;border-radius:999px;padding:6px 16px}.caption{font-size:22px}.note{border-top:1px solid #aaa99b;margin-top:32px}footer{font-size:14px;color:#626456;margin-top:56px}.cover footer{margin-top:auto;padding-top:80px}.cover-mark{width:80px;height:64px;display:block;margin-top:24px}@media(max-width:600px){main{margin:12px}.page{padding:28px}.cover{min-height:600px}h1{font-size:40px}h2{font-size:30px}}@page{size:A5;margin:12mm}@media print{html,body{background:#eae5d5}main{margin:0;max-width:none}.page{padding:0;margin:0;min-height:180mm;display:flex;flex-direction:column;break-after:page;background:#eae5d5;print-color-adjust:exact;-webkit-print-color-adjust:exact}.cover{min-height:180mm}h1{font-size:36pt}h2{font-size:27pt}img{max-height:85mm}.note,.caption{break-inside:auto}footer{margin-top:auto;padding-top:40px}.page:last-child{break-after:auto}}
    </style></head><body><main><section class="page cover"><p class="eyebrow">${data.format === 'guide' ? 'A FIELD GUIDE FROM WORTH' : 'A COLLECTION FROM WORTH'}</p><svg class="cover-mark" viewBox="0 0 80 64" fill="none" aria-hidden="true"><path d="m17 16 39-6 7 40-39 6zM24 8l40 5-5 42-40-5z" fill="#eae5d5" stroke="#737566" stroke-width="2"/><path d="m32 24 20 2m-21 8 13 1" stroke="#737566" stroke-width="2" stroke-linecap="round"/></svg><h1>${escape(data.title)}</h1>${data.dedication ? `<p class="dedication">${escape(data.dedication)}</p>` : ''}<p>${data.entries.length} ${data.entries.length === 1 ? 'record' : 'records'}</p><footer>worth · ${data.format === 'guide' ? 'Field guide' : 'A small collection.'}</footer></section>${pages}</main>${fonts.length ? `<template id="worth-font-license"><pre>${escape(fontLicense)}</pre></template>` : ''}</body></html>`;
}

export function wrapCardText(text: string, measure: (text: string) => number, width: number): string[] {
  const rows: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let row = '';
    const characters =
      typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(paragraph)].map(
            (segment) => segment.segment,
          )
        : Array.from(paragraph);
    for (const character of characters) {
      if (row && measure(row + character) > width) {
        rows.push(row);
        row = '';
      }
      row += character;
    }
    rows.push(row);
  }
  return rows;
}
