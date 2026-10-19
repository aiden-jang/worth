import { collectionTemplates, type CollectionTemplate } from '../src/shared/templates';
import { ApiError } from './data';

export async function readTemplates(db: D1Database, owner: string): Promise<CollectionTemplate[]> {
  const row = await db
    .prepare('SELECT templates_json FROM collection_template_sets WHERE owner_id = ?')
    .bind(owner)
    .first<{ templates_json: string }>();
  return collectionTemplates.parse(JSON.parse(row?.templates_json ?? '[]'));
}
export function appendTemplates(db: D1Database, owner: string, templates: CollectionTemplate[]) {
  // One bounded JSON row makes concurrent additions and archive restore capacity checks atomic.
  return db
    .prepare(
      `INSERT INTO collection_template_sets (owner_id, templates_json) VALUES (?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET templates_json = (
      SELECT json_group_array(json(value)) FROM (
        SELECT value FROM json_each(collection_template_sets.templates_json)
        UNION ALL SELECT value FROM json_each(excluded.templates_json)
      )
    )`,
    )
    .bind(owner, JSON.stringify(templates));
}
export function templateCapacityError(error: unknown) {
  if (String(error).includes('collection_template_capacity'))
    throw new ApiError(
      409,
      'TEMPLATE_LIMIT',
      'Keep up to 50 collection templates. Remove one before saving or restoring more.',
    );
}
