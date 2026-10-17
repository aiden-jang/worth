import { z } from 'zod';
export const connectionKind = z.enum(['related', 'edition', 'place', 'replaces']);
const fields = z
  .object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    kind: connectionKind,
    reason: z.string().max(2000),
  })
  .strict();
function checkConnection(
  value: { fromId: string; toId: string; kind: string; reason: string },
  ctx: z.RefinementCtx,
) {
  if (value.fromId === value.toId) ctx.addIssue({ code: 'custom', message: 'Choose two different records' });
  if (value.kind === 'replaces' && !value.reason.trim())
    ctx.addIssue({ code: 'custom', message: 'Keep a reason for the replacement' });
}
export const connectionInput = fields.superRefine(checkConnection);
export type ConnectionInput = z.infer<typeof connectionInput>;
export const recordConnection = fields
  .extend({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    createdAt: z.number().int().nonnegative().max(8640000000000000),
  })
  .superRefine(checkConnection);
export type RecordConnection = z.infer<typeof recordConnection>;
export type ConnectedRecord = {
  detail?: string;
  id: string;
  title: string;
  listId: string;
  listName: string;
  currentId: string;
  merged: boolean;
  archived: boolean;
};
export type ConnectionView = RecordConnection & { from: ConnectedRecord; to: ConnectedRecord };
export const connectionNote = z
  .object({ reason: z.string().max(2000), expectedRevision: z.number().int().nonnegative() })
  .strict();
export function normalizeConnection(value: ConnectionInput): ConnectionInput {
  return value.kind !== 'replaces' && value.fromId > value.toId
    ? { ...value, fromId: value.toId, toId: value.fromId }
    : value;
}
export function hasReplacementCycle(values: Pick<ConnectionInput, 'fromId' | 'toId' | 'kind'>[]): boolean {
  const edges = new Map<string, string[]>(),
    incoming = new Map<string, number>();
  for (const value of values) {
    if (value.kind !== 'replaces') continue;
    edges.set(value.fromId, [...(edges.get(value.fromId) ?? []), value.toId]);
    incoming.set(value.fromId, incoming.get(value.fromId) ?? 0);
    incoming.set(value.toId, (incoming.get(value.toId) ?? 0) + 1);
  }
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    visited++;
    for (const target of edges.get(id) ?? []) {
      const next = incoming.get(target)! - 1;
      incoming.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return visited !== incoming.size;
}
export const connectionLabels: Record<ConnectionInput['kind'], string> = {
  related: 'Related finds',
  edition: 'Editions or versions',
  place: 'Same thing, different places',
  replaces: 'Replaces',
};

const optionalId = z.union([z.literal(''), z.string().uuid()]);
export const connectionDraft = z
  .object({
    fromList: optionalId,
    toList: optionalId,
    fromId: optionalId,
    toId: optionalId,
    kind: connectionKind,
    reason: z.string().max(2000),
    includeArchived: z.boolean(),
    attempt: z
      .object({
        key: z.string().uuid(),
        payload: connectionInput,
        fromName: z.string().max(120),
        toName: z.string().max(120),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const emptyConnectionDraft: z.infer<typeof connectionDraft> = {
  fromList: '',
  toList: '',
  fromId: '',
  toId: '',
  kind: 'related',
  reason: '',
  includeArchived: false,
  attempt: null,
};
export function isConnectionDraft(value: unknown): value is z.infer<typeof connectionDraft> {
  return connectionDraft.safeParse(value).success;
}
