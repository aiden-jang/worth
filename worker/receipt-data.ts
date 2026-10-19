import { receiptInput, type SavedReceipt } from '../src/shared/receipts';
export type ReceiptRow = {
  id: string;
  owner_id: string;
  body_json: string;
  creation_hash: string;
  created_at: number;
  removed_at: number | null;
};
export function mapReceipt(row: ReceiptRow): SavedReceipt {
  return {
    ...receiptInput.parse(JSON.parse(row.body_json)),
    id: row.id,
    createdAt: row.created_at,
  };
}
