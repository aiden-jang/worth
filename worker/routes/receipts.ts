import type { Hono } from 'hono';
import type { AppEnv } from '../context';
import { ApiError } from '../data';
import { photoContentType, readBytes } from '../http';
import { operationId } from '../operations';
import { receiptInput, receiptDigest } from '../../src/shared/receipts';
import { imageDimensions } from '../../src/shared/image-dimensions';
import { createReceipt, readReceipt, receiptSummaries, removeReceipt } from '../receipts';
export function registerReceiptRoutes(api: Hono<AppEnv>) {
  api.get('/receipts', async (c) => c.json({ receipts: await receiptSummaries(c.env.DB, c.get('ownerId')) }));
  api.get('/receipts/:id', async (c) =>
    c.json({
      receipt: await readReceipt(c.env.DB, c.get('ownerId'), c.req.param('id')),
    }),
  );
  api.get('/receipts/:id/attachment', async (c) => {
    const row = await c.env.DB.prepare(
      "SELECT attachment_data,json_extract(body_json,'$.attachment.contentType') AS type FROM receipts WHERE owner_id=? AND id=? AND removed_at IS NULL AND attachment_data IS NOT NULL",
    )
      .bind(c.get('ownerId'), c.req.param('id'))
      .first<{ attachment_data: number[]; type: string }>();
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');
    return new Response(new Uint8Array(row.attachment_data), {
      headers: { 'Content-Type': row.type },
    });
  });
  api.post('/receipts', async (c) => {
    const key = operationId(c.req.header('Idempotency-Key'));
    const type = c.req.header('Content-Type') ?? '';
    if (!type.toLowerCase().startsWith('multipart/form-data;'))
      throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send a reviewed receipt form.');
    const bytes = await readBytes(c.req.raw, 1200000);
    let form: FormData;
    try {
      form = await new Request('https://worth.test/receipt', {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: new Uint8Array(bytes),
      }).formData();
    } catch {
      throw new ApiError(400, 'INVALID_FORM', 'Choose a valid receipt form.');
    }
    if (
      [...form.keys()].some((key) => key !== 'receipt' && key !== 'attachment') ||
      form.getAll('receipt').length !== 1 ||
      form.getAll('attachment').length > 1
    )
      throw new ApiError(400, 'INVALID_FORM', 'Send one reviewed receipt and at most one attachment.');
    const metadata = form.get('receipt');
    if (typeof metadata !== 'string' || new TextEncoder().encode(metadata).length > 256 * 1024)
      throw new ApiError(400, 'INVALID_FORM', 'Receipt text is unavailable or too long.');
    let raw: unknown;
    try {
      raw = JSON.parse(metadata);
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Receipt text is not valid JSON.');
    }
    const parsed = receiptInput.safeParse(raw);
    if (!parsed.success)
      throw new ApiError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Check this receipt.');
    const file = form.get('attachment'),
      info = parsed.data.attachment;
    let attachment: Uint8Array | null = null;
    if (info) {
      if (!info.available || !(file instanceof File) || !file.size || file.size > 900000)
        throw new ApiError(400, 'INVALID_ATTACHMENT', 'Attach the exact reviewed copy, up to 900 KB.');
      attachment = new Uint8Array(await file.arrayBuffer());
      const detected = photoContentType(attachment);
      if (
        detected !== info.contentType ||
        file.type !== detected ||
        (await receiptDigest(file)) !== info.digest
      )
        throw new ApiError(400, 'ATTACHMENT_CHANGED', 'This attachment differs from the reviewed copy.');
      try {
        imageDimensions(attachment, detected);
      } catch (error) {
        throw new ApiError(
          400,
          'INVALID_ATTACHMENT',
          error instanceof Error ? error.message : 'Choose a complete image.',
        );
      }
    } else if (file)
      throw new ApiError(400, 'UNREVIEWED_ATTACHMENT', 'Choose whether to attach the reviewed copy.');
    return c.json(
      {
        receipt: await createReceipt(c.env.DB, c.get('ownerId'), key, parsed.data, attachment),
      },
      201,
    );
  });
  api.delete('/receipts/:id', async (c) => {
    await removeReceipt(c.env.DB, c.get('ownerId'), c.req.param('id'));
    return c.body(null, 204);
  });
}
