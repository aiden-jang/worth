import type { TasteEvent } from '../src/shared/taste-history';
export type HistoryRow = {
  id: string;
  owner_id: string;
  kind: 'rank' | 'opinion';
  list_id: string | null;
  item_id: string | null;
  before_json: string;
  after_json: string;
  reason: string;
  log_id: string | null;
  revision: number;
  created_at: number;
  visible_log_id?: string | null;
};
// The same projection protects reads and backups, including merged originals.
export const historyQuery = `SELECT h.*, CASE WHEN EXISTS (
 SELECT 1 FROM active_logs g JOIN record_items i ON i.id = h.item_id AND i.owner_id = g.owner_id AND i.list_id = g.list_id
 WHERE g.id = h.log_id AND g.owner_id = h.owner_id AND (g.item_id = i.id OR g.item_id = i.merged_into_id OR g.item_id IN (SELECT id FROM record_items WHERE merged_into_id = i.id))) THEN h.log_id ELSE NULL END AS visible_log_id FROM taste_history h WHERE h.owner_id = ? AND (
 (h.kind = 'rank' AND EXISTS (SELECT 1 FROM active_lists l WHERE l.id = h.list_id AND l.owner_id = h.owner_id))
 OR (h.kind = 'opinion' AND EXISTS (SELECT 1 FROM record_items i WHERE i.id = h.item_id AND i.owner_id = h.owner_id)))`;
export function mapHistory(row: HistoryRow, itemIds?: Set<string>, logIds?: Set<string>): TasteEvent {
  const rank = (value: string) =>
    (JSON.parse(value) as (string | null)[]).map((id) => (id && (!itemIds || itemIds.has(id)) ? id : null));
  const common = {
    id: row.id,
    reason: row.reason,
    logId: row.visible_log_id && (!logIds || logIds.has(row.visible_log_id)) ? row.visible_log_id : null,
    revision: row.revision,
    createdAt: row.created_at,
  };
  return row.kind === 'rank'
    ? {
        ...common,
        kind: 'rank',
        listId: row.list_id!,
        itemId: null,
        before: rank(row.before_json),
        after: rank(row.after_json),
      }
    : {
        ...common,
        kind: 'opinion',
        listId: null,
        itemId: row.item_id!,
        before: JSON.parse(row.before_json),
        after: JSON.parse(row.after_json),
      };
}
