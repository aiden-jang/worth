import { strToU8, zipSync } from 'fflate';
import type { ArchiveFile } from './portability';
import { decisionLabel } from './decisions';
import { emptyItemContext } from './item-context';
import { exerciseKey } from './activity-plans';

type Cell = string | number | boolean | { date: Date; time: boolean } | null;
type Sheet = { name: string; headers: string[]; rows: Cell[][] };
export const spreadsheetMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rels = 'http://schemas.openxmlformats.org/package/2006/relationships';
const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const day = (value: string | null) => (value ? { date: new Date(`${value}T00:00:00Z`), time: false } : null);
const stamp = (value: number) => ({ date: new Date(value), time: true });

function contextText(context: typeof emptyItemContext): string {
  const fields = Object.entries(context).filter(
    ([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(emptyItemContext[key as keyof typeof emptyItemContext]),
  );
  return fields.length ? JSON.stringify(Object.fromEntries(fields)) : '';
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function text(value: string): string {
  if (value.length > 32767)
    throw new Error('Some text is too long for an Excel cell. Export JSON to keep it in full.');
  // Excel's escaped characters preserve control characters and literal escape sequences.
  const escaped = value.replace(/_x[\da-f]{4}_/gi, (v) => `_x005F_${v.slice(1)}`);
  return xml(
    Array.from(escaped, (character) => {
      const code = character.charCodeAt(0);
      const invalid =
        (code < 32 && ![9, 10, 13].includes(code)) ||
        code === 65534 ||
        code === 65535 ||
        (character.length === 1 && code >= 55296 && code <= 57343);
      return invalid ? `_x${code.toString(16).padStart(4, '0')}_` : character;
    }).join(''),
  );
}
function column(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
function cell(value: Cell, address: string, header = false): string {
  if (value === null) return `<c r="${address}"/>`;
  if (typeof value === 'object') {
    const serial = value.date.getTime() / 86400000 + 25569;
    if (!Number.isFinite(serial)) throw new Error('An export date could not be read. Try the JSON export.');
    if (serial < 61)
      return cell(value.time ? value.date.toISOString() : value.date.toISOString().slice(0, 10), address);
    return `<c r="${address}" s="${value.time ? 3 : 2}"><v>${serial}</v></c>`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new Error('An export measurement could not be read. Try the JSON export.');
    return `<c r="${address}"><v>${value}</v></c>`;
  }
  if (typeof value === 'boolean') return `<c r="${address}" t="b"><v>${Number(value)}</v></c>`;
  // Inline strings stay literal, including names or notes beginning with =, +, - or @.
  return `<c r="${address}" t="inlineStr" s="${header ? 1 : 0}"><is><t xml:space="preserve">${text(value)}</t></is></c>`;
}

export function archiveSpreadsheet(archive: ArchiveFile): Uint8Array<ArrayBuffer> {
  const lists = new Map(archive.lists.map((list) => [list.id, list]));
  const items = new Map(archive.items.map((item) => [item.id, item]));
  const name = (id: string) => lists.get(id)?.name ?? '';
  const title = (log: ArchiveFile['logs'][number]) => {
    const original = log.itemId ? items.get(log.itemId) : null;
    return (
      log.title ||
      (original?.mergedIntoId ? items.get(original.mergedIntoId)?.title : original?.title) ||
      original?.title ||
      ''
    );
  };
  const sheets: Sheet[] = [
    {
      name: 'Saved things',
      headers: [
        'Name',
        'Collection',
        'Type',
        'Overall call',
        'Rank in collection',
        'Want to try',
        'Revisit queued',
        'Place',
        'Labels',
        'Note',
        'Started on',
        'Ended on',
        'Saved at (UTC)',
        'Updated at (UTC)',
        'Record ID',
        'Collection ID',
        'Merged into ID',
        'Other context (JSON)',
      ],
      rows: archive.items.map((item) => {
        const rank = lists.get(item.listId)?.rankedIds.indexOf(item.id) ?? -1;
        return [
          item.title,
          name(item.listId),
          item.type,
          decisionLabel(item.decision),
          rank < 0 ? null : rank + 1,
          item.wantToTry,
          item.revisitQueued,
          item.context.location,
          item.context.labels.join(', '),
          item.note,
          day(item.startedOn),
          day(item.endedOn),
          stamp(item.createdAt),
          stamp(item.updatedAt),
          item.id,
          item.listId,
          item.mergedIntoId,
          contextText(item.context),
        ];
      }),
    },
    {
      name: 'Experiences',
      headers: [
        'Name',
        'Collection',
        'Kind',
        'Experience date',
        'This time',
        'Place',
        'Order or tried',
        'Version',
        'Note',
        'Exercise',
        'Legacy amount',
        'Legacy unit',
        'Legacy sets',
        'Legacy reps',
        'Saved at (UTC)',
        'Entry ID',
        'Record ID',
        'Workout ID',
        'Collection ID',
      ],
      rows: archive.logs.map((log) => [
        title(log),
        name(log.listId),
        lists.get(log.listId)?.kind === 'collection' ? 'Visit' : 'Activity',
        day(log.happenedOn),
        decisionLabel(log.context.reaction),
        log.context.location,
        log.context.order,
        log.context.version,
        log.note,
        log.exercise,
        log.amount,
        log.unit,
        log.sets,
        log.reps,
        stamp(log.createdAt),
        log.id,
        log.itemId,
        log.workoutId,
        log.listId,
      ]),
    },
    {
      name: 'Exercise sets',
      headers: [
        'Exercise',
        'Activity',
        'Date',
        'Set',
        'Reps',
        'Weight',
        'Weight unit',
        'Bodyweight (weight blank)',
        'Entry ID',
        'Workout ID',
      ],
      rows: archive.logs.flatMap((log) =>
        log.exerciseSets.map((set, index) => [
          title(log),
          name(log.listId),
          day(log.happenedOn),
          index + 1,
          set.reps,
          set.weight,
          log.weightUnit,
          set.weight === null,
          log.id,
          log.workoutId,
        ]),
      ),
    },
    {
      name: 'Measurements',
      headers: ['Entry', 'Activity', 'Date', 'Measurement', 'Value', 'Unit', 'Entry ID'],
      rows: archive.logs.flatMap((log) =>
        log.measurements.map((measurement) => [
          title(log),
          name(log.listId),
          day(log.happenedOn),
          measurement.name,
          measurement.value,
          measurement.unit,
          log.id,
        ]),
      ),
    },
    {
      name: 'Workouts',
      headers: [
        'Workout',
        'Activity',
        'Date',
        'Status',
        'Planned exercises',
        'Skipped exercises',
        'Workout ID',
        'Collection ID',
      ],
      rows: archive.workoutSessions.map((workout) => [
        workout.title,
        name(workout.listId),
        day(workout.happenedOn),
        workout.status,
        workout.plannedExercises.join('\n'),
        workout.skippedExercises.join('\n'),
        workout.id,
        workout.listId,
      ]),
    },
    {
      name: 'Routines',
      headers: ['Routine', 'Activity', 'Order', 'Exercise', 'Planned target (JSON)', 'Routine ID'],
      rows: archive.workoutRoutines.flatMap((routine) =>
        routine.exercises.map((exercise, index) => {
          const target = routine.targets.find((plan) => exerciseKey(plan.exercise) === exerciseKey(exercise));
          return [
            routine.title,
            name(routine.listId),
            index + 1,
            exercise,
            target ? JSON.stringify(target) : '',
            routine.id,
          ];
        }),
      ),
    },
    {
      name: 'Collections',
      headers: ['Name', 'Kind', 'Description', 'Archived', 'Collection ID'],
      rows: archive.lists.map((list) => [list.name, list.kind, list.description, list.archived, list.id]),
    },
    {
      name: 'Inbox',
      headers: [
        'Name',
        'Type',
        'Overall call',
        'Note',
        'Want to try',
        'Place',
        'Labels',
        'Saved at (UTC)',
        'Record ID',
        'Other context (JSON)',
        'Experienced on',
        'Reaction this time',
        'Photo available',
      ],
      rows: archive.inbox.map((item) => [
        item.title,
        item.type,
        decisionLabel(item.decision),
        item.note,
        item.wantToTry,
        item.context.location,
        item.context.labels.join(', '),
        stamp(item.createdAt),
        item.id,
        contextText(item.context),
        item.memory ? day(item.memory.happenedOn) : null,
        decisionLabel(item.memory?.reaction ?? null),
        !!item.photo?.available,
      ]),
    },
    {
      name: 'About',
      headers: ['Worth export', 'Details'],
      rows: [
        ['Exported at (UTC)', stamp(Date.parse(archive.exportedAt))],
        [
          'Contents',
          'Collections, saved things, dated entries, individual exercise sets, named measurements, workouts, routine lineups and Inbox. Archived lists are included.',
        ],
        [
          'Full backup',
          'Use Worth JSON for restoring all supported data, including boards, receipts, capsules, shared copies, templates, connections and history. Excel is a readable export and cannot be restored into Worth.',
        ],
        [
          'Photos',
          'Photos and covers are not included. Use Back up with photos for an image-inclusive JSON backup.',
        ],
        [
          'Calls',
          'Overall calls and individual visit reactions are separate. Blank means no call; it does not mean Meh.',
        ],
        [
          'Dates',
          'Experience dates are entered calendar dates. Saved/updated timestamps are UTC. Dates before March 1900 are ISO text.',
        ],
        [
          'Missing measurements',
          'Blank stays blank; zero stays zero. Bodyweight has blank weight. Kg and lb are not converted. Planned targets are not completed sets.',
        ],
        [
          'Privacy',
          'This file contains your private notes and records. Public share links and Trash are excluded.',
        ],
      ],
    },
  ];
  const files: Record<string, Uint8Array> = {};
  const add = (path: string, content: string) => {
    files[path] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${content}`);
  };
  sheets.forEach((sheet, index) => {
    if (sheet.rows.length >= 1048576)
      throw new Error('This archive exceeds Excel’s row limit. Export JSON to keep every record.');
    const rows = [sheet.headers, ...sheet.rows];
    const end = `${column(sheet.headers.length - 1)}${rows.length}`;
    const widths = sheet.headers.map((header) =>
      /Details/.test(header)
        ? 80
        : /Note|context|Planned|Skipped/.test(header)
          ? 48
          : /ID/.test(header)
            ? 38
            : /date|Date|UTC/.test(header)
              ? 23
              : 26,
    );
    const height = (row: Cell[]) =>
      Math.min(
        409,
        Math.max(
          22,
          ...row.map((value, i) =>
            typeof value === 'string'
              ? value
                  .split('\n')
                  .reduce(
                    (lines, line) =>
                      lines + Math.max(1, Math.ceil(Array.from(line).length / (widths[i] - 2))),
                    0,
                  ) *
                  15 +
                8
              : 22,
          ),
        ),
      );
    const pane =
      sheet.name === 'About'
        ? ''
        : '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>';
    add(
      `xl/worksheets/sheet${index + 1}.xml`,
      `<worksheet xmlns="${ns}"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row, i) => `<row r="${i + 1}" ht="${i === 0 ? Math.max(36, height(row)) : height(row)}" customHeight="1">${row.map((value, j) => cell(value, `${column(j)}${i + 1}`, i === 0)).join('')}</row>`).join('')}</sheetData>${sheet.rows.length && sheet.name !== 'About' ? `<autoFilter ref="A1:${end}"/>` : ''}</worksheet>`,
    );
  });
  add(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  add(
    '_rels/.rels',
    `<Relationships xmlns="${rels}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  add(
    'xl/workbook.xml',
    `<workbook xmlns="${ns}" xmlns:r="${office}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  add(
    'xl/_rels/workbook.xml.rels',
    `<Relationships xmlns="${rels}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${office}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="styles" Type="${office}/styles" Target="styles.xml"/></Relationships>`,
  );
  add(
    'xl/styles.xml',
    `<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts><fonts count="2"><font><sz val="11"/><color rgb="FF181915"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF20211C"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  return zipSync(files, { level: 1 });
}
