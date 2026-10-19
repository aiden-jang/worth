import { archiveFile } from '../src/shared/portability';
import { expect, test } from 'vitest';
import {
  boardInput,
  boardDraft,
  boardForm,
  boardPayload,
  emptyBoardDraft,
  exportBoardReferences,
  type SavedBoard,
} from '../src/shared/memory-boards';
const row = '11111111-1111-4111-8111-111111111111',
  source = '22222222-2222-4222-8222-222222222222';
const body = () => ({
  kind: 'trip' as const,
  name: 'My entered route',
  introduction: 'PRIVATE introduction',
  from: '2026-10-01',
  until: '2026-10-02',
  archived: false,
  entries: [
    {
      id: row,
      name: 'First place',
      note: 'PRIVATE caption',
      day: '2026-10-02',
      time: '19:30',
      location: 'My entered location',
      reference: { kind: 'item' as const, id: source },
      referenceMissing: false,
      photo: true,
    },
  ],
});
test('boards preserve manual order and literal dates while rejecting invalid dates, duplicate row identities and external reference shapes', () => {
  const board = body();
  board.entries.push({ ...board.entries[0], id: crypto.randomUUID(), day: '2026-10-01' });
  expect(boardInput.parse(board).entries.map((entry) => entry.day)).toEqual(['2026-10-02', '2026-10-01']);
  expect(boardInput.safeParse({ ...board, until: '2026-09-30' }).success).toBe(false);
  expect(
    boardInput.safeParse({ ...board, entries: [{ ...board.entries[0], day: '2026-02-29' }] }).success,
  ).toBe(false);
  expect(
    boardInput.safeParse({ ...board, entries: [{ ...board.entries[0], day: '2024-02-29' }] }).success,
  ).toBe(true);
  expect(boardInput.safeParse({ ...board, entries: [board.entries[0], board.entries[0]] }).success).toBe(
    false,
  );
  expect(
    boardInput.safeParse({
      ...board,
      entries: [{ ...board.entries[0], reference: { url: 'https://external.test' } }],
    }).success,
  ).toBe(false);
});
test('incomplete board drafts recover independently of strict saved bodies and omit record metadata from input projection', () => {
  const saved: SavedBoard = { ...body(), id: crypto.randomUUID(), revision: 4, createdAt: 1, updatedAt: 2 };
  expect(boardPayload(boardForm(saved))).toEqual(body());
  const draft = emptyBoardDraft();
  draft.current.name = 'Not saved yet';
  draft.current.entries = [{ ...body().entries[0], name: '', day: '2026-02-', time: '99:' }];
  expect(boardDraft.safeParse(draft).success).toBe(true);
  expect(() => boardPayload(draft.current)).toThrow();
});
test('board exports retain manual text but mark unavailable links without mutating the saved board', () => {
  const saved: SavedBoard = { ...body(), id: crypto.randomUUID(), revision: 0, createdAt: 1, updatedAt: 1 };
  const missing = exportBoardReferences(saved, new Set(), new Set());
  expect(missing.entries[0]).toMatchObject({
    reference: null,
    referenceMissing: true,
    name: 'First place',
    note: 'PRIVATE caption',
    photo: true,
  });
  expect(saved.entries[0].reference?.id).toBe(source);
  expect(exportBoardReferences(saved, new Set([source]), new Set()).entries[0].reference?.id).toBe(source);
});

test('older formats cannot claim to preserve boards and board-only backups are valid', () => {
  const file = {
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    photosExcluded: true,
    lists: [],
    items: [],
    logs: [],
    boards: [{ ...body(), id: crypto.randomUUID(), revision: 0, createdAt: 1, updatedAt: 1, entries: [] }],
  };
  expect(archiveFile.safeParse(file).success).toBe(true);
  expect(archiveFile.safeParse({ ...file, schemaVersion: 5 }).success).toBe(false);
});
