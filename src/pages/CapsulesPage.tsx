import '../memory-boards.css';
import '../photo-gallery.css';
import '../capsules.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { api, RequestError } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAccountId } from '../hooks/useAccountId';
import { useConnection } from '../hooks/useConnection';
import { useDraft } from '../hooks/useDraft';
import {
  capsuleDraft,
  capsulePayload,
  emptyCapsule,
  localCapsuleOpening,
  type CapsuleDraft,
  type CapsuleSummary,
  type CapsuleView,
} from '../shared/capsules';
import { sourceReviewHash, type SourcePreview } from '../shared/record-snapshots';
import { PrivateRecordPicker } from '../components/PrivateRecordPicker';
import { CapsuleSourceReview } from '../components/CapsuleSourceReview';
import { SnapshotProjection } from '../components/SnapshotProjection';
import { AnnotatedPhoto } from '../components/AnnotatedPhoto';
import { ConfirmDialog } from '../components/ConfirmDialog';
function Envelope({ opened = false }: { opened?: boolean }) {
  return (
    <svg className={`capsule-envelope${opened ? ' is-open' : ''}`} viewBox="0 0 180 144" aria-hidden="true">
      <path d="M18 46 90 12l72 34v82H18Z" fill="#aaa99b" />
      <rect x="31" y="27" width="118" height="83" rx="6" fill="#eae5d5" />
      <path d="M48 49h65m-65 13h83m-83 13h49" stroke="#737566" strokeWidth="3" />
      <path d="m18 46 72 45 72-45v82H18Z" fill="#e8dc9d" />
      <path d="m18 128 59-49m85 49-59-49" stroke="#989063" strokeWidth="2" />
      <path
        className="capsule-flap"
        d="m18 46 72 46 72-46Z"
        fill="#d9ce95"
        stroke="#989063"
        strokeWidth="2"
      />
    </svg>
  );
}
function status(summary: CapsuleSummary) {
  return summary.openedAt !== null
    ? 'Opened'
    : summary.ready
      ? 'Ready to open'
      : `Opens ${summary.opening.day}`;
}
export function CapsulesPage() {
  usePageTitle('Time capsules');
  const owner = useAccountId();
  const query = useQuery({ queryKey: ['capsules', owner], queryFn: api.capsules });
  const [filter, setFilter] = useState(''),
    [kind, setKind] = useState('all');
  const capsules = query.data?.capsules ?? [],
    shown = capsules.filter(
      (c) =>
        c.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()) &&
        (kind === 'all' ||
          (kind === 'opened'
            ? c.openedAt !== null
            : kind === 'ready'
              ? c.openedAt === null && c.ready
              : c.openedAt === null && !c.ready)),
    );
  return (
    <main className="light-page page-width capsules-page">
      <header className="page-head">
        <div>
          <p className="overline">FOR ANOTHER DAY</p>
          <h1>Time capsules</h1>
          <p>A few things, kept as they were.</p>
        </div>
        <Link to="/patterns">Back to Look back →</Link>
      </header>
      <p>
        Seal a message and chosen snapshots. Open them on or after your chosen date, then compare them with
        your current archive.
      </p>
      <div className="board-directory-actions">
        <Link className="button button-accent" to="/capsules/new">
          New capsule
        </Link>
        <p>{capsules.length} / 25 capsules</p>
      </div>
      <details className="board-filter-details">
        <summary>Find and filter capsules</summary>
        <div className="board-filters">
          <label>
            Find a capsule
            <input value={filter} maxLength={80} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <label>
            Status
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">All capsules</option>
              <option value="closed">Waiting</option>
              <option value="ready">Ready to open</option>
              <option value="opened">Opened</option>
            </select>
          </label>
        </div>
      </details>
      {query.isPending && <p role="status">Opening your capsule directory…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry capsules
          </button>
        </p>
      )}
      <div className="capsule-directory">
        {shown.map((c) => (
          <Link className="capsule-card" key={c.id} to={`/capsules/${c.id}`}>
            <Envelope opened={c.openedAt !== null} />
            <div>
              <p className="overline">{status(c)}</p>
              <h2>{c.name}</h2>
              <p>
                {c.entryCount} {c.entryCount === 1 ? 'snapshot' : 'snapshots'} · {c.opening.zone}
              </p>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      {query.data && !shown.length && (
        <section className="capsule-empty">
          <Envelope />
          <div>
            <h2>{capsules.length ? 'No capsules match.' : 'Something for later.'}</h2>
            <p>
              {capsules.length
                ? 'Try another name or status.'
                : 'A name, a date, and whatever you want to keep. Snapshots are optional.'}
            </p>
          </div>
        </section>
      )}
      <p className="capsule-privacy">
        Opening dates are enforced by Worth. Your downloaded backup includes unopened contents. Keep backups
        private.
      </p>
    </main>
  );
}
export function CapsuleComposePage() {
  const owner = useAccountId();
  return <CapsuleComposer key={owner} />;
}
function CapsuleComposer() {
  usePageTitle('New capsule');
  const draft = useDraft(
      'capsule:new',
      emptyCapsule(),
      (v): v is CapsuleDraft => capsuleDraft.safeParse(v).success,
    ),
    form = draft.form,
    online = useConnection(),
    navigate = useNavigate(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [review, setReview] = useState<{
      kind: 'item' | 'log';
      id: string;
      entryId?: string;
      initial?: SourcePreview;
    } | null>(null),
    [clear, setClear] = useState(false),
    [removed, setRemoved] = useState(false);
  const job = useRef(false),
    live = useRef(true),
    bypass = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const dirty = JSON.stringify(form) !== JSON.stringify(emptyCapsule()),
    blocker = useBlocker(() => !bypass.current && dirty),
    locked = busy || !!form.pending;
  const finish = (view: CapsuleView) => {
    if (!live.current) return;
    draft.clear(emptyCapsule());
    bypass.current = true;
    void client.invalidateQueries({ queryKey: ['capsules'] });
    navigate(`/capsules/${view.summary.id}`, { replace: true });
  };
  async function save(check = false) {
    if (job.current || !online) return;
    job.current = true;
    setBusy(true);
    setError('');
    try {
      let pending = form.pending;
      if (!pending) {
        for (const source of form.sources)
          if ((await sourceReviewHash(source.preview)) !== source.preview.hash)
            throw new Error(
              'A recovered source review could not be verified. Review it again; your message is kept.',
            );
        pending = capsulePayload(form);
        if (!live.current) return;
        draft.checkpoint({ ...form, pending });
      }
      const response = check
        ? await api.checkCapsuleSave(draft.operationId.current, pending)
        : await api.createCapsule(pending, draft.operationId.current);
      finish(response);
    } catch (e) {
      if (!live.current) return;
      setError(e instanceof Error ? e.message : 'Could not save this capsule.');
      if (e instanceof RequestError) {
        if (e.status === 400 || ['SOURCE_CHANGED', 'SOURCE_UNAVAILABLE', 'CAPSULE_LIMIT'].includes(e.code))
          draft.checkpoint({ ...form, pending: null });
        if (e.status === 410) setRemoved(true);
      }
    } finally {
      job.current = false;
      if (live.current) setBusy(false);
    }
  }
  const photoCount = form.sources.reduce((sum, s) => sum + s.preview.photos.length, 0),
    edited = form.sources.find((s) => s.id === review?.entryId);
  return (
    <main className="light-page page-width capsule-compose">
      <header className="page-head">
        <div>
          <p className="overline">FOR ANOTHER DAY</p>
          <h1>New capsule</h1>
          <p>Keep this version.</p>
        </div>
        <Link to="/capsules">Back to Capsules →</Link>
      </header>
      <p>
        A capsule stays fixed after saving. To keep later changes, make another capsule. Only fields and
        photos you review are copied.
      </p>
      <fieldset disabled={locked} className="capsule-form">
        <label>
          Capsule name
          <input
            maxLength={80}
            value={form.name}
            onChange={(e) => draft.setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Message <span>optional</span>
          <textarea
            rows={5}
            maxLength={4000}
            value={form.message}
            onChange={(e) => draft.setForm({ ...form, message: e.target.value })}
          />
        </label>
        <label>
          Opening date
          <input
            type="date"
            value={form.day}
            onChange={(e) =>
              draft.setForm({ ...form, day: e.target.value, opening: localCapsuleOpening(e.target.value) })
            }
          />
        </label>
        {form.opening && (
          <p className="capsule-opening">
            Opens from {form.opening.day} at midnight in {form.opening.zone}.<br />
            Exact instant: {new Date(form.opening.opensAt).toISOString()}. The server checks when it can open.
          </p>
        )}
      </fieldset>
      <section aria-label="Chosen snapshots" className="capsule-chosen">
        <h2>
          Chosen snapshots <small>{form.sources.length} / 6</small>
        </h2>
        <p>Names always stay. Notes and photos are optional. Up to four photo copies across all snapshots.</p>
        {form.sources.map((s) => (
          <article key={s.id}>
            <SnapshotProjection
              data={s.preview.data}
              listName={s.preview.listName}
              label="Reviewed snapshot"
            />
            <p>
              {s.preview.photos.length} chosen photos · reviewed{' '}
              {new Date(s.preview.previewedAt).toLocaleString()}
            </p>
            <div className="board-directory-actions">
              <button
                className="button button-outline"
                disabled={locked}
                onClick={() => setReview({ ...s.preview.selection, entryId: s.id, initial: s.preview })}
              >
                Review snapshot again
              </button>
              <button
                className="button button-outline"
                disabled={locked}
                onClick={() => draft.setForm({ ...form, sources: form.sources.filter((x) => x.id !== s.id) })}
              >
                Remove snapshot
              </button>
            </div>
          </article>
        ))}
      </section>
      <details className="record-extras">
        <summary>
          Add an archive snapshot <span>optional</span>
        </summary>
        <PrivateRecordPicker
          disabled={locked || form.sources.length >= 6}
          helper="Choose a record, then review exactly which fields and photos to copy. Your private source stays unchanged."
          actionLabel="Review snapshot"
          accessibleVerb="Review"
          scopeLabel="Choose a capsule source"
          onPick={(row) => {
            if (
              form.sources.some(
                (s) => s.preview.selection.id === row.id && s.preview.selection.kind === row.kind,
              )
            ) {
              setError('That source is already chosen. Review its existing snapshot above.');
              return;
            }
            setReview({ kind: row.kind, id: row.id });
          }}
        />
      </details>
      <p className="capsule-privacy">
        This is a private, app-level opening date. Owner backups include unopened messages, snapshots and
        chosen photo copies.
      </p>
      {draft.status && <p role="status">{draft.status}</p>}
      {!online && <p role="status">You’re offline. Keep your draft here; saving needs a connection.</p>}
      {form.pending && (
        <section className="capsule-pending">
          <h2>Save needs checking.</h2>
          <p>
            This request is fixed. Retry exactly or check whether it saved before starting another capsule.
          </p>
          <button
            className="button button-outline"
            disabled={busy || !online}
            onClick={() => void save(true)}
          >
            Check saved capsule
          </button>
          <Link to={`/capsules/${draft.operationId.current}`}>Open saved address →</Link>
        </section>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="board-directory-actions">
        <button
          className="button button-accent"
          disabled={busy || !online || removed}
          onClick={() => void save()}
        >
          {busy ? 'Checking…' : form.pending ? 'Retry exact capsule save' : 'Seal capsule'}
        </button>
        <button className="button button-outline" disabled={busy} onClick={() => setClear(true)}>
          Discard device draft
        </button>
        {removed && (
          <button
            className="button button-outline"
            onClick={() => {
              draft.operationId.current = crypto.randomUUID();
              draft.checkpoint({ ...form, pending: null });
              setRemoved(false);
              setError('');
            }}
          >
            Start another save of this draft
          </button>
        )}
      </div>
      {review && (
        <CapsuleSourceReview
          key={`${review.kind}:${review.id}`}
          reference={review}
          initial={review.initial}
          maxPhotos={4 - photoCount + (edited?.preview.photos.length ?? 0)}
          onClose={() => setReview(null)}
          onUse={(preview) => {
            draft.setForm({
              ...form,
              sources: review.entryId
                ? form.sources.map((s) => (s.id === review.entryId ? { ...s, preview } : s))
                : [...form.sources, { id: crypto.randomUUID(), preview }],
            });
            setReview(null);
            setError('');
          }}
        />
      )}
      {(clear || blocker.state === 'blocked') && (
        <ConfirmDialog
          title={clear ? 'Discard this device draft?' : 'Leave this capsule draft?'}
          description={
            clear
              ? 'This removes only this device draft. A pending request may already be saved; discarding cannot remove a saved capsule.'
              : 'Your draft is kept on this device when browser storage works. A pending save must still be checked when you return.'
          }
          confirmLabel={clear ? 'Discard device draft' : 'Leave draft'}
          onClose={() => {
            setClear(false);
            if (blocker.state === 'blocked') blocker.reset();
          }}
          onConfirm={() => {
            if (blocker.state === 'blocked') blocker.proceed();
            else {
              const next = emptyCapsule();
              draft.clear(next);
              draft.operationId.current = crypto.randomUUID();
              draft.setForm(next);
              setRemoved(false);
              setError('');
              setClear(false);
            }
          }}
        />
      )}
    </main>
  );
}
export function CapsulePage() {
  const id = useParams().id ?? '',
    owner = useAccountId(),
    navigate = useNavigate(),
    client = useQueryClient();
  const query = useQuery({ queryKey: ['capsule', owner, id], queryFn: () => api.capsule(id) }),
    view = query.data;
  usePageTitle(view?.summary.name ?? 'Capsule');
  const [confirm, setConfirm] = useState(false),
    [compare, setCompare] = useState(false);
  const current = useQuery({
    queryKey: ['capsule-current', owner, id],
    queryFn: () => api.capsuleCurrent(id),
    enabled: compare && !!view?.capsule,
  });
  const open = useMutation({
    mutationFn: () => api.openCapsule(id),
    onSuccess: (response) => {
      client.setQueryData(['capsule', owner, id], response);
      void client.invalidateQueries({ queryKey: ['capsules'] });
    },
    onError: () => void query.refetch(),
  });
  const remove = useMutation({
    mutationFn: () => api.removeCapsule(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['capsules'] });
      navigate('/capsules', { replace: true });
    },
  });
  return (
    <main className="light-page page-width capsule-page">
      <header className="page-head">
        <div>
          <p className="overline">{view ? status(view.summary) : 'PRIVATE CAPSULE'}</p>
          <h1>{view?.summary.name ?? 'Capsule'}</h1>
        </div>
        <Link to="/capsules">Back to Capsules →</Link>
      </header>
      {query.isPending && <p role="status">Reading capsule details…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry capsule
          </button>
        </p>
      )}
      {view && !(query.error instanceof RequestError && query.error.status === 404) && (
        <>
          <p>
            Chosen opening date: {view.summary.opening.day} · {view.summary.opening.zone}.<br />
            Exact instant: {new Date(view.summary.opening.opensAt).toISOString()}.
          </p>
          {!view.capsule ? (
            <section className="capsule-closed">
              <Envelope />
              <h2>{view.summary.ready ? 'Your capsule is ready.' : 'Kept for another day.'}</h2>
              <p>
                {view.summary.ready
                  ? 'Open it when you want to look.'
                  : 'Your message, snapshots and photos stay closed until the chosen date.'}
              </p>
              <div className="board-directory-actions">
                <button
                  className="button button-accent"
                  disabled={!view.summary.ready || open.isPending}
                  onClick={() => open.mutate()}
                >
                  {open.isPending ? 'Opening…' : 'Open capsule'}
                </button>
                <button className="button button-outline" onClick={() => void query.refetch()}>
                  Refresh opening status
                </button>
              </div>
              {open.isError && <p role="alert">{open.error.message}</p>}
            </section>
          ) : (
            <section className="capsule-revealed">
              <div className="capsule-open-header">
                <Envelope opened />
                <div>
                  <p className="overline">KEPT {new Date(view.capsule.createdAt).toLocaleDateString()}</p>
                  <h2>As it was.</h2>
                  <p>First opened {new Date(view.capsule.openedAt!).toLocaleString()}.</p>
                </div>
              </div>
              {view.capsule.message && (
                <p className="capsule-message capsule-written-text">{view.capsule.message}</p>
              )}
              {!view.capsule.entries.length && <p>This capsule has no archive snapshots.</p>}
              {view.capsule.entries.map((entry) => {
                const now = current.data?.current.find((c) => c.entryId === entry.id);
                return (
                  <article className="capsule-snapshot" key={entry.id}>
                    <SnapshotProjection
                      data={entry.data}
                      listName={entry.listName}
                      label="Then · saved snapshot"
                    />
                    <div className="capsule-snapshot-photos">
                      {entry.photos.map((photo, i) => (
                        <AnnotatedPhoto
                          key={photo.id}
                          src={`/api/capsules/${id}/photos/${photo.id}`}
                          entry={photo}
                          number={i + 1}
                          available={photo.available}
                          showCaption
                        />
                      ))}
                    </div>
                    {compare &&
                      now &&
                      (now.available && now.data ? (
                        <>
                          <SnapshotProjection
                            data={now.data}
                            listName={now.listName ?? entry.listName}
                            label="Now · current archive"
                          />
                          {now.photos.some((p) => !p.available) && (
                            <p>
                              An original source photo is no longer available. The independent snapshot copy
                              above is kept.
                            </p>
                          )}
                        </>
                      ) : (
                        <p>The original record is unavailable. This saved snapshot remains unchanged.</p>
                      ))}
                  </article>
                );
              })}
              <button
                className="button button-outline"
                onClick={() => {
                  if (compare) void current.refetch();
                  else setCompare(true);
                }}
              >
                {compare ? 'Refresh current comparison' : 'Compare with current archive'}
              </button>
              {current.isFetching && compare && <p role="status">Reading current sources…</p>}
              {current.isError && compare && (
                <p role="alert">{current.error.message} Your saved snapshots remain above.</p>
              )}
            </section>
          )}
          <div className="board-directory-actions">
            <button
              className="button button-outline"
              onClick={() => {
                remove.reset();
                setConfirm(true);
              }}
            >
              Remove capsule
            </button>
          </div>
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title="Remove this capsule?"
          description="This permanently removes this capsule and its copied photos. Original records, visits and photos stay intact. This cannot be undone."
          confirmLabel="Remove capsule"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onClose={() => setConfirm(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </main>
  );
}
