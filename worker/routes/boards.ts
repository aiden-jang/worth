import type { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../context';
import { boardInput, boardPatch } from '../../src/shared/memory-boards';
import { boardSummaries, createBoard, readBoard, updateBoard, removeBoard } from '../memory-boards';
import { readJson } from '../http';
import { operationId } from '../operations';
const removing = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
export function registerBoardRoutes(api: Hono<AppEnv>) {
  api.get('/boards', async (c) => c.json({ boards: await boardSummaries(c.env.DB, c.get('ownerId')) }));
  api.get('/boards/:id', async (c) =>
    c.json({ board: await readBoard(c.env.DB, c.get('ownerId'), c.req.param('id')) }),
  );
  api.post('/boards', async (c) => {
    const input = await readJson(c.req.raw, boardInput, 256 * 1024);
    return c.json(
      {
        board: await createBoard(
          c.env.DB,
          c.get('ownerId'),
          operationId(c.req.header('Idempotency-Key')),
          input,
        ),
      },
      201,
    );
  });
  api.put('/boards/:id', async (c) => {
    const input = await readJson(c.req.raw, boardPatch, 256 * 1024);
    return c.json({
      board: await updateBoard(
        c.env.DB,
        c.get('ownerId'),
        c.req.param('id'),
        input.board,
        input.expectedRevision,
      ),
    });
  });
  api.delete('/boards/:id', async (c) => {
    const input = await readJson(c.req.raw, removing);
    await removeBoard(c.env.DB, c.get('ownerId'), c.req.param('id'), input.expectedRevision);
    return c.body(null, 204);
  });
}
