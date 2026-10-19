import { z } from 'zod';
import { itemInput } from './validation';
import { emptyItemContext, itemContext } from './item-context';
import type { Item } from './models';
import { duplicateIdentity } from './record-identity';

export const reviewedItemsInput = z.object({ items: z.array(itemInput).min(1).max(100) }).strict();
export type ReviewedItem = z.infer<typeof itemInput>;
export type CsvMapping = {
  title: number;
  type: number;
  note: number;
  sourceUrl: number;
  decision: number;
  startedOn: number;
  endedOn: number;
};
export const emptyCsvMapping: CsvMapping = {
  title: 0,
  type: -1,
  note: -1,
  sourceUrl: -1,
  decision: -1,
  startedOn: -1,
  endedOn: -1,
};
type CsvRow = { row: number; cells: string[] };
export type CsvTable = { headers: string[]; rows: CsvRow[] };
export type CaptureReview = { row: number; item?: ReviewedItem; error?: string; duplicate: boolean };
export function captureIssueText(issues: z.ZodIssue[]): string {
  const labels: Record<string, string> = {
    title: 'Name',
    type: 'Type',
    note: 'Note',
    decision: 'Personal call',
    startedOn: 'Start date',
    endedOn: 'End date',
    'context.sourceUrl': 'Source URL',
  };
  return issues.map((issue) => `${labels[issue.path.join('.')] ?? 'Record'}: ${issue.message}`).join(' · ');
}

export function readCsv(source: string, delimiter = ','): CsvTable {
  if (![',', ';', '\t'].includes(delimiter)) throw new Error('Choose comma, semicolon or tab separation.');
  if (new TextEncoder().encode(source).length > 256 * 1024) throw new Error('Choose a file up to 256 KB.');
  if (source.includes('\0')) throw new Error('This file contains an unsupported null character.');
  const text = source.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
    if (row.length > 30) throw new Error('Use up to 30 columns.');
  };
  const finishRow = () => {
    finishCell();
    if (row.some((value) => value.trim())) records.push(row);
    row = [];
    if (records.length > 101) throw new Error('Import up to 100 records at a time, plus a header row.');
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += character;
    } else if (character === delimiter) finishCell();
    else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      finishRow();
    } else if (character === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || character === '"')
        throw new Error('A quoted cell is malformed. Check its quotation marks.');
      cell += character;
    }
    if (cell.length > 16000)
      throw new Error('A cell is too long. Use up to 16,000 characters before mapping.');
  }
  if (quoted) throw new Error('A quoted cell is unfinished. Add its closing quotation mark.');
  if (cell || closed || row.length) finishRow();
  if (records.length < 2) throw new Error('Include a header row and at least one record.');
  const [headers, ...data] = records;
  if (data.some((record) => record.length !== headers.length))
    throw new Error('Rows have different column counts. Check the separator and quotation marks.');
  return {
    headers: headers.map((header, index) => header.trim() || `Column ${index + 1}`),
    rows: data.map((cells, index) => ({ row: index + 2, cells })),
  };
}
export function suggestCsvMapping(headers: string[]): CsvMapping {
  const key = headers.map((header) => header.toLowerCase().trim().replace(/[ _-]/g, ''));
  const find = (...names: string[]) => key.findIndex((value) => names.includes(value));
  return {
    title: Math.max(0, find('title', 'name')),
    type: find('type', 'category'),
    note: find('note', 'notes'),
    sourceUrl: find('source', 'sourceurl', 'url', 'link'),
    decision: find('call', 'decision'),
    startedOn: find('startedon', 'startdate'),
    endedOn: find('endedon', 'enddate'),
  };
}
export function reviewCsv(
  table: CsvTable,
  mapping: CsvMapping,
  existing: Item[],
  wantToTry = false,
): CaptureReview[] {
  const seen = new Set(existing.map(duplicateIdentity));
  const indices = Object.values(mapping).filter((index) => index >= 0);
  if (
    !Number.isInteger(mapping.title) ||
    mapping.title < 0 ||
    indices.some((index) => !Number.isInteger(index) || index >= table.headers.length) ||
    new Set(indices).size !== indices.length
  )
    throw new Error('Choose a name column and use each column once.');
  const value = (row: CsvRow, key: keyof CsvMapping) =>
    mapping[key] < 0 ? '' : row.cells[mapping[key]].trim();
  return table.rows.map((row) => {
    const call = value(row, 'decision').toLowerCase();
    const calls: Record<string, ReviewedItem['decision']> = {
      '': null,
      none: null,
      'no call': null,
      favorite: 'favorite',
      meh: 'meh',
      'not again': 'would_not_again',
      would_not_again: 'would_not_again',
    };
    if (!Object.hasOwn(calls, call))
      return { row: row.row, duplicate: false, error: 'Use Favorite, Meh, Not again or an empty call.' };
    const result = itemInput.safeParse({
      title: value(row, 'title'),
      type: value(row, 'type'),
      note: value(row, 'note'),
      decision: calls[call],
      wantToTry,
      context: { ...emptyItemContext, sourceUrl: value(row, 'sourceUrl') },
      startedOn: value(row, 'startedOn') || null,
      endedOn: value(row, 'endedOn') || null,
    });
    if (!result.success)
      return {
        row: row.row,
        duplicate: false,
        error: captureIssueText(result.error.issues),
      };
    const identity = duplicateIdentity(result.data);
    const duplicate = seen.has(identity);
    seen.add(identity);
    return { row: row.row, item: result.data, duplicate };
  });
}
export function suggestLink(raw: string): { sourceUrl: string; title: string } {
  const sourceUrl = raw.trim();
  if (!sourceUrl) throw new Error('Add a source link.');
  const checked = itemContext.safeParse({ sourceUrl });
  if (!checked.success)
    throw new Error('Use an http or https link without login credentials, up to 1,000 characters.');
  const url = new URL(sourceUrl);
  const slug = url.pathname.split('/').filter(Boolean).at(-1);
  let title = '';
  if (slug) {
    try {
      title = decodeURIComponent(slug)
        .replace(/\.(?:html?|php|aspx?)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      /* The address remains usable when its path cannot be decoded. */
    }
  }
  if (!title || title.length > 120) title = url.hostname.replace(/^www\./, '').slice(0, 120);
  return { sourceUrl, title };
}
