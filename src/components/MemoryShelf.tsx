import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Shuffle } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { api } from '../api';
import {
  isSavedMemory,
  memorySourceHref,
  memoryPhotoHref,
  memoryFilter,
  type MemoryRecord,
} from '../shared/memories';
import { retrospectivePeriod } from '../shared/retrospective';
import { CallFace } from './PersonalCall';
import { BlankSlips } from './BlankSlips';
import { decisionLabel } from '../shared/decisions';
import { formatDate, today } from '../format';
import { initialHomeHighlight, type HomeHighlight } from '../shared/home-highlights';
import { preferenceKey, preferenceRecordsHref } from '../shared/preference-summary';
import { PreferenceObservation } from './PreferenceObservation';
import { ActivityIllustration } from './ActivityIllustration';
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
  const preferences = useQuery({
    queryKey: ['patterns', 'preferences'],
    queryFn: api.preferences,
    retry: false,
  });
  const progressQuery = useQuery({
    queryKey: ['patterns', 'home-progress'],
    queryFn: ({ signal }) => api.homeProgress(signal),
    retry: false,
  });
  const [highlight, setHighlight] = useState<HomeHighlight | null>(null);
  const [revealed, setRevealed] = useState(false);
  const date = today();
  useEffect(() => {
    if (
      highlight ||
      query.isPending ||
      query.isFetching ||
      preferences.isPending ||
      preferences.isFetching ||
      progressQuery.isPending ||
      progressQuery.isFetching
    )
      return;
    setHighlight(
      initialHomeHighlight(
        date,
        query.data?.records[0] ?? null,
        preferences.data?.groups ?? [],
        progressQuery.data?.progress ?? null,
      ),
    );
  }, [
    date,
    highlight,
    query.isPending,
    query.isFetching,
    query.data,
    preferences.isPending,
    preferences.isFetching,
    preferences.data,
    progressQuery.isPending,
    progressQuery.isFetching,
    progressQuery.data,
  ]);
  const memory = highlight?.kind === 'memory' ? highlight.record : null;
  const first = memory
    ? (query.data?.records.find((record) => record.id === memory.id && record.kind === memory.kind) ?? memory)
    : null;
  const draw = useMutation({
    mutationFn: () => pullMemory(first),
    onSuccess: (record) => {
      setHighlight({ kind: 'memory', record });
      setRevealed(true);
    },
  });
  if (!highlight)
    return (
      <section className="month-memory" aria-label="Memory shelf">
        <p role="status">Opening a little of your archive…</p>
      </section>
    );
  const preference =
    highlight.kind === 'preference'
      ? preferences.data?.groups.find((group) => preferenceKey(group) === preferenceKey(highlight.group))
      : null;
  const progress =
    highlight.kind === 'progress' && progressQuery.data?.progress?.logId === highlight.progress.logId
      ? progressQuery.data.progress
      : null;
  const changed = highlight.kind !== 'memory' && !preference && !progress;
  const title = preference
    ? preference.kind === 'collection'
      ? preference.listName
      : preference.name
    : (progress?.title ??
      first?.title ??
      (changed ? 'Your archive changed.' : revealed ? 'A little empty in here.' : 'Fancy a little rummage?'));
  const href = preference
    ? preferenceRecordsHref(preference)
    : progress
      ? `/lists/${progress.listId}?focus=log:${progress.logId}`
      : first
        ? memorySourceHref(first)
        : null;
  return (
    <section className="month-memory" aria-label="Memory shelf">
      <div className="memory-keepsake">
        <p className="overline">
          {preference
            ? 'FROM YOUR CALLS'
            : progress
              ? 'FROM YOUR WORKOUTS'
              : revealed || changed
                ? 'A LITTLE FROM YOUR ARCHIVE'
                : `A LITTLE OF ${new Date().toLocaleDateString(undefined, { month: 'long' }).toUpperCase()}`}
        </p>
        <h2 className="memory-draw-title" key={`${highlight.kind}:${title}`}>
          {title}
        </h2>
        {preference ? (
          <>
            <p className="memory-source">
              {preference.listName} · {preference.basis === 'visits' ? 'Visit reactions' : 'Overall calls'}
            </p>
            <p>
              <PreferenceObservation group={preference} />
            </p>
            {preference.unrated > 0 && (
              <p className="memory-source">
                {preference.unrated} {preference.basis === 'visits' ? 'without a reaction' : 'without a call'}
              </p>
            )}
          </>
        ) : progress ? (
          <>
            <p className="memory-source">
              {progress.listName} · {progress.workoutTitle} · {formatDate(progress.happenedOn)}
            </p>
            <p>
              <strong>
                {progress.weight} {progress.unit} × {progress.reps} reps
              </strong>
            </p>
            <p>Previous recorded best at this weight: {progress.previous} reps.</p>
          </>
        ) : first ? (
          <>
            <p className="memory-source">
              {first.listName} · {isSavedMemory(first) ? 'Saved ' : ''}
              {formatDate(first.date)}
              {isSavedMemory(first) ? ' (UTC)' : ''}
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
                {isSavedMemory(first) ? 'Overall call' : 'This time'}: {decisionLabel(first.reaction)}
              </p>
            )}
          </>
        ) : (
          <p>
            {changed
              ? 'Pull a memory to find something else in your archive.'
              : revealed
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
          {href && (
            <Link to={href}>
              {preference ? 'See supporting records →' : progress ? 'View recorded sets →' : 'Open memory →'}
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
        {highlight.kind === 'memory' && !!query.data?.total && (
          <p className="memory-month-footer">
            {query.data.total} dated {query.data.total === 1 ? 'entry' : 'entries'} this month.{' '}
            <Link to={`/patterns/remember?from=${filter.from}&to=${filter.to}`}>Open this month →</Link>
          </p>
        )}
      </div>
      {progress ? (
        <ActivityIllustration kind="workout" />
      ) : first?.hasPhoto ? (
        <img src={memoryPhotoHref(first)} alt={`Saved photo for ${first.title}`} loading="lazy" />
      ) : first?.reaction ? (
        <CallFace value={first.reaction} />
      ) : (
        <BlankSlips className="memory-blank-slips" />
      )}
    </section>
  );
}
