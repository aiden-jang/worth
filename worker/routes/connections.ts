import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError, requireItem } from '../data';
import { readJson } from '../http';
import { creationId, fingerprint } from '../operations';
import { connectionInput, connectionNote, normalizeConnection } from '../../src/shared/connections';
import {
  connectionsQuery,
  connectionView,
  requireConnection,
  connectionCapacity,
  type ConnectionRow,
} from '../connections';
export function registerConnectionRoutes(api: Hono<AppEnv>) {
  api.get('/connections', async (c) => {
    const rows = await c.env.DB.prepare(`${connectionsQuery} ORDER BY c.created_at DESC,c.id`)
      .bind(c.get('ownerId'))
      .all<ConnectionRow>();
    return c.json({ connections: rows.results.map(connectionView) });
  });
  api.get('/connections/:id', async (c) =>
    c.json({
      connection: connectionView(await requireConnection(c.env.DB, c.get('ownerId'), c.req.param('id'))),
    }),
  );
  api.post('/connections', async (c) => {
    const input = normalizeConnection(await readJson(c.req.raw, connectionInput)),
      owner = c.get('ownerId'),
      id = creationId(c.req.header('Idempotency-Key')),
      hash = await fingerprint(input);
    async function previous() {
      const row = await c.env.DB.prepare('SELECT * FROM record_connections WHERE id=?')
        .bind(id)
        .first<ConnectionRow>();
      if (!row) return null;
      if (row.owner_id !== owner || row.fingerprint !== hash)
        throw new ApiError(
          409,
          'CONNECTION_CHANGED',
          'This retry differs from the saved connection. Start a new review.',
        );
      if (row.removed_at !== null)
        throw new ApiError(
          410,
          'CONNECTION_REMOVED',
          'This connection was removed. Start a new review to add it again.',
        );
      return connectionView(await requireConnection(c.env.DB, owner, id));
    }
    const saved = await previous();
    if (saved) return c.json({ connection: saved }, 201);
    await Promise.all([requireItem(c.env.DB, owner, input.fromId), requireItem(c.env.DB, owner, input.toId)]);
    try {
      const result = await c.env.DB.prepare(
        `WITH RECURSIVE chain(id) AS (
     SELECT ? UNION SELECT r.to_id FROM record_connections r JOIN chain p ON r.from_id=p.id
     WHERE r.owner_id=? AND r.kind='replaces' AND r.removed_at IS NULL)
    INSERT INTO record_connections (id,owner_id,from_id,to_id,kind,reason,fingerprint,created_at)
    SELECT ?,?,?,?,?,?,?,? WHERE
    EXISTS(SELECT 1 FROM active_items WHERE id=? AND owner_id=?) AND EXISTS(SELECT 1 FROM active_items WHERE id=? AND owner_id=?) AND
    NOT EXISTS(SELECT 1 FROM record_connections WHERE owner_id=? AND from_id=? AND to_id=? AND kind=? AND removed_at IS NULL) AND
    (? <> 'replaces' OR NOT EXISTS(SELECT 1 FROM chain WHERE id=?))`,
      )
        .bind(
          input.toId,
          owner,
          id,
          owner,
          input.fromId,
          input.toId,
          input.kind,
          input.reason,
          hash,
          Date.now(),
          input.fromId,
          owner,
          input.toId,
          owner,
          owner,
          input.fromId,
          input.toId,
          input.kind,
          input.kind,
          input.fromId,
        )
        .run();
      if (!result.meta.changes) {
        const raced = await previous();
        if (raced) return c.json({ connection: raced }, 201);
        throw new ApiError(
          409,
          'CONNECTION_CHANGED',
          'A record changed, this connection already exists, or the replacement would form a loop. Reload saved connections before trying again.',
        );
      }
    } catch (error) {
      const raced = await previous();
      if (raced) return c.json({ connection: raced }, 201);
      connectionCapacity(error);
      throw error;
    }
    return c.json({ connection: connectionView(await requireConnection(c.env.DB, owner, id)) }, 201);
  });
  api.put('/connections/:id', async (c) => {
    const owner = c.get('ownerId'),
      row = await requireConnection(c.env.DB, owner, c.req.param('id')),
      input = await readJson(c.req.raw, connectionNote);
    if (row.kind === 'replaces' && !input.reason.trim())
      throw new ApiError(400, 'INVALID_INPUT', 'Keep a reason for the replacement');
    const result = await c.env.DB.prepare(
      `UPDATE record_connections SET reason=?,revision=revision+1 WHERE id=? AND owner_id=? AND removed_at IS NULL AND revision=?
   AND from_id IN (SELECT id FROM record_items WHERE owner_id=?) AND to_id IN (SELECT id FROM record_items WHERE owner_id=?)`,
    )
      .bind(input.reason, row.id, owner, input.expectedRevision, owner, owner)
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        'CONNECTION_CHANGED',
        'This connection changed. Keep your draft and reload saved details.',
      );
    return c.json({ connection: connectionView(await requireConnection(c.env.DB, owner, row.id)) });
  });
  api.delete('/connections/:id', async (c) => {
    const owner = c.get('ownerId'),
      row = await requireConnection(c.env.DB, owner, c.req.param('id')),
      input = await readJson(c.req.raw, connectionNote.pick({ expectedRevision: true }));
    const result = await c.env.DB.prepare(
      `UPDATE record_connections SET removed_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND removed_at IS NULL AND revision=?
   AND from_id IN (SELECT id FROM record_items WHERE owner_id=?) AND to_id IN (SELECT id FROM record_items WHERE owner_id=?)`,
    )
      .bind(Date.now(), row.id, owner, input.expectedRevision, owner, owner)
      .run();
    if (!result.meta.changes)
      throw new ApiError(409, 'CONNECTION_CHANGED', 'This connection changed. Reload it before removing.');
    return c.body(null, 204);
  });
}
