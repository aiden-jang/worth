import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { exportRecords } from '../data';

export function registerExportRoutes(api: Hono<AppEnv>): void {
  api.get('/export/records', async (c) => {
    const archive = await exportRecords(c.env.DB, c.get('ownerId'));
    const date = archive.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(archive), {
      headers: {
        'Content-Disposition': `attachment; filename="worth-records-${date}.json"`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  });
}
