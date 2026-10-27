import { sharedArchive } from './private-spaces';
import { savedReceipt } from './receipts';
import { savedCapsule } from './capsules';
import { exerciseAliases, routineTargets, validRoutineTargets } from './activity-plans';
import { savedBoard } from './memory-boards';
import { galleryEntries, gallerySource } from './photo-gallery';
import { z } from 'zod';
import { recordConnection, normalizeConnection, hasReplacementCycle } from './connections';
import { tasteEvent } from './taste-history';
import { inboxEntry, inboxLimit } from './inbox';
import { collectionTemplates } from './templates';
import { itemInput, listInput, logInput, routineInput, workoutPatch } from './validation';
import { collectionWorkspace } from './workspace';
import { hasVisitContext } from './visit-context';
const id = z.string().uuid();
const time = z.number().int().nonnegative().max(8640000000000000);
const text = (max: number) => z.string().max(max);
const title = (max: number) => text(max).refine((value) => value.trim().length > 0, 'A name is required');
const dated = { createdAt: time, updatedAt: time };
export const archiveFile = z
  .object({
    schemaVersion: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
      z.literal(8),
      z.literal(9),
      z.literal(10),
    ]),
    boards: z.array(savedBoard).max(100).default([]),
    receipts: z.array(savedReceipt).max(100).default([]),
    sharedArchives: z.array(sharedArchive).max(50).default([]),
    capsules: z.array(savedCapsule).max(25).default([]),
    photoAssets: z.array(gallerySource).max(5000).default([]),
    connections: z.array(recordConnection).max(1000).default([]),
    tasteHistory: z.array(tasteEvent).max(10000).default([]),
    inbox: z.array(inboxEntry).max(inboxLimit).default([]),
    collectionTemplates: collectionTemplates.default([]),
    exportedAt: z.string().datetime(),
    photosExcluded: z.boolean(),
    lists: z
      .array(
        listInput.extend({
          exerciseAliases: exerciseAliases.default([]),
          archived: z.boolean().default(false),
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
        z.object(itemInput.shape).extend({
          title: title(120),
          type: text(60),
          note: text(4000),
          id,
          listId: id,
          ...dated,
          mergedIntoId: id.nullable().default(null),
          gallery: galleryEntries.default([]),
          coverPhotoId: id.nullable().default(null),
        }),
      )
      .max(5000),
    logs: z
      .array(
        logInput.extend({
          title: text(120),
          note: text(4000),
          unit: text(24),
          id,
          listId: id,
          ...dated,
          gallery: galleryEntries.default([]),
          coverPhotoId: id.nullable().default(null),
        }),
      )
      .max(5000),
    workoutRoutines: z
      .array(
        routineInput.omit({ expectedRevision: true }).extend({
          targets: routineTargets.default([]),
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
        z
          .object(workoutPatch.shape)
          .omit({ expectedRevision: true })
          .required()
          .extend({
            title: text(80),
            id,
            listId: id,
            ...dated,
            status: z.enum(['active', 'finished']).default('finished'),
            plannedExercises: z.array(z.string().min(1).max(120)).max(40).default([]),
            skippedExercises: z.array(z.string().min(1).max(120)).max(40).default([]),
            targets: routineTargets.default([]),
          }),
      )
      .max(5000)
      .default([]),
    photos: z
      .array(
        z.object({
          kind: z.enum(['list', 'item', 'log', 'asset', 'receipt', 'capsule']),
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
    if (
      file.schemaVersion < 8 &&
      (file.lists.some((list) => list.exerciseAliases.length) ||
        file.workoutRoutines.some((routine) => routine.targets.length) ||
        file.workoutSessions.some((workout) => workout.targets.length) ||
        file.logs.some((log) => log.measurements.length || log.exercise))
    )
      bad('Routine targets, exercise aliases and named measurements require backup version 8');
    const records = [
      ...file.lists,
      ...file.items,
      ...file.logs,
      ...file.workoutSessions,
      ...file.workoutRoutines,
      ...file.inbox,
      ...file.boards,
      ...file.receipts,
      ...file.sharedArchives,
      ...file.sharedArchives.flatMap((copy) => copy.entries),
      ...file.capsules,
      ...file.capsules.flatMap((capsule) => capsule.entries.flatMap((entry) => entry.photos)),
    ];
    if (file.schemaVersion < 10 && file.sharedArchives.length) bad('Shared copies require backup version 10');
    if (new TextEncoder().encode(JSON.stringify(file.sharedArchives)).length > 8 * 1024 * 1024)
      bad('Shared copies exceed the 8 MB text limit');
    if (records.length > 5000) bad('Restore up to 5,000 records at a time');
    if (new Set(records.map((r) => r.id)).size !== records.length)
      bad('The file contains duplicate record IDs');
    const lists = new Map(file.lists.map((l) => [l.id, l]));
    const items = new Map(file.items.map((i) => [i.id, i]));
    const workouts = new Map(file.workoutSessions.map((w) => [w.id, w]));
    const logsForBoards = new Set(file.logs.map((log) => log.id));
    const receipts = new Map(file.receipts.map((receipt) => [receipt.id, receipt]));
    const capsulePhotos = new Map(
      file.capsules.flatMap((capsule) =>
        capsule.entries.flatMap((entry) => entry.photos.map((photo) => [photo.id, photo] as const)),
      ),
    );
    if (file.schemaVersion < 9 && file.capsules.length) bad('Time capsules require backup version 9');
    if (new TextEncoder().encode(JSON.stringify(file.capsules)).length > 8 * 1024 * 1024)
      bad('Restore up to 8 MB of capsule text.');
    for (const capsule of file.capsules)
      for (const entry of capsule.entries)
        if (
          entry.reference &&
          (entry.kind === 'item'
            ? !items.has(entry.reference.id) || !!items.get(entry.reference.id)?.mergedIntoId
            : !logsForBoards.has(entry.reference.id))
        )
          bad('A capsule has an unavailable record reference.');
    if (file.schemaVersion < 7 && file.receipts.length) bad('Receipts require backup version 7');
    if (new TextEncoder().encode(JSON.stringify(file.receipts)).length > 16777216)
      bad('Restore up to 16 MB of receipt text.');
    for (const receipt of file.receipts)
      for (const line of receipt.lines)
        if (
          line.mapping.mode !== 'none' &&
          (!items.has(line.mapping.itemId) || !!items.get(line.mapping.itemId)?.mergedIntoId)
        )
          bad('A receipt has an unavailable record reference.');

    if (file.schemaVersion < 6 && file.boards.length) bad('Boards require backup version 6');
    if (new TextEncoder().encode(JSON.stringify(file.boards)).length > 16777216)
      bad('Restore up to 16 MB of board text.');
    for (const board of file.boards)
      for (const entry of board.entries)
        if (entry.reference) {
          if (
            entry.reference.kind === 'item'
              ? !items.has(entry.reference.id) || !!items.get(entry.reference.id)?.mergedIntoId
              : !logsForBoards.has(entry.reference.id)
          )
            bad('A board contains an unavailable record reference.');
        }
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
      if (l.kind !== 'activity' && l.exerciseAliases.length) bad('Exercise aliases need an activity list');
      if (l.archived && l.kind !== 'collection') bad('Only collections can be archived');
      if (
        l.workspace.duplicateReviews?.some((review) =>
          review.itemIds.some((id) => items.get(id)?.listId !== l.id || !!items.get(id)?.mergedIntoId),
        )
      )
        bad('A duplicate review contains an invalid item');
      if (
        l.workspace.rankings.some((ranking) =>
          ranking.itemIds.some((id) => items.get(id)?.listId !== l.id || !!items.get(id)?.mergedIntoId),
        )
      )
        bad('A saved ranking contains an invalid item');
      if (l.workspace.shelf) {
        const selected = [l.workspace.shelf.keepsakeId, l.workspace.shelf.inscription?.itemId].filter(
          Boolean,
        );
        if (selected.some((id) => items.get(id!)?.listId !== l.id || !!items.get(id!)?.mergedIntoId))
          bad('A shelf contains an invalid item');
      }
      if (
        l.kind === 'activity' &&
        (l.workspace.rankings.length ||
          l.workspace.views.length ||
          l.workspace.shelf ||
          l.workspace.duplicateReviews?.length ||
          l.workspace.detailFields?.length)
      )
        bad('An activity cannot contain collection tools');
      if (
        new Set(l.rankedIds).size !== l.rankedIds.length ||
        l.rankedIds.some((id) => items.get(id)?.listId !== l.id || !!items.get(id)?.mergedIntoId)
      )
        bad('A ranking contains an invalid item');
      if (l.kind === 'activity' && l.rankedIds.length) bad('An activity cannot contain item ranks');
    }
    for (const w of file.workoutSessions) {
      if (!validRoutineTargets(w.plannedExercises, w.targets))
        bad('A workout target has no matching exercise');
      if (lists.get(w.listId)?.kind !== 'activity') bad('A workout has an invalid activity');
      if (
        new Set(w.plannedExercises.map((n) => n.toLowerCase().replace(/\s+/g, ' '))).size !==
          w.plannedExercises.length ||
        new Set(w.skippedExercises).size !== w.skippedExercises.length ||
        w.skippedExercises.some((n) => !w.plannedExercises.includes(n))
      )
        bad('A workout has an invalid lineup');
    }
    for (const r of file.workoutRoutines) {
      if (lists.get(r.listId)?.kind !== 'activity') bad('A routine has an invalid activity');
      if (!validRoutineTargets(r.exercises, r.targets)) bad('A routine target has no matching exercise');
    }
    for (const g of file.logs) {
      if (lists.get(g.listId)?.kind !== 'activity' && g.measurements.length)
        bad('Named measurements need an activity log');
      const list = lists.get(g.listId);
      if (list?.kind === 'activity' && hasVisitContext(g.context))
        bad('An activity cannot contain collection visit details');
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
    if (new Set(file.connections.map((c) => c.id)).size !== file.connections.length)
      bad('Connections contain duplicate IDs');
    const connectionPairs = new Set<string>();
    for (const raw of file.connections) {
      const c = normalizeConnection(raw),
        key = `${c.kind}:${c.fromId}:${c.toId}`;
      if (!items.has(c.fromId) || !items.has(c.toId)) bad('A connection has an invalid record');
      if (connectionPairs.has(key)) bad('Connections contain a duplicate pair');
      connectionPairs.add(key);
    }
    if (hasReplacementCycle(file.connections)) bad('Replacement connections cannot form a loop');
    const logIds = new Set(file.logs.map((g) => g.id));
    if (new Set(file.tasteHistory.map((e) => e.id)).size !== file.tasteHistory.length)
      bad('History contains duplicate IDs');
    for (const event of file.tasteHistory) {
      if (event.kind === 'rank') {
        if (lists.get(event.listId)?.kind !== 'collection') bad('History has an invalid collection');
        for (const order of [event.before, event.after]) {
          const kept = order.filter((id) => id !== null);
          if (new Set(kept).size !== kept.length || kept.some((id) => !items.has(id!)))
            bad('History has an invalid record');
        }
        if (event.logId) bad('Ranking history cannot link a visit');
      } else {
        const item = items.get(event.itemId),
          log = file.logs.find((g) => g.id === event.logId);
        if (!item) bad('Opinion history has an invalid record');
        if (
          event.logId &&
          (!log ||
            log.listId !== item?.listId ||
            (log.itemId !== item?.id &&
              log.itemId !== item?.mergedIntoId &&
              items.get(log.itemId ?? '')?.mergedIntoId !== item?.id))
        )
          bad('Opinion history has an invalid visit');
      }
      if (event.logId && !logIds.has(event.logId)) bad('History has an invalid visit');
    }
    const sources = new Map(file.photoAssets.map((source) => [source.id, source]));
    for (const capsule of file.capsules)
      for (const entry of capsule.entries)
        for (const photo of entry.photos)
          if (photo.sourceAssetId) {
            const asset = sources.get(photo.sourceAssetId);
            if (
              !asset ||
              asset.kind !== entry.kind ||
              (entry.reference && asset.recordId !== entry.reference.id)
            )
              bad('A capsule photo has an unavailable source.');
          }
    if (
      sources.size !== file.photoAssets.length ||
      file.photoAssets.some((source) => records.some((record) => record.id === source.id))
    )
      bad('Photo assets contain duplicate IDs');
    const used = new Set<string>();
    for (const [kind, parents] of [
      ['item', file.items],
      ['log', file.logs],
    ] as const)
      for (const parent of parents) {
        if (parent.coverPhotoId && !parent.gallery.some((entry) => entry.id === parent.coverPhotoId))
          bad('A photo cover has an invalid source');
        for (const entry of parent.gallery) {
          const source = sources.get(entry.id);
          if (!source || source.kind !== kind || source.recordId !== parent.id || used.has(entry.id))
            bad('A photo gallery has an invalid source');
          used.add(entry.id);
        }
      }
    if (used.size !== sources.size) bad('A photo asset has no gallery entry');
    if (
      file.schemaVersion < 5 &&
      (sources.size ||
        file.items.some((i) => i.gallery.length || i.coverPhotoId) ||
        file.logs.some((g) => g.gallery.length || g.coverPhotoId))
    )
      bad('Photo galleries require backup version 5');
    const photoKeys = new Set<string>();
    for (const p of file.photos) {
      if (photoKeys.has(`${p.kind}:${p.id}`)) bad('The file contains duplicate photos');
      photoKeys.add(`${p.kind}:${p.id}`);
      if (
        !(p.kind === 'list'
          ? lists.has(p.id)
          : p.kind === 'item'
            ? items.has(p.id)
            : p.kind === 'asset'
              ? sources.has(p.id)
              : p.kind === 'receipt'
                ? receipts.has(p.id)
                : p.kind === 'capsule'
                  ? capsulePhotos.has(p.id)
                  : file.logs.some((g) => g.id === p.id))
      )
        bad('A photo has an invalid record');
    }
    for (const photo of file.photos) {
      if (
        photo.kind === 'capsule' &&
        (!capsulePhotos.get(photo.id)?.available ||
          capsulePhotos.get(photo.id)?.contentType !== photo.contentType)
      )
        bad('A capsule photo has an invalid type or availability.');
      if (
        (photo.kind === 'item' && items.get(photo.id)?.gallery.length) ||
        (photo.kind === 'log' && file.logs.find((g) => g.id === photo.id)?.gallery.length)
      )
        bad('A gallery cannot also contain a legacy cover photo');
      if (
        photo.kind === 'receipt' &&
        (!receipts.get(photo.id)?.attachment?.available ||
          receipts.get(photo.id)?.attachment?.contentType !== photo.contentType)
      )
        bad('A receipt attachment has an invalid type or availability.');
      if (photo.kind === 'asset' && !sources.get(photo.id)?.available)
        bad('A photo source is marked unavailable');
      if (photo.kind === 'asset' && sources.get(photo.id)?.contentType !== photo.contentType)
        bad('A photo original has the wrong type');
    }
    if (
      !file.photosExcluded &&
      file.photoAssets.some((source) => source.available && !photoKeys.has(`asset:${source.id}`))
    )
      bad('A photo source is missing its original');
    if (
      !file.photosExcluded &&
      file.receipts.some(
        (receipt) => receipt.attachment?.available && !photoKeys.has(`receipt:${receipt.id}`),
      )
    )
      bad('A receipt is missing its attachment copy.');
    if (file.photosExcluded && file.photos.length) bad('A records-only file cannot contain photos');
    if (
      !file.photosExcluded &&
      [...capsulePhotos.values()].some((photo) => photo.available && !photoKeys.has(`capsule:${photo.id}`))
    )
      bad('A capsule is missing its photo copy.');
  });
export type ArchiveFile = z.infer<typeof archiveFile>;
export const archiveByteLimit = 32 * 1024 * 1024;
