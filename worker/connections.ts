import type { ConnectionView, RecordConnection } from '../src/shared/connections';
import { ApiError } from './data';
export type ConnectionRow = {
  id: string;
  owner_id: string;
  from_id: string;
  to_id: string;
  kind: RecordConnection['kind'];
  reason: string;
  fingerprint: string;
  revision: number;
  created_at: number;
  removed_at: number | null;
  f_context: string;
  t_context: string;
  f_title: string;
  f_list: string;
  f_list_name: string;
  f_current: string;
  f_archived: number;
  t_title: string;
  t_list: string;
  t_list_name: string;
  t_current: string;
  t_archived: number;
};
export const connectionsQuery = `SELECT c.*, f.context_json AS f_context,t.context_json AS t_context,f.title AS f_title,f.list_id AS f_list,fl.name AS f_list_name,COALESCE(f.merged_into_id,f.id) AS f_current,fl.archived AS f_archived,
 t.title AS t_title,t.list_id AS t_list,tl.name AS t_list_name,COALESCE(t.merged_into_id,t.id) AS t_current,tl.archived AS t_archived
 FROM record_connections c
 JOIN record_items f ON f.id=c.from_id AND f.owner_id=c.owner_id
 JOIN record_items t ON t.id=c.to_id AND t.owner_id=c.owner_id
 JOIN active_lists fl ON fl.id=f.list_id AND fl.owner_id=c.owner_id
 JOIN active_lists tl ON tl.id=t.list_id AND tl.owner_id=c.owner_id
 WHERE c.owner_id=? AND c.removed_at IS NULL`;
export function mapConnection(row: ConnectionRow): RecordConnection {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    kind: row.kind,
    reason: row.reason,
    revision: row.revision,
    createdAt: row.created_at,
  };
}
function recordDetail(value: string): string {
  const context = JSON.parse(value) as { location?: string; version?: string };
  return [context.location, context.version].filter(Boolean).join(' · ');
}
export function connectionView(row: ConnectionRow): ConnectionView {
  return {
    ...mapConnection(row),
    from: {
      id: row.from_id,
      title: row.f_title,
      detail: recordDetail(row.f_context),
      listId: row.f_list,
      listName: row.f_list_name,
      currentId: row.f_current,
      merged: row.from_id !== row.f_current,
      archived: !!row.f_archived,
    },
    to: {
      id: row.to_id,
      title: row.t_title,
      detail: recordDetail(row.t_context),
      listId: row.t_list,
      listName: row.t_list_name,
      currentId: row.t_current,
      merged: row.to_id !== row.t_current,
      archived: !!row.t_archived,
    },
  };
}
export async function requireConnection(db: D1Database, owner: string, id: string): Promise<ConnectionRow> {
  const row = await db.prepare(`${connectionsQuery} AND c.id=?`).bind(owner, id).first<ConnectionRow>();
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Connection not found');
  return row;
}
export function connectionCapacity(error: unknown) {
  if (String(error).includes('worth_connection_limit'))
    throw new ApiError(
      409,
      'CONNECTION_LIMIT',
      'Keep up to 1,000 connections. Remove a saved connection before adding another.',
    );
}
