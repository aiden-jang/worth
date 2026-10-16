import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError } from '../data';
import { readJson } from '../http';
import { fingerprint } from '../operations';
import { appendTemplates, readTemplates, templateCapacityError } from '../templates';
import { collectionTemplate } from '../../src/shared/templates';

export function registerTemplateRoutes(api: Hono<AppEnv>) {
  api.get('/templates', async (c) => c.json({ templates: await readTemplates(c.env.DB, c.get('ownerId')) }));
  api.post('/templates', async (c) => {
    const owner = c.get('ownerId');
    const template = await readJson(c.req.raw, collectionTemplate);
    const hash = await fingerprint(template);
    const retry = async () => {
      const receipt = await c.env.DB.prepare(
        'SELECT fingerprint FROM collection_template_receipts WHERE owner_id = ? AND id = ?',
      )
        .bind(owner, template.id)
        .first<{ fingerprint: string }>();
      if (!receipt) return null;
      const saved = (await readTemplates(c.env.DB, owner)).find((entry) => entry.id === template.id);
      if (receipt.fingerprint !== hash || !saved)
        throw new ApiError(
          409,
          'TEMPLATE_CHANGED',
          'This template retry was changed or removed. Start a new template.',
        );
      return saved;
    };
    const previous = await retry();
    if (previous) return c.json({ template: previous }, 200);
    if ((await readTemplates(c.env.DB, owner)).some((entry) => entry.id === template.id))
      throw new ApiError(
        409,
        'TEMPLATE_CHANGED',
        'That template ID is already in use. Start a new template.',
      );
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          'INSERT INTO collection_template_receipts (owner_id, id, fingerprint) VALUES (?, ?, ?)',
        ).bind(owner, template.id, hash),
        appendTemplates(c.env.DB, owner, [template]),
      ]);
    } catch (error) {
      const saved = await retry();
      if (saved) return c.json({ template: saved }, 200);
      templateCapacityError(error);
      throw error;
    }
    return c.json({ template }, 201);
  });
  api.delete('/templates/:id', async (c) => {
    const owner = c.get('ownerId'),
      id = c.req.param('id');
    await c.env.DB.prepare(
      `UPDATE collection_template_sets
      SET templates_json = json_remove(templates_json, '$[' || (
        SELECT key FROM json_each(templates_json) WHERE json_extract(value, '$.id') = ?
      ) || ']')
      WHERE owner_id = ? AND EXISTS (
        SELECT 1 FROM json_each(templates_json) WHERE json_extract(value, '$.id') = ?
      )`,
    )
      .bind(id, owner, id)
      .run();
    // Retain the receipt so a late retry cannot recreate a removed template.
    return c.body(null, 204);
  });
}
