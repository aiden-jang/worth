import { boardInput, type SavedBoard } from '../src/shared/memory-boards';
export type BoardRow = {
  id: string;
  owner_id: string;
  body_json: string;
  revision: number;
  create_hash: string;
  created_at: number;
  updated_at: number;
  removed_at: number | null;
};
export function mapBoard(row: BoardRow): SavedBoard {
  return {
    ...boardInput.parse(JSON.parse(row.body_json)),
    id: row.id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
