import { memoryFilter, type MemoryFilter, type MemoryPage, type MemoryRecord } from './memories';

type ReminderKind = 'favorite' | 'want' | 'experience';
export type HomeReminder = { kind: ReminderKind; record: MemoryRecord; filter: MemoryFilter };
type Read = (filter: MemoryFilter) => Promise<MemoryPage>;
const order: ReminderKind[] = ['favorite', 'want', 'experience'];

function shifted(date: string, days: number) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function matches(kind: ReminderKind, record: MemoryRecord, filter: MemoryFilter) {
  if ((filter.from && record.date < filter.from) || (filter.to && record.date > filter.to)) return false;
  if (kind === 'favorite') return record.reaction === 'favorite' && !record.wantToTry;
  if (kind === 'want') return record.wantToTry === true;
  return record.kind === 'visit' || record.kind === 'unfiled-visit';
}

export async function loadHomeReminder(
  read: Read,
  date: string,
  seed: number,
  previous: HomeReminder | null,
  keepCurrent: boolean,
  categorySeed = 0,
): Promise<HomeReminder | null> {
  if (keepCurrent && previous) {
    const page = await read({ ...previous.filter, id: previous.record.id, offset: 0 });
    const record = page.records.find(
      (record) => record.id === previous.record.id && matches(previous.kind, record, previous.filter),
    );
    if (record) return { ...previous, record };
  }
  const filters = [
    memoryFilter.parse({ mode: 'saved', call: 'favorite', want: '0', to: shifted(date, -90) }),
    memoryFilter.parse({ mode: 'saved', want: '1' }),
    memoryFilter.parse({ mode: 'visits', experiences: '1', from: shifted(date, -30), to: date }),
  ];
  const pages = await Promise.allSettled(
    filters.map(async (filter, index) => {
      let page = await read(filter);
      if (index === 0 && !page.total) {
        filter = { ...filter, to: '' };
        page = await read(filter);
      }
      return { kind: order[index], filter, page };
    }),
  );
  const available = pages.flatMap((result) =>
    result.status === 'fulfilled' && result.value.page.total ? [result.value] : [],
  );
  if (!available.length) {
    if (pages.some((result) => result.status === 'rejected'))
      throw new Error('Reminders couldn’t load. Try again.');
    return null;
  }
  const start = previous ? (order.indexOf(previous.kind) + 1) % order.length : 0;
  available.sort(
    (a, b) => ((order.indexOf(a.kind) - start + 3) % 3) - ((order.indexOf(b.kind) - start + 3) % 3),
  );
  if (!previous)
    available.push(
      ...available.splice(
        0,
        Math.min(available.length - 1, Math.max(0, Math.floor(categorySeed * available.length))),
      ),
    );
  let offsetFailed = false;
  for (const { kind, filter, page } of available) {
    const index = Math.min(page.total - 1, Math.max(0, Math.floor(seed * page.total)));
    const at = async (offset: number) =>
      page.records[offset] ?? (await read({ ...filter, offset })).records[0] ?? null;
    try {
      let record = await at(index);
      if (record && previous?.record.id === record.id && previous.kind === kind) {
        if (page.total > 1) record = await at((index + 1) % page.total);
        else if (available.length > 1) continue;
      }
      if (record && matches(kind, record, filter)) return { kind, record, filter };
    } catch {
      offsetFailed = true;
    }
  }
  if (offsetFailed) throw new Error('Reminders couldn’t load. Try again.');
  return null;
}
