import { X, PencilSimple } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { formatDate } from '../format';
import type { InboxEntry } from '../shared/inbox';
import type { Item, Log } from '../shared/models';
import { callAsides, decisionLabel, noCallAside } from '../shared/decisions';
import { formatActivityMetric } from '../shared/workouts';
import { CallBadge, CallFace } from './PersonalCall';
import { BlankSlips } from './BlankSlips';
import { GalleryPhoto } from './GalleryPhoto';
import { ItemContextReadout } from './ItemContextReadout';
import { ItemDetailsReadout } from './ItemDetailsReadout';
import { VisitContextReadout } from './VisitContext';
import { TryReview } from './TryReview';
import '../record-details.css';
import '../photo-gallery.css';

type Record =
  | { kind: 'item'; item: Item; logs: Log[]; rank?: number }
  | { kind: 'log'; log: Log; item?: Item }
  | { kind: 'inbox'; entry: InboxEntry };

export function RecordDetails({
  record,
  listName,
  onClose,
  onEdit,
  onRevisit,
  onOpenLog,
}: {
  record: Record;
  listName: string;
  onClose: () => void;
  onEdit: () => void;
  onRevisit?: () => void;
  onOpenLog?: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [historyCount, setHistoryCount] = useState(50);
  const source = record.kind === 'item' ? record.item : record.kind === 'log' ? record.log : record.entry;
  const title = source.title || (record.kind === 'log' ? record.item?.title : '') || 'Saved experience';
  const item = record.kind === 'log' ? null : (source as Item | InboxEntry);
  const history =
    record.kind === 'item'
      ? record.logs
          .filter((log) => log.itemId === source.id || record.item.mergedIds?.includes(log.itemId ?? ''))
          .sort((a, b) => b.happenedOn.localeCompare(a.happenedOn) || b.createdAt - a.createdAt)
      : [];
  useModalDialog(dialog, () =>
    [...document.querySelectorAll<HTMLElement>('[data-item-id], [data-inbox-id], [data-log-id]')]
      .find((entry) => (entry.dataset.itemId ?? entry.dataset.inboxId ?? entry.dataset.logId) === source.id)
      ?.querySelector<HTMLElement>(':scope > button'),
  );
  return createPortal(
    <dialog
      ref={dialog}
      className="editor-dialog record-reader"
      aria-labelledby={headingId}
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="editor-inner">
        <header className="editor-head">
          <div>
            <h2 id={headingId}>{title}</h2>
            <p className="page-context">
              {record.kind === 'log' ? 'Saved experience' : 'Saved find'} · {listName}
            </p>
          </div>
          <button className="icon-button" aria-label="Close details" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="record-reader-actions">
          <button className="button button-outline" onClick={onEdit}>
            <PencilSimple size={17} /> Edit
          </button>
          {onRevisit && (
            <button className="button button-outline" onClick={onRevisit}>
              Add experience
            </button>
          )}
        </div>
        {record.kind === 'item' && record.item.wantToTry && (
          <TryReview
            key={record.item.id}
            target={{ kind: 'item', id: record.item.id, title, initial: record.item }}
          />
        )}
        {record.kind === 'inbox' && record.entry.wantToTry && (
          <TryReview
            key={record.entry.id}
            target={{ kind: 'inbox', id: record.entry.id, title, initial: record.entry }}
          />
        )}
        <div className={item ? 'record-reader-layout' : undefined}>
          <div className="record-reader-content">
            {item?.type && <p className="record-reader-type">{item.type}</p>}
            {item && <ItemDetailsReadout item={item} />}
            {record.kind === 'log' && (
              <>
                <p className="record-reader-date">{formatDate(record.log.happenedOn)}</p>
                {record.log.exerciseSets?.length ? (
                  <table className="record-reader-sets">
                    <caption>Recorded sets</caption>
                    <thead>
                      <tr>
                        <th>Set</th>
                        <th>Reps</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.log.exerciseSets.map((set, index) => (
                        <tr key={index}>
                          <th>{index + 1}</th>
                          <td>{set.reps ?? 'Not recorded'}</td>
                          <td>
                            {set.weight === null
                              ? 'Bodyweight'
                              : `${set.weight} ${record.log.weightUnit ?? '(unit not recorded)'}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  formatActivityMetric(record.log) && <p>{formatActivityMetric(record.log)}</p>
                )}
                {!!record.log.exerciseSets?.length && !!record.log.measurements?.length && (
                  <dl className="record-reader-dates">
                    {record.log.measurements.map((measurement, index) => (
                      <div key={index}>
                        <dt>{measurement.name}</dt>
                        <dd>
                          {measurement.value}
                          {measurement.unit ? ` ${measurement.unit}` : ''}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <VisitContextReadout value={record.log.context} />
              </>
            )}
            {source.note && (
              <section className="record-reader-note">
                <h3>Private note</h3>
                <p>{source.note}</p>
              </section>
            )}
            {item && (
              <>
                {(item.wantToTry || item.revisitQueued) && (
                  <p className="record-reader-flags">
                    {item.wantToTry && <span>Want to try</span>}
                    {item.revisitQueued && <span>Revisit queue</span>}
                  </p>
                )}
                {(item.startedOn || item.endedOn) && (
                  <dl className="record-reader-dates">
                    {item.startedOn && (
                      <div>
                        <dt>Started</dt>
                        <dd>{formatDate(item.startedOn)}</dd>
                      </div>
                    )}
                    {item.endedOn && (
                      <div>
                        <dt>Finished</dt>
                        <dd>{formatDate(item.endedOn)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <ItemContextReadout value={item.context} />
              </>
            )}
            {record.kind === 'inbox' && record.entry.memory && (
              <section className="record-reader-note">
                <h3>Experience</h3>
                <p>{formatDate(record.entry.memory.happenedOn)}</p>
                {record.entry.memory.reaction && <CallBadge value={record.entry.memory.reaction} />}
              </section>
            )}
            {record.kind === 'item' && record.item.hasPhoto && <SavedPhotos kind="items" id={source.id} />}
            {record.kind === 'log' && record.log.hasPhoto && <SavedPhotos kind="logs" id={source.id} />}
            {record.kind === 'inbox' &&
              record.entry.photo &&
              (record.entry.photo.available ? (
                <img
                  className="record-reader-photo"
                  src={`/api/inbox/${source.id}/photo?v=${record.entry.revision}`}
                  alt={`Saved photo for ${title}`}
                />
              ) : (
                <p className="muted">The photo original isn’t available in this records-only copy.</p>
              ))}
            {record.kind === 'item' && history.length > 0 && (
              <section className="record-reader-history">
                <h3>
                  Experiences <span>{history.length}</span>
                </h3>
                <>
                  <ol>
                    {history.slice(0, historyCount).map((log) => (
                      <li key={log.id}>
                        <button className="record-reader-history-link" onClick={() => onOpenLog?.(log.id)}>
                          <time dateTime={log.happenedOn}>{formatDate(log.happenedOn)}</time>
                          <span>{log.note || 'View experience'}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  {history.length > historyCount && (
                    <button
                      className="button button-outline"
                      onClick={() => setHistoryCount((count) => count + 50)}
                    >
                      Show more experiences
                    </button>
                  )}
                </>
              </section>
            )}
          </div>
          {item && (
            <aside className="opinion-slip record-reader-call" aria-label="Your saved call">
              <p className="overline">YOUR CALL</p>
              <div className="opinion-slip-verdict">
                {item.decision ? (
                  <CallFace value={item.decision} arms />
                ) : (
                  <BlankSlips className="undecided-slips" />
                )}
                <strong>{item.decision ? `${decisionLabel(item.decision)}.` : 'Undecided.'}</strong>
                <span>{item.decision ? callAsides[item.decision] : noCallAside}</span>
              </div>
              {record.kind === 'item' && record.rank && (
                <p className="record-reader-rank">
                  Ranked #{String(record.rank).padStart(2, '0')} in {listName}
                </p>
              )}
            </aside>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function SavedPhotos({ kind, id }: { kind: 'items' | 'logs'; id: string }) {
  const photos = useQuery({ queryKey: ['photo-gallery', kind, id], queryFn: () => api.gallery(kind, id) });
  return (
    <section className="record-reader-photos">
      <h3>Private photos</h3>
      {photos.isPending && <p role="status">Opening saved photos…</p>}
      {photos.isError && (
        <p role="alert">
          Photos couldn’t load.{' '}
          <button className="button button-outline" onClick={() => void photos.refetch()}>
            Try again
          </button>
        </p>
      )}
      {photos.data?.gallery.entries.map((entry, index) =>
        entry.source.available ? (
          <GalleryPhoto
            key={entry.id}
            kind={kind}
            recordId={id}
            entry={entry}
            number={index + 1}
            showCaption
          />
        ) : (
          <p key={entry.id}>Photo {index + 1} isn’t available in this records-only copy.</p>
        ),
      )}
    </section>
  );
}
