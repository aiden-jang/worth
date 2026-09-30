import type { ZodTypeAny, z } from 'zod';
import { ApiError } from './data';

export async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, 'TOO_LARGE', 'The file is too large');
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'TOO_LARGE', 'The file is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function readJson<T extends ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send JSON');
  }
  const bytes = await readBytes(request, 16 * 1024);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, 'INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Invalid input');
  return parsed.data;
}

export function assertSameOrigin(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (!origin) return;
  try {
    if (new URL(origin).origin === new URL(request.url).origin) return;
  } catch {
    throw new ApiError(403, 'CROSS_ORIGIN', 'Cross-origin request rejected');
  }
  throw new ApiError(403, 'CROSS_ORIGIN', 'Cross-origin request rejected');
}

export function securityHeaders(headers: Headers): void {
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

export function photoContentType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' {
  const has = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (has(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (has(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Use a JPEG, PNG, or WebP image');
}
