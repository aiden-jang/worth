import { expect, test } from 'vitest';
import {
  emptyCsvMapping,
  readCsv,
  reviewCsv,
  suggestCsvMapping,
  suggestLink,
} from '../src/shared/reviewed-capture';
import type { Item } from '../src/shared/models';

test('CSV preserves quoted separators, escaped quotes, multiline notes and Unicode', () => {
  const table = readCsv(
    '\uFEFFName,Type,Note\r\n"Coffee, oat",Drink,"A ""reliable"" one.\nStill good."\r\n茶,Tea,\r\n\r\n',
  );
  expect(table.headers).toEqual(['Name', 'Type', 'Note']);
  expect(table.rows.map((row) => row.cells)).toEqual([
    ['Coffee, oat', 'Drink', 'A "reliable" one.\nStill good.'],
    ['茶', 'Tea', ''],
  ]);
  const rows = reviewCsv(table, suggestCsvMapping(table.headers), []);
  expect(rows[0].item?.note).toBe('A "reliable" one.\nStill good.');
  expect(rows[0].item?.decision).toBeNull();
  expect(rows[1].item?.title).toBe('茶');
  expect(readCsv('Name;Note\nCoffee;Good', ';').rows[0].cells).toEqual(['Coffee', 'Good']);
  expect(readCsv('Name\tType\nCoffee\tDrink', '\t').rows[0].cells).toEqual(['Coffee', 'Drink']);
});
test('CSV rejects malformed quoting, uneven rows, nulls and bounded excess without dropping data', () => {
  for (const text of [
    'Name,Note\nA,"unfinished',
    'Name\nA"bad',
    'Name\n"A"tail',
    'Name,Type\nA',
    'Name\nA\0',
    'Name\n' + 'x'.repeat(262144),
    'Name\n' + Array.from({ length: 101 }, (_, index) => String(index)).join('\n'),
  ])
    expect(() => readCsv(text)).toThrow();
  expect(() => readCsv('Name\nA', '|')).toThrow();
  const table = readCsv('Name,Type\nA,B');
  expect(() => reviewCsv(table, { ...emptyCsvMapping, type: 0 }, [])).toThrow('each column once');
});
test('review validates calls, real dates and links and flags normalized duplicates without merging', () => {
  const table = readCsv(
    'Name,Type,Call,Source,Start date,End date\n  COFFEE ,Drink,Meh,https://example.test/a,2026-10-01,2026-10-02\ncoffee,Drink,Not again,,,\nCoffee,Bean,Favorite,,,\nUnsafe,,five stars,,,\nBad link,,,javascript:alert(1),,\nBad date,,,,2026-02-30,',
  );
  const rows = reviewCsv(
    table,
    suggestCsvMapping(table.headers),
    [{ title: 'coffee', type: 'Drink' } as Item],
    true,
  );
  expect(rows.slice(0, 3).map((row) => row.duplicate)).toEqual([true, true, false]);
  expect(rows.slice(0, 3).map((row) => row.item?.decision)).toEqual(['meh', 'would_not_again', 'favorite']);
  expect(rows[0].item).toMatchObject({
    wantToTry: true,
    startedOn: '2026-10-01',
    endedOn: '2026-10-02',
    context: { sourceUrl: 'https://example.test/a' },
  });
  expect(rows.slice(3).every((row) => !row.item && !!row.error)).toBe(true);
});
test('address suggestions retain the original URL and never claim to fetch an identity', () => {
  const link = suggestLink(' https://www.example.test/good-find.html?private=keep#section ');
  expect(link).toEqual({
    title: 'good find',
    sourceUrl: 'https://www.example.test/good-find.html?private=keep#section',
  });
  expect(suggestLink('https://www.example.test/').title).toBe('example.test');
  expect(suggestLink('https://example.test/%E8%8C%B6').title).toBe('茶');
  for (const value of ['', 'javascript:alert(1)', 'https://person:secret@example.test/'])
    expect(() => suggestLink(value)).toThrow();
});
