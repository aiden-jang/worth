import { exportReceiptPhotos, restoreReceiptRows } from '../receipt-portability';
import { exportCapsulePhotos, prepareCapsuleRestore } from '../capsule-portability';
import { capsuleFailure } from '../capsules';
import { receiptFailure } from '../receipts';
import { photoFingerprint } from '../photo-gallery';
import { connectionCapacity } from '../connections';
import { normalizeConnection } from '../../src/shared/connections';
import { inboxChanged, inboxGuard } from '../inbox';
import { inboxLimit } from '../../src/shared/inbox';
import { itemInput } from '../../src/shared/validation';
import { appendTemplates, templateCapacityError } from '../templates';
import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { archiveFile, archiveByteLimit, type ArchiveFile } from '../../src/shared/portability';
import { boardForm, boardPayload } from '../../src/shared/memory-boards';
import { ApiError, exportRecords } from '../data';
import { readBytes, photoContentType } from '../http';
import { operationId, fingerprint, previousOperation } from '../operations';

export function registerPortabilityRoutes(api: Hono<AppEnv>) {
  api.get('/export/backup', async (c) => {
    const owner = c.get('ownerId');
    const records = await exportRecords(c.env.DB, owner);
    if (
      records.lists.length > 500 ||
      records.lists.length +
        records.items.length +
        records.logs.length +
        records.workoutSessions.length +
        records.workoutRoutines.length +
        records.inbox.length +
        records.boards.length +
        records.receipts.length +
        records.sharedArchives.length +
        records.sharedArchives.reduce((n, copy) => n + copy.entries.length, 0) +
        records.capsules.length +
        records.capsules.reduce(
          (sum, capsule) => sum + capsule.entries.reduce((count, entry) => count + entry.photos.length, 0),
          0,
        ) >
        5000
    )
      throw new ApiError(
        413,
        'BACKUP_TOO_LARGE',
        'This archive exceeds the restore limit of 5,000 records or 500 lists. Export records and contact support for a full archive transfer.',
      );
    const photos: ArchiveFile['photos'] = [];
    let photoBytes = 0;
    for (const [kind, table, field] of [
      ['list', 'list_photos', 'list_id'],
      ['asset', 'photo_assets', 'id'],
    ] as const) {
      const eligible =
        kind === 'list'
          ? `${field} IN (SELECT id FROM active_lists WHERE owner_id=?)`
          : 'id IN (SELECT value FROM json_each(?)) AND removed_at IS NULL AND data IS NOT NULL';
      const scope =
        kind === 'list'
          ? owner
          : JSON.stringify(
              records.photoAssets.filter((source) => source.available).map((source) => source.id),
            );
      const stats = await c.env.DB.prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(length(data)),0) AS bytes FROM ${table} WHERE owner_id = ? AND ${eligible}`,
      )
        .bind(owner, scope)
        .first<{ n: number; bytes: number }>();
      photoBytes += stats?.bytes ?? 0;
      if (photos.length + (stats?.n ?? 0) > 200 || photoBytes > 22 * 1024 * 1024)
        throw new ApiError(
          413,
          'BACKUP_TOO_LARGE',
          'Photo backups support up to 200 photos/covers and 32 MB. Export records and contact support for a full archive transfer.',
        );
      for (let offset = 0; offset < (stats?.n ?? 0); offset += 6) {
        const rows = await c.env.DB.prepare(
          `SELECT ${field} AS id, content_type, data FROM ${table} WHERE owner_id = ? AND ${eligible} ORDER BY ${field} LIMIT 6 OFFSET ?`,
        )
          .bind(owner, scope, offset)
          .all<{ id: string; content_type: string; data: number[] }>();
        for (const row of rows.results) {
          const bytes = new Uint8Array(row.data);
          const source = kind === 'asset' ? records.photoAssets.find((source) => source.id === row.id) : null;
          if (
            source &&
            (source.contentType !== row.content_type ||
              (source.fingerprint && (await photoFingerprint(bytes)) !== source.fingerprint))
          )
            throw new ApiError(
              409,
              'EXPORT_CHANGED',
              'A photo changed while preparing this backup. Try again.',
            );
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192)
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          photos.push({ kind, id: row.id, contentType: photoContentType(bytes), data: btoa(binary) });
        }
      }
    }
    await exportReceiptPhotos(c.env.DB, owner, records.receipts, photos, photoBytes);
    await exportCapsulePhotos(c.env.DB, owner, records.capsules, photos);
    if (photos.length > 200)
      throw new ApiError(
        413,
        'BACKUP_TOO_LARGE',
        'Photo backups support up to 200 photos or covers. Export records and contact support for a full archive transfer.',
      );
    const candidate = { ...records, photosExcluded: false, photos };
    const expected = [
      ...records.lists.filter((l) => l.hasCoverPhoto).map((l) => `list:${l.id}`),
      ...records.photoAssets.filter((source) => source.available).map((source) => `asset:${source.id}`),
      ...records.receipts
        .filter((receipt) => receipt.attachment?.available)
        .map((receipt) => `receipt:${receipt.id}`),
      ...records.capsules.flatMap((capsule) =>
        capsule.entries.flatMap((entry) =>
          entry.photos.filter((photo) => photo.available).map((photo) => `capsule:${photo.id}`),
        ),
      ),
    ];
    const keys = new Set(photos.map((p) => `${p.kind}:${p.id}`));
    const coverConsistent = [...records.items, ...records.logs].every(
      (record) =>
        record.hasPhoto ===
        !!records.photoAssets.find((source) => source.id === record.coverPhotoId && source.available),
    );
    if (
      !coverConsistent ||
      !archiveFile.safeParse(candidate).success ||
      expected.some((key) => !keys.has(key))
    )
      throw new ApiError(
        409,
        'EXPORT_CHANGED',
        'The archive changed while preparing this backup. Try again when saving has finished.',
      );
    const body = JSON.stringify(candidate);
    if (new TextEncoder().encode(body).byteLength > archiveByteLimit)
      throw new ApiError(
        413,
        'BACKUP_TOO_LARGE',
        'This backup exceeds 32 MB. Export records separately and contact support.',
      );
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="worth-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  });
  api.delete('/data', async (c) => {
    if (c.req.header('X-Worth-Confirmation') !== 'delete-all-worth-data')
      throw new ApiError(400, 'CONFIRM_REQUIRED', 'Confirm deletion of all Worth data');
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM inbox_entries WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM inbox_operations WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM collection_template_sets WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM collection_template_receipts WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM memory_boards WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM receipts WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM time_capsules WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare(
        'UPDATE private_spaces SET revision=revision+1 WHERE id IN(SELECT space_id FROM space_entries WHERE author_id=?)',
      ).bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM space_entries WHERE author_id=?').bind(c.get('ownerId')),
      c.env.DB.prepare('UPDATE space_members SET revoked_at=? WHERE account_id=?').bind(
        Date.now(),
        c.get('ownerId'),
      ),
      c.env.DB.prepare('DELETE FROM private_spaces WHERE owner_id=?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM shared_archives WHERE owner_id=?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM lists WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM capture_operations WHERE owner_id = ?').bind(c.get('ownerId')),
      c.env.DB.prepare('DELETE FROM archive_operations WHERE owner_id = ?').bind(c.get('ownerId')),
    ]);
    return c.body(null, 204);
  });
  api.post('/import', async (c) => {
    if (!c.req.header('Content-Type')?.includes('application/json'))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Choose a Worth JSON backup');
    const key = operationId(c.req.header('Idempotency-Key'));
    let raw: unknown;
    try {
      raw = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(await readBytes(c.req.raw, archiveByteLimit)),
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'INVALID_JSON', 'This file is not valid JSON');
    }
    const parsed = archiveFile.safeParse(raw);
    if (!parsed.success)
      throw new ApiError(400, 'INVALID_BACKUP', parsed.error.issues[0]?.message ?? 'Invalid Worth backup');
    const file = parsed.data;
    const owner = c.get('ownerId');
    const hash = await fingerprint(file);
    const previous = await previousOperation(c.env.DB, key, owner, 'import', hash);
    if (previous) return c.json(previous, 201);
    const map = new Map(
      [
        ...file.lists,
        ...file.items,
        ...file.logs,
        ...file.workoutSessions,
        ...file.workoutRoutines,
        ...file.inbox,
        ...file.photoAssets,
        ...file.boards,
        ...file.receipts,
        ...file.sharedArchives,
        ...file.sharedArchives.flatMap((copy) => copy.entries),
        ...file.capsules,
        ...file.capsules.flatMap((capsule) => capsule.entries.flatMap((entry) => entry.photos)),
      ].map((r) => [r.id, crypto.randomUUID()]),
    );
    const id = (source: string) => map.get(source)!;
    const result = { ids: file.lists.map((l) => id(l.id)) };
    const statements: D1PreparedStatement[] = [
      c.env.DB.prepare(
        'INSERT INTO capture_operations (id, owner_id, kind, fingerprint, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(key, owner, 'import', hash, JSON.stringify(result), Date.now()),
    ];
    if (file.collectionTemplates.length)
      statements.push(
        appendTemplates(
          c.env.DB,
          owner,
          file.collectionTemplates.map((template) => ({ ...template, id: crypto.randomUUID() })),
        ),
      );
    if (file.inbox.length)
      statements.push(
        inboxGuard(
          c.env.DB,
          'SELECT COUNT(*) + ? <= ? FROM inbox_entries WHERE owner_id = ? AND trashed_at IS NULL',
          [file.inbox.length, inboxLimit, owner],
        ),
      );
    // JSON row batches keep restore below D1's per-request query/parameter limits.
    const rows = (table: string, values: Record<string, unknown>[]) => {
      if (!values.length) return;
      const columns = Object.keys(values[0]);
      let chunk: string[] = [],
        size = 2;
      const flush = () => {
        if (!chunk.length) return;
        statements.push(
          c.env.DB.prepare(
            `INSERT INTO ${table} (${columns.join(',')}) SELECT ${columns.map((name) => `json_extract(value, '$.${name}')`).join(',')} FROM json_each(?)`,
          ).bind('[' + chunk.join(',') + ']'),
        );
        chunk = [];
        size = 2;
      };
      for (const value of values) {
        const row = JSON.stringify(value);
        const bytes = new TextEncoder().encode(row).length;
        if (size + bytes > 1500000) flush();
        chunk.push(row);
        size += bytes + 1;
      }
      flush();
    };
    rows(
      'lists',
      file.lists.map((l) => ({
        id: id(l.id),
        owner_id: owner,
        name: l.name,
        kind: l.kind,
        exercise_aliases: JSON.stringify(
          l.exerciseAliases.map((group) => ({ ...group, id: crypto.randomUUID() })),
        ),
        archived: l.archived ? 1 : 0,
        description: l.description,
        artwork: l.artwork ? JSON.stringify(l.artwork) : null,
        ranked_ids: JSON.stringify(l.rankedIds.map(id)),
        workspace_json: JSON.stringify({
          ...l.workspace,
          ...(l.workspace.duplicateReviews
            ? {
                duplicateReviews: l.workspace.duplicateReviews.map((review) => ({
                  ...review,
                  id: crypto.randomUUID(),
                  itemIds: review.itemIds.map(id),
                })),
              }
            : {}),
          ...(l.workspace.shelf
            ? {
                shelf: {
                  ...l.workspace.shelf,
                  keepsakeId: l.workspace.shelf.keepsakeId ? id(l.workspace.shelf.keepsakeId) : null,
                  inscription: l.workspace.shelf.inscription
                    ? { ...l.workspace.shelf.inscription, itemId: id(l.workspace.shelf.inscription.itemId) }
                    : null,
                },
              }
            : {}),
          rankings: l.workspace.rankings.map((ranking) => ({
            ...ranking,
            id: crypto.randomUUID(),
            itemIds: ranking.itemIds.map(id),
          })),
          views: l.workspace.views.map((view) => ({ ...view, id: crypto.randomUUID() })),
        }),
        created_at: l.updatedAt,
        updated_at: l.updatedAt,
      })),
    );
    rows(
      'inbox_entries',
      file.inbox.map((entry) => ({
        id: id(entry.id),
        owner_id: owner,
        payload_json: JSON.stringify(itemInput.parse(entry)),
        revision: 0,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })),
    );
    rows(
      'items',
      file.items.map((i) => ({
        id: id(i.id),
        list_id: id(i.listId),
        owner_id: owner,
        title: i.title,
        type: i.type,
        note: i.note,
        decision: i.decision,
        revisit_queued: i.revisitQueued ? 1 : 0,
        want_to_try: i.wantToTry ? 1 : 0,
        context_json: JSON.stringify(i.context),
        merged_into_id: i.mergedIntoId ? id(i.mergedIntoId) : null,
        gallery_json: JSON.stringify(
          i.gallery.map((entry) => ({
            ...entry,
            id: id(entry.id),
            arrows: entry.arrows.map((arrow) => ({ ...arrow, id: crypto.randomUUID() })),
          })),
        ),
        cover_photo_id: i.coverPhotoId ? id(i.coverPhotoId) : null,
        started_on: i.startedOn,
        ended_on: i.endedOn,
        created_at: i.createdAt,
        updated_at: i.updatedAt,
      })),
    );
    rows(
      'workout_sessions',
      file.workoutSessions.map((w) => ({
        id: id(w.id),
        list_id: id(w.listId),
        owner_id: owner,
        title: w.title,
        happened_on: w.happenedOn,
        planned_exercises: JSON.stringify(w.plannedExercises),
        targets_json: JSON.stringify(w.targets),
        skipped_exercises: JSON.stringify(w.skippedExercises),
        status: w.status,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
      })),
    );
    rows(
      'workout_routines',
      file.workoutRoutines.map((r) => ({
        id: id(r.id),
        list_id: id(r.listId),
        owner_id: owner,
        title: r.title,
        exercises: JSON.stringify(r.exercises),
        targets_json: JSON.stringify(r.targets),
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),
    );
    rows(
      'logs',
      file.logs.map((g) => ({
        id: id(g.id),
        list_id: id(g.listId),
        owner_id: owner,
        item_id: g.itemId ? id(g.itemId) : null,
        title: g.title,
        happened_on: g.happenedOn,
        context_json: JSON.stringify(g.context),
        gallery_json: JSON.stringify(
          g.gallery.map((entry) => ({
            ...entry,
            id: id(entry.id),
            arrows: entry.arrows.map((arrow) => ({ ...arrow, id: crypto.randomUUID() })),
          })),
        ),
        cover_photo_id: g.coverPhotoId ? id(g.coverPhotoId) : null,
        note: g.note,
        amount: g.amount,
        unit: g.unit,
        sets: g.sets,
        reps: g.reps,
        exercise_sets: JSON.stringify(g.exerciseSets),
        measurements_json: JSON.stringify(g.measurements),
        exercise_mode: g.exercise || g.exerciseSets.length ? 1 : 0,
        weight_unit: g.weightUnit,
        workout_id: g.workoutId ? id(g.workoutId) : null,
        created_at: g.createdAt,
        updated_at: g.updatedAt,
      })),
    );
    rows(
      'record_connections',
      file.connections.map((link) => {
        const remapped = normalizeConnection({ ...link, fromId: id(link.fromId), toId: id(link.toId) });
        return {
          id: crypto.randomUUID(),
          owner_id: owner,
          from_id: remapped.fromId,
          to_id: remapped.toId,
          kind: link.kind,
          reason: link.reason,
          fingerprint: 'restored',
          revision: 0,
          created_at: link.createdAt,
        };
      }),
    );
    rows(
      'taste_history',
      file.tasteHistory.map((event) => ({
        id: crypto.randomUUID().replaceAll('-', ''),
        owner_id: owner,
        kind: event.kind,
        list_id: event.listId ? id(event.listId) : null,
        item_id: event.itemId ? id(event.itemId) : null,
        before_json: JSON.stringify(
          event.kind === 'rank' ? event.before.map((value) => (value ? id(value) : null)) : event.before,
        ),
        after_json: JSON.stringify(
          event.kind === 'rank' ? event.after.map((value) => (value ? id(value) : null)) : event.after,
        ),
        reason: event.reason,
        log_id: event.logId ? id(event.logId) : null,
        revision: 0,
        created_at: event.createdAt,
      })),
    );

    rows(
      'photo_assets',
      file.photoAssets.map((source) => ({
        id: id(source.id),
        owner_id: owner,
        item_id: source.kind === 'item' ? id(source.recordId) : null,
        log_id: source.kind === 'log' ? id(source.recordId) : null,
        content_type: source.contentType,
        fingerprint: source.fingerprint,
        created_at: source.createdAt,
      })),
    );
    const restoredBoards = await Promise.all(
      file.boards.map(async (board) => {
        const body = boardPayload(boardForm(board));
        body.entries = body.entries.map((entry) => ({
          ...entry,
          id: crypto.randomUUID(),
          reference: entry.reference ? { ...entry.reference, id: id(entry.reference.id) } : null,
        }));
        return {
          id: id(board.id),
          owner_id: owner,
          body_json: JSON.stringify(body),
          revision: 0,
          create_hash: await fingerprint(body),
          created_at: board.createdAt,
          updated_at: board.updatedAt,
        };
      }),
    );
    rows('memory_boards', restoredBoards);
    statements.push(...(await restoreReceiptRows(c.env.DB, owner, file, id)));
    const capsules = await prepareCapsuleRestore(c.env.DB, owner, file, id);
    rows(
      'shared_archives',
      file.sharedArchives.map((copy) => ({
        id: id(copy.id),
        owner_id: owner,
        body_json: JSON.stringify({
          ...copy,
          id: id(copy.id),
          entries: copy.entries.map((entry) => ({ ...entry, id: id(entry.id) })),
        }),
      })),
    );
    rows('time_capsules', capsules.capsules);
    rows('capsule_photos', capsules.photos);
    statements.push(...capsules.statements);
    const assetPhotos = file.photos.filter((photo) => photo.kind === 'asset');
    for (let at = 0; at < assetPhotos.length; at += 20) {
      const group = assetPhotos.slice(at, at + 20),
        bindings: (string | Uint8Array)[] = [];
      for (const photo of group) {
        const bytes = Uint8Array.from(atob(photo.data), (character) => character.charCodeAt(0)),
          source = file.photoAssets.find((source) => source.id === photo.id)!;
        if (
          bytes.length > 900000 ||
          photoContentType(bytes) !== source.contentType ||
          (source.fingerprint && (await photoFingerprint(bytes)) !== source.fingerprint)
        )
          throw new ApiError(
            400,
            'INVALID_PHOTO',
            'A backup original has an invalid type, size or fingerprint.',
          );
        bindings.push(id(photo.id), bytes);
      }
      statements.push(
        c.env.DB.prepare(
          `UPDATE photo_assets SET data=CASE id ${group.map(() => 'WHEN ? THEN ?').join(' ')} ELSE data END WHERE owner_id=? AND id IN(SELECT value FROM json_each(?))`,
        ).bind(...bindings, owner, JSON.stringify(group.map((photo) => id(photo.id)))),
      );
    }
    if (file.photoAssets.length)
      for (const [table, field, parent] of [
        ['item_photos', 'item_id', 'items'],
        ['log_photos', 'log_id', 'logs'],
      ] as const)
        statements.push(
          c.env.DB.prepare(
            `INSERT INTO ${table}(${field},owner_id,content_type,data,updated_at) SELECT p.id,p.owner_id,a.content_type,a.data,? FROM ${parent} p JOIN photo_assets a ON a.id=p.cover_photo_id AND a.owner_id=p.owner_id AND a.${field}=p.id WHERE p.owner_id=? AND p.list_id IN(SELECT value FROM json_each(?)) AND a.removed_at IS NULL AND a.data IS NOT NULL`,
          ).bind(Date.now(), owner, JSON.stringify(result.ids)),
        );
    for (const [kind, table, field] of [
      ['list', 'list_photos', 'list_id'],
      ['item', 'item_photos', 'item_id'],
      ['log', 'log_photos', 'log_id'],
    ] as const) {
      const photos = file.photos.filter((p) => p.kind === kind);
      for (let index = 0; index < photos.length; index += 20) {
        const group = photos.slice(index, index + 20);
        const bindings: (string | number | Uint8Array)[] = [];
        const assetBindings: (string | number | Uint8Array)[] = [];
        const albums: { recordId: string; assetId: string }[] = [];
        for (const p of group) {
          let binary: string;
          try {
            binary = atob(p.data);
          } catch {
            throw new ApiError(400, 'INVALID_PHOTO', 'A backup photo is invalid');
          }
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
          if (bytes.length > 900000 || photoContentType(bytes) !== p.contentType)
            throw new ApiError(400, 'INVALID_PHOTO', 'A backup photo has an invalid type or size');
          bindings.push(id(p.id), owner, p.contentType, bytes, Date.now());
          if (kind !== 'list') {
            const assetId = crypto.randomUUID();
            assetBindings.push(
              assetId,
              owner,
              id(p.id),
              p.contentType,
              bytes,
              await photoFingerprint(bytes),
              Date.now(),
            );
            albums.push({ recordId: id(p.id), assetId });
          }
        }
        statements.push(
          c.env.DB.prepare(
            `INSERT INTO ${table} (${field},owner_id,content_type,data,updated_at) VALUES ${group.map(() => '(?,?,?,?,?)').join(',')}`,
          ).bind(...bindings),
        );
        if (kind !== 'list' && albums.length) {
          statements.push(
            c.env.DB.prepare(
              `INSERT INTO photo_assets(id,owner_id,${field},content_type,data,fingerprint,created_at) VALUES ${albums.map(() => '(?,?,?,?,?,?,?)').join(',')}`,
            ).bind(...assetBindings),
          );
          statements.push(
            c.env.DB.prepare(
              `UPDATE ${kind === 'item' ? 'items' : 'logs'} SET cover_photo_id=(SELECT json_extract(value,'$.assetId') FROM json_each(?) WHERE json_extract(value,'$.recordId')=${kind === 'item' ? 'items' : 'logs'}.id), gallery_json=(SELECT json_array(json_object('id',json_extract(value,'$.assetId'),'caption','','arrows',json('[]'))) FROM json_each(?) WHERE json_extract(value,'$.recordId')=${kind === 'item' ? 'items' : 'logs'}.id) WHERE owner_id=? AND id IN (SELECT json_extract(value,'$.recordId') FROM json_each(?))`,
            ).bind(JSON.stringify(albums), JSON.stringify(albums), owner, JSON.stringify(albums)),
          );
        }
      }
    }
    if (statements.length > 44)
      throw new ApiError(
        413,
        'BACKUP_TOO_LARGE',
        'This file is too large to restore in one operation. Contact support for an archive transfer.',
      );
    try {
      await c.env.DB.batch(statements);
    } catch (error) {
      const saved = await previousOperation(c.env.DB, key, owner, 'import', hash);
      if (saved) return c.json(saved, 201);
      if (error instanceof Error && error.message.includes('board capacity reached'))
        throw new ApiError(
          409,
          'BOARD_LIMIT',
          'Restoring these boards would exceed 100 boards. Remove a board, then retry this same restore.',
        );
      if (error instanceof Error && error.message.includes('shared archive capacity reached'))
        throw new ApiError(
          409,
          'SHARED_COPY_LIMIT',
          'Restoring these shared copies would exceed 50 private copies. Remove a copy, then retry this same restore.',
        );
      templateCapacityError(error);
      connectionCapacity(error);
      if (error instanceof Error && error.message.includes('receipt capacity reached')) receiptFailure(error);
      if (error instanceof Error && error.message.includes('capsule capacity reached')) capsuleFailure(error);
      inboxChanged(error);
    }
    return c.json(result, 201);
  });
}
