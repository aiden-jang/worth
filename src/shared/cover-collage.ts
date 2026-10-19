import { z } from 'zod';
const percentage = z.number().int().min(0).max(100);
const collageFrame = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(['items', 'logs']),
    recordId: z.string().uuid(),
    photoId: z.string().uuid(),
    name: z.string().max(240),
    caption: z.string().max(80),
    x: percentage,
    y: percentage,
    width: z.number().int().min(20).max(100),
    height: z.number().int().min(20).max(100),
  })
  .strict()
  .refine((f) => f.x + f.width <= 100 && f.y + f.height <= 100, 'Keep this frame inside the cover.');
export const coverCollage = z
  .object({
    frames: z
      .array(collageFrame)
      .max(6)
      .refine((frames) => new Set(frames.map((f) => f.id)).size === frames.length),
    background: z.enum(['sage', 'clay', 'butter', 'dark']),
  })
  .strict();
export type CollageFrame = z.infer<typeof collageFrame>;
export type CoverCollage = z.infer<typeof coverCollage>;
export const collageColors = { sage: '#bdc7ad', clay: '#c6a48a', butter: '#e8dc9d', dark: '#181915' };
export function fitCollageFrame(
  frame: CollageFrame,
  key: 'x' | 'y' | 'width' | 'height',
  value: number,
): CollageFrame {
  const next = {
    ...frame,
    [key]: Math.round(Math.max(key === 'width' || key === 'height' ? 20 : 0, Math.min(100, value))),
  };
  if (key === 'x') next.x = Math.min(next.x, 100 - next.width);
  if (key === 'y') next.y = Math.min(next.y, 100 - next.height);
  if (key === 'width') next.width = Math.min(next.width, 100 - next.x);
  if (key === 'height') next.height = Math.min(next.height, 100 - next.y);
  return next;
}
