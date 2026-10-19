import {
  sourcePreview,
  sourceReviewHash,
  snapshotData,
  sourceSelection,
  type SourceSelection,
  type SourcePreview,
  type SnapshotData,
} from '../src/shared/record-snapshots';
import { galleryEntries } from '../src/shared/photo-gallery';
import { imageDimensions } from '../src/shared/image-dimensions';
import { ApiError } from './data';
import { photoContentType } from './http';
import { photoFingerprint } from './photo-gallery';

type SourceRow = {
  id: string;
  list_id: string;
  list_name: string;
  ranked_ids: string;
  rank_revision: number;
  title: string;
  type: string | null;
  note: string;
  decision: 'favorite' | 'meh' | 'would_not_again' | null;
  started_on: string | null;
  ended_on: string | null;
  happened_on: string | null;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
  exercise_sets: string;
  weight_unit: 'kg' | 'lb';
  measurements_json: string;
  exercise_mode: number;
  gallery_json: string;
  gallery_revision: number;
};
type PhotoRow = {
  id: string;
  content_type: 'image/jpeg' | 'image/png' | 'image/webp';
  fingerprint: string | null;
  data: number[] | null;
  available: number;
};
type PreparedSourcePhoto = {
  id: string;
  contentType: PhotoRow['content_type'];
  digest: string;
  bytes: Uint8Array;
};
export type PreparedSource = {
  preview: SourcePreview;
  guards: D1PreparedStatement[];
  photos: PreparedSourcePhoto[];
};
function query(kind: 'item' | 'log') {
  return kind === 'item'
    ? `SELECT i.id,i.list_id,l.name AS list_name,l.ranked_ids,l.rank_revision,
 i.title,i.type,i.note,i.decision,i.started_on,i.ended_on,NULL AS happened_on,
 NULL AS amount,'' AS unit,NULL AS sets,NULL AS reps,'[]' AS exercise_sets,'kg' AS weight_unit,'[]' AS measurements_json,0 AS exercise_mode,
 i.gallery_json,i.gallery_revision FROM active_items i JOIN active_lists l ON l.id=i.list_id AND l.owner_id=i.owner_id WHERE i.owner_id=? AND i.id=?`
    : `SELECT g.id,g.list_id,l.name AS list_name,l.ranked_ids,l.rank_revision,
 COALESCE(NULLIF(g.title,''),p.title,'Visit') AS title,NULL AS type,g.note,NULL AS decision,NULL AS started_on,NULL AS ended_on,g.happened_on,
 g.amount,g.unit,g.sets,g.reps,g.exercise_sets,g.weight_unit,g.measurements_json,g.exercise_mode,g.gallery_json,g.gallery_revision
 FROM active_logs g JOIN active_lists l ON l.id=g.list_id AND l.owner_id=g.owner_id
 LEFT JOIN record_items p ON p.id=g.item_id AND p.owner_id=g.owner_id AND p.list_id=g.list_id WHERE g.owner_id=? AND g.id=?`;
}
async function load(db: D1Database, owner: string, selection: SourceSelection, bytes: boolean) {
  const [records, photos] = await db.batch([
    db.prepare(query(selection.kind)).bind(owner, selection.id),
    db
      .prepare(
        `SELECT id,content_type,fingerprint,${bytes ? 'data' : 'NULL AS data'},data IS NOT NULL AS available FROM photo_assets WHERE owner_id=? AND ${selection.kind === 'item' ? 'item_id' : 'log_id'}=? AND removed_at IS NULL AND id IN (SELECT value FROM json_each(?))`,
      )
      .bind(owner, selection.id, JSON.stringify(selection.photoIds)),
  ]);
  const row = records.results[0] as SourceRow | undefined;
  if (!row)
    throw new ApiError(
      404,
      'SOURCE_UNAVAILABLE',
      'This record is unavailable. Its earlier review stays in your draft.',
    );
  return {
    row,
    photos: photos.results as PhotoRow[],
    gallery: galleryEntries.parse(JSON.parse(row.gallery_json)),
  };
}
function project(row: SourceRow, selection: SourceSelection): SnapshotData {
  const fields = new Set(selection.fields),
    data: SnapshotData = { title: row.title };
  if (fields.has('type')) data.type = row.type ?? '';
  if (fields.has('decision')) data.decision = row.decision;
  if (fields.has('rank')) {
    const rank = (JSON.parse(row.ranked_ids) as string[]).indexOf(row.id);
    data.rank = rank === -1 ? null : rank + 1;
  }
  if (fields.has('note')) data.note = row.note;
  if (fields.has('dates'))
    data.dates =
      selection.kind === 'item'
        ? { startedOn: row.started_on, endedOn: row.ended_on }
        : { happenedOn: row.happened_on! };
  if (fields.has('results'))
    data.results = {
      amount: row.amount,
      unit: row.unit,
      sets: row.sets,
      reps: row.reps,
      exerciseSets: JSON.parse(row.exercise_sets),
      weightUnit: row.weight_unit,
      measurements: JSON.parse(row.measurements_json),
      exercise: !!row.exercise_mode,
    };
  return snapshotData.parse(data);
}
/** Guard every value read, including fallback visit names and independent gallery/rank state. */
function sourceGuard(db: D1Database, owner: string, selection: SourceSelection, row: SourceRow) {
  const fields = Object.entries(row);
  return db
    .prepare(
      `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM (${query(selection.kind)}) source WHERE ${fields.map(([key]) => `source.${key} IS ?`).join(' AND ')}) THEN 'null' ELSE 'snapshot source changed' END)`,
    )
    .bind(owner, selection.id, ...fields.map(([, value]) => value));
}
export async function prepareRecordSource(
  db: D1Database,
  owner: string,
  raw: SourceSelection,
): Promise<PreparedSource> {
  const selection = sourceSelection.parse(raw),
    loaded = await load(db, owner, selection, true),
    { row } = loaded;
  const guards = [sourceGuard(db, owner, selection, row)],
    copies: PreparedSourcePhoto[] = [],
    photos: SourcePreview['photos'] = [];
  for (const id of selection.photoIds) {
    const asset = loaded.photos.find((photo) => photo.id === id),
      metadata = loaded.gallery.find((photo) => photo.id === id);
    if (!asset?.data || !metadata)
      throw new ApiError(
        409,
        'SOURCE_CHANGED',
        'A chosen photo is unavailable. Review the source again or remove that choice.',
      );
    const bytes = new Uint8Array(asset.data);
    if (bytes.byteLength > 900000)
      throw new ApiError(413, 'PHOTO_TOO_LARGE', 'Choose a source photo up to 900 KB.');
    try {
      if (photoContentType(bytes) !== asset.content_type) throw new Error('Photo type changed');
      imageDimensions(bytes, asset.content_type);
    } catch {
      throw new ApiError(
        409,
        'SOURCE_CHANGED',
        'A chosen photo cannot be reviewed. Choose another photo or keep this snapshot without it.',
      );
    }
    const digest = await photoFingerprint(bytes);
    if (asset.fingerprint && asset.fingerprint !== digest)
      throw new ApiError(409, 'SOURCE_CHANGED', 'A chosen photo changed. Review its source again.');
    photos.push({
      id,
      contentType: asset.content_type,
      digest,
      caption: metadata.caption,
      arrows: metadata.arrows,
      available: true,
    });
    copies.push({ id, contentType: asset.content_type, digest, bytes });
    guards.push(
      db
        .prepare(
          `SELECT json(CASE WHEN EXISTS(SELECT 1 FROM photo_assets WHERE id=? AND owner_id=? AND ${selection.kind === 'item' ? 'item_id' : 'log_id'}=? AND removed_at IS NULL AND content_type=? AND fingerprint IS ? AND data=?) THEN 'null' ELSE 'snapshot photo changed' END)`,
        )
        .bind(id, owner, selection.id, asset.content_type, asset.fingerprint, bytes),
    );
  }
  const content = { selection, listName: row.list_name, data: project(row, selection), photos };
  const hash = await sourceReviewHash(content);
  return {
    preview: sourcePreview.parse({ ...content, hash, previewedAt: Date.now() }),
    guards,
    photos: copies,
  };
}
export async function currentRecordSource(db: D1Database, owner: string, selection: SourceSelection) {
  const loaded = await load(db, owner, selection, false);
  return {
    listName: loaded.row.list_name,
    data: project(loaded.row, selection),
    photos: selection.photoIds.map((sourceAssetId) => {
      const asset = loaded.photos.find((photo) => photo.id === sourceAssetId),
        metadata = loaded.gallery.find((photo) => photo.id === sourceAssetId);
      return {
        sourceAssetId,
        available: !!asset?.available && !!metadata,
        caption: metadata?.caption ?? '',
        arrows: metadata?.arrows ?? [],
      };
    }),
  };
}
