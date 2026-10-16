import { z } from 'zod';
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const widgetAuthorization = z
  .object({
    challenge: secret,
    state: secret,
    platform: z.enum(['ios', 'android']),
    name: z.string().trim().min(1).max(40),
    collectionIds: z
      .array(z.string().uuid())
      .min(1)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export const widgetConnectRequest = widgetAuthorization.omit({ collectionIds: true });
export const widgetExchange = z
  .object({ code: secret, verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) })
  .strict();
export type WidgetAuthorization = z.infer<typeof widgetAuthorization>;
export type WidgetDevice = {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  createdAt: number;
  expiresAt: number;
  collections: { id: string; name: string }[];
};
export type WidgetEntry = { id: string; title: string; type: string };
export type WidgetSnapshot = {
  schemaVersion: 1;
  updatedAt: number;
  expiresAt: number;
  collections: {
    id: string;
    name: string;
    ranked: (WidgetEntry & { rank: number })[];
    find: WidgetEntry | null;
  }[];
};
export const widgetCallback = 'com.aidenjang.worth:/widget-callback';
export const widgetLifetime = 30 * 86400000;
