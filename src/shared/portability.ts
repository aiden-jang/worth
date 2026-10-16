import { z } from 'zod';
import { itemInput, listInput, logInput, routineInput, workoutPatch } from './validation';
import { collectionWorkspace } from './workspace';
const id = z.string().uuid();
const time = z.number().int().nonnegative().max(8640000000000000);
const text = (max: number) => z.string().max(max);
const title = (max: number) => text(max).refine((value) => value.trim().length > 0, 'A name is required');
const dated = { createdAt: time, updatedAt: time };
export const archiveFile = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: z.string().datetime(),
    photosExcluded: z.boolean(),
    lists: z
      .array(
        listInput.extend({
          name: title(80),
          description: text(280),
          id,
          workspace: collectionWorkspace.default({ rankings: [], views: [] }),
          rankedIds: z.array(id).max(500),
          updatedAt: time,
        }),
      )
      .max(500),
    items: z
      .array(
        itemInput.innerType().extend({
          title: title(120),
          type: text(60),
          note: text(4000),
          id,
          listId: id,
          ...dated,
          mergedIntoId: id.nullable().default(null),
        }),
      )
      .max(5000),
    logs: z
      .array(
        logInput.extend({ title: text(120), note: text(4000), unit: text(24), id, listId: id, ...dated }),
      )
      .max(5000),
    workoutRoutines: z
      .array(
        routineInput.extend({
          title: title(80),
          exercises: z
            .array(title(120))
            .min(1)
            .max(40)
            .refine(
              (names) =>
                new Set(names.map((n) => n.toLowerCase().replace(/\s+/g, ' '))).size === names.length,
              'Each exercise can only appear once',
            ),
          id,
          listId: id,
          ...dated,
        }),
      )
      .max(5000)
      .default([]),
    workoutSessions: z
      .array(
        workoutPatch
          .innerType()
          .required()
          .extend({
            title: text(80),
            id,
            listId: id,
            ...dated,
            status: z.enum(['active', 'finished']).default('finished'),
            plannedExercises: z.array(z.string().min(1).max(120)).max(40).default([]),
            skippedExercises: z.array(z.string().min(1).max(120)).max(40).default([]),
          }),
      )
      .max(5000)
      .default([]),
    photos: z
      .array(
        z.object({
          kind: z.enum(['list', 'item', 'log']),
          id,
          contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
          data: z
            .string()
            .max(1228800)
            .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
        }),
      )
      .max(200)
      .default([]),
  })
  .superRefine((file, context) => {
    const bad = (message: string) => context.addIssue({ code: 'custom', message });
    const records = [
      ...file.lists,
      ...file.items,
      ...file.logs,
      ...file.workoutSessions,
      ...file.workoutRoutines,
    ];
    if (records.length > 5000) bad('Restore up to 5,000 records at a time');
    if (new Set(records.map((r) => r.id)).size !== records.length)
      bad('The file contains duplicate record IDs');
    const lists = new Map(file.lists.map((l) => [l.id, l]));
    const items = new Map(file.items.map((i) => [i.id, i]));
    const workouts = new Map(file.workoutSessions.map((w) => [w.id, w]));
    for (const i of file.items) {
      if (lists.get(i.listId)?.kind !== 'collection') bad('An item has an invalid collection');
      if (
        i.mergedIntoId &&
        (i.mergedIntoId === i.id ||
          items.get(i.mergedIntoId)?.listId !== i.listId ||
          items.get(i.mergedIntoId)?.mergedIntoId)
      )
        bad('An item has an invalid merge');
      if (i.startedOn && i.endedOn && i.startedOn > i.endedOn) bad('An item has an invalid date range');
    }
    for (const l of file.lists) {
      if (
        l.workspace.rankings.some((ranking) =>
          ranking.itemIds.some((id) => items.get(id)?.listId !== l.id || !!items.get(id)?.mergedIntoId),
        )
      )
        bad('A saved ranking contains an invalid item');
      if (l.kind === 'activity' && (l.workspace.rankings.length || l.workspace.views.length))
        bad('An activity cannot contain collection tools');
      if (
        new Set(l.rankedIds).size !== l.rankedIds.length ||
        l.rankedIds.some((id) => items.get(id)?.listId !== l.id || !!items.get(id)?.mergedIntoId)
      )
        bad('A ranking contains an invalid item');
      if (l.kind === 'activity' && l.rankedIds.length) bad('An activity cannot contain item ranks');
    }
    for (const w of file.workoutSessions) {
      if (lists.get(w.listId)?.kind !== 'activity') bad('A workout has an invalid activity');
      if (
        new Set(w.plannedExercises.map((n) => n.toLowerCase().replace(/\s+/g, ' '))).size !==
          w.plannedExercises.length ||
        new Set(w.skippedExercises).size !== w.skippedExercises.length ||
        w.skippedExercises.some((n) => !w.plannedExercises.includes(n))
      )
        bad('A workout has an invalid lineup');
    }
    for (const r of file.workoutRoutines)
      if (lists.get(r.listId)?.kind !== 'activity') bad('A routine has an invalid activity');
    for (const g of file.logs) {
      const list = lists.get(g.listId);
      if (
        !list ||
        (list.kind === 'activity'
          ? !!g.itemId || !g.title
          : !g.itemId || items.get(g.itemId)?.listId !== list.id)
      )
        bad('A log has an invalid list or item');
      if (
        g.workoutId &&
        (list?.kind !== 'activity' ||
          workouts.get(g.workoutId)?.listId !== g.listId ||
          workouts.get(g.workoutId)?.happenedOn !== g.happenedOn)
      )
        bad('A log has an invalid workout');
    }
    const photoKeys = new Set<string>();
    for (const p of file.photos) {
      if (photoKeys.has(`${p.kind}:${p.id}`)) bad('The file contains duplicate photos');
      photoKeys.add(`${p.kind}:${p.id}`);
      if (
        !(p.kind === 'list'
          ? lists.has(p.id)
          : p.kind === 'item'
            ? items.has(p.id)
            : file.logs.some((g) => g.id === p.id))
      )
        bad('A photo has an invalid record');
    }
    if (file.photosExcluded && file.photos.length) bad('A records-only file cannot contain photos');
  });
export type ArchiveFile = z.infer<typeof archiveFile>;
export const archiveByteLimit = 32 * 1024 * 1024;
