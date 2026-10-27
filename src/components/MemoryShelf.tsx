import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Shuffle } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { api } from '../api';
import { memoryFilter, type MemoryRecord } from '../shared/memories';
import { retrospectivePeriod } from '../shared/retrospective';
import { CallFace } from './PersonalCall';
import { BlankSlips } from './BlankSlips';
import { decisionLabel } from '../shared/decisions';
import { formatDate, today } from '../format';
import '../memories.css';

async function pullMemory(previous?: MemoryRecord | null): Promise<MemoryRecord | null> {
  const filters = [memoryFilter.parse({ to: today() }), memoryFilter.parse({ mode: 'saved' })];
  const pages = await Promise.all(filters.map((filter) => api.memories(filter)));
  const count = pages.reduce((sum, page) => sum + page.total, 0);
  if (!count) return null;
  async function at(index: number) {
    const source = index < pages[0].total ? 0 : 1;
    const offset = source === 0 ? index : index - pages[0].total;
    if (offset < pages[source].records.length) return pages[source].records[offset];
    return (await api.memories({ ...filters[source], offset })).records[0];
  }
  const index = Math.floor(Math.random() * count);
  let record = await at(index);
  if (count > 1 && record?.id === previous?.id && record?.kind === previous?.kind)
    record = await at((index + 1) % count);
  // A record may disappear between the count and page reads; use only a returned source.
  return record ?? pages.flatMap((page) => page.records)[0] ?? null;
}

export function MemoryShelf() {
  const filter = memoryFilter.parse(retrospectivePeriod('month'));
  const query = useQuery({
    queryKey: ['patterns', 'memories', 'month', filter.from, filter.to],
    queryFn: () => api.memories(filter),
  });
  const [pulled, setPulled] = useState<MemoryRecord | null | undefined>(undefined);
  const draw = useMutation({
    mutationFn: () => pullMemory(pulled ?? query.data?.records[0]),
    onSuccess: (record) => {
      setPulled(record);
    },
  });
  const revealed = pulled !== undefined;
  const first = revealed ? pulled : query.data?.records[0];
  return (
    <section className="month-memory" aria-label="Memory shelf">
      <div className="memory-keepsake">
        <p className="overline">
          {revealed
            ? 'A LITTLE FROM YOUR ARCHIVE'
            : `A LITTLE OF ${new Date().toLocaleDateString(undefined, { month: 'long' }).toUpperCase()}`}
        </p>
        <h2 className="memory-draw-title" key={first ? `${first.kind}:${first.id}` : 'invitation'}>
          {first?.title ?? (revealed ? 'A little empty in here.' : 'Fancy a little rummage?')}
        </h2>
        {first ? (
          <>
            <p className="memory-source">
              {first.listName} · {first.kind === 'saved' ? 'Saved ' : ''}
              {formatDate(first.date)}
              {first.kind === 'saved' ? ' (UTC)' : ''}
            </p>
            {first.location && <p>{first.location}</p>}
            {first.order && <p>{first.order}</p>}
            {first.note && (
              <p className="memory-keepsake-note">
                {Array.from(first.note).slice(0, 240).join('')}
                {Array.from(first.note).length > 240 ? '…' : ''}
              </p>
            )}
            {first.reaction && (
              <p className="memory-source">
                {first.kind === 'saved' ? 'Overall call' : 'This time'}: {decisionLabel(first.reaction)}
              </p>
            )}
          </>
        ) : (
          <p>
            {revealed
              ? 'Save a name in a collection. It can turn up here later.'
              : 'Pull a saved name or a past entry. See what turns up.'}
          </p>
        )}
        <div className="memory-draw-actions">
          <button
            className="button button-dark"
            aria-disabled={draw.isPending}
            aria-busy={draw.isPending}
            onClick={() => {
              if (!draw.isPending) draw.mutate();
            }}
          >
            <Shuffle size={18} aria-hidden="true" />{' '}
            {draw.isPending ? 'Looking…' : revealed ? 'Another memory' : 'Pull a memory'}
          </button>
          {first && (
            <Link
              to={`/lists/${first.listId}?focus=${first.kind === 'saved' ? `item:${first.itemId ?? first.id}` : `log:${first.id}`}`}
            >
              Open memory →
            </Link>
          )}
        </div>
        {draw.isPending && <p role="status">Looking through your archive…</p>}
        {draw.isError && <p role="alert">Memories couldn’t load. Try pulling again.</p>}
        {draw.isSuccess && (
          <p role="status" className="sr-only">
            {first ? `Pulled ${first.title}.` : 'No saved memories yet.'}
          </p>
        )}
        {!!query.data?.total && (
          <p className="memory-month-footer">
            {query.data.total} dated {query.data.total === 1 ? 'entry' : 'entries'} this month.{' '}
            <Link to={`/patterns/remember?from=${filter.from}&to=${filter.to}`}>Open this month →</Link>
          </p>
        )}
      </div>
      {first?.hasPhoto ? (
        <img
          src={`/api/${first.kind === 'saved' ? 'items' : 'logs'}/${first.id}/photo`}
          alt={`Saved photo for ${first.title}`}
          loading="lazy"
        />
      ) : first?.reaction ? (
        <CallFace value={first.reaction} />
      ) : (
        <BlankSlips className="memory-blank-slips" />
      )}
    </section>
  );
}
