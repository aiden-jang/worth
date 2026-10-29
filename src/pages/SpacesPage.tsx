import '../memory-boards.css';
import '../capsules.css';
import '../spaces.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useBlocker } from 'react-router';
import { z } from 'zod';
import { api, RequestError } from '../api';
import { useAccountId } from '../hooks/useAccountId';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import { sourcePreview, sourceReviewHash, type SourcePreview } from '../shared/record-snapshots';
import { pairInput, type SpaceView, type PairView, type SharedArchive } from '../shared/private-spaces';
import { PrivateRecordPicker } from '../components/PrivateRecordPicker';
import { CapsuleSourceReview } from '../components/CapsuleSourceReview';
import { SnapshotProjection } from '../components/SnapshotProjection';
import { ConfirmDialog } from '../components/ConfirmDialog';
const createDraft = z.object({ name: z.string().max(80), pending: z.string().max(80).nullable() }).strict();
function Tickets() {
  return (
    <svg className="space-tickets" viewBox="0 0 160 120" aria-hidden="true">
      <g transform="rotate(-8 60 60)">
        <rect x="12" y="20" width="82" height="86" rx="8" fill="#aaa99b" />
        <path d="M24 42h54m-54 13h37M24 80h54" stroke="#38392f" strokeWidth="3" />
      </g>
      <g transform="rotate(10 105 60)">
        <rect x="68" y="12" width="78" height="88" rx="8" fill="#e8dc9d" />
        <path d="M80 34h53m-53 13h33M80 75h53" stroke="#737566" strokeWidth="3" />
      </g>
    </svg>
  );
}
export function SpacesPage() {
  usePageTitle('Shared spaces');
  const owner = useAccountId(),
    navigate = useNavigate(),
    client = useQueryClient();
  const query = useQuery({ queryKey: ['spaces', owner], queryFn: api.spaces }),
    copies = useQuery({ queryKey: ['space-archives', owner], queryFn: api.spaceArchives });
  const draft = useDraft(
    'space:new',
    { name: '', pending: null } as z.infer<typeof createDraft>,
    (v): v is z.infer<typeof createDraft> => createDraft.safeParse(v).success,
  );
  const create = useMutation({
    mutationFn: async () => {
      const name = draft.form.pending ?? draft.form.name;
      if (!name.trim()) throw new Error('Give the space a name.');
      draft.checkpoint({ ...draft.form, pending: name });
      return api.createSpace(name, draft.operationId.current);
    },
    onSuccess: (s) => {
      draft.clear({ name: '', pending: null });
      void client.invalidateQueries({ queryKey: ['spaces'] });
      navigate(`/spaces/${s.id}`);
    },
    onError: (e) => {
      if (e instanceof RequestError && e.status === 410) draft.operationId.current = crypto.randomUUID();
      if (e instanceof RequestError && [400, 403, 410].includes(e.status))
        draft.setForm({ ...draft.form, pending: null });
    },
  });
  const [removing, setRemoving] = useState<SharedArchive | null>(null);
  const remove = useMutation({
    mutationFn: () => api.removeSpaceCopy(removing!.id),
    onSuccess: () => {
      setRemoving(null);
      void copies.refetch();
    },
  });
  return (
    <main className="light-page page-width spaces-page">
      <header className="page-head">
        <div>
          <p className="overline">A FEW THINGS, TOGETHER</p>
          <h1>Shared spaces</h1>
          <p>Your originals stay yours.</p>
        </div>
        <Link to="/patterns">Back to Look back →</Link>
      </header>
      <p>
        Invite verified accounts to view or contribute. Share chosen text snapshots and a shared note. Later
        edits to your private records never publish automatically. Photos stay private.
      </p>
      <section className="space-create">
        <Tickets />
        <div>
          <label>
            Space name
            <input
              maxLength={80}
              value={draft.form.name}
              disabled={create.isPending || draft.form.pending !== null}
              onChange={(e) => draft.setForm({ ...draft.form, name: e.target.value })}
            />
          </label>
          <button
            className="button button-accent"
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending
              ? 'Saving…'
              : draft.form.pending
                ? 'Retry exact space save'
                : 'Create private space'}
          </button>
          {draft.status && <p role="status">{draft.status}</p>}
          {create.isError && (
            <p role="alert">{create.error.message} Refresh the directory to check saved spaces.</p>
          )}
        </div>
      </section>
      <button className="button button-outline" onClick={() => void query.refetch()}>
        Refresh spaces
      </button>
      {query.isError && <p role="alert">{query.error.message}</p>}
      {query.isPending && <p role="status">Reading shared spaces…</p>}
      <div className="capsule-directory">
        {query.data?.spaces.map((s) => (
          <Link className="capsule-card" to={`/spaces/${s.id}`} key={s.id}>
            <Tickets />
            <div>
              <p className="overline">{s.role}</p>
              <h2>{s.name}</h2>
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      {query.data && !query.data.spaces.length && <p>No shared spaces yet. A name is enough to start.</p>}
      <section className="space-copies">
        <h2>Private copies</h2>
        <p>
          These disconnected copies survive access ending. Backups also save current shared spaces as private
          copies; restore never restores invitations or live access. Unrevealed choices stay out.
        </p>
        {copies.isError && (
          <p role="alert">
            {copies.error.message}
            <button className="button button-outline" onClick={() => void copies.refetch()}>
              Retry private copies
            </button>
          </p>
        )}
        {copies.data?.archives.map((copy) => (
          <details key={copy.id} className="space-copy">
            <summary>
              {copy.name} · {new Date(copy.savedAt).toLocaleDateString()}
            </summary>
            <p className="capsule-written-text">{copy.note}</p>
            {copy.entries.map((entry) => (
              <SnapshotProjection
                key={entry.id}
                data={entry.data}
                listName={entry.listName}
                label={`Saved copy · ${entry.authorName}`}
              />
            ))}
            {copy.outcomes.map((r, i) => (
              <div key={i}>
                <h3>{r.title}</h3>
                {r.result.map((v, j) => (
                  <p key={j}>
                    {v.name}: {r.options[v.choice]}
                  </p>
                ))}
              </div>
            ))}
            <button className="button button-outline" onClick={() => setRemoving(copy)}>
              Remove private copy
            </button>
          </details>
        ))}
      </section>
      {removing && (
        <ConfirmDialog
          title="Remove this private copy?"
          description="Only this disconnected copy will be deleted. Live shared spaces and other people’s copies stay intact."
          confirmLabel="Remove private copy"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onConfirm={() => remove.mutate()}
          onClose={() => setRemoving(null)}
        />
      )}
    </main>
  );
}
export function SpaceInvitePage() {
  usePageTitle('Space invitation');
  const id = useParams().inviteId ?? '',
    navigate = useNavigate();
  const [token] = useState(() => location.hash.slice(1));
  const accept = useMutation({
    mutationFn: () => api.acceptSpace(id, token),
    onSuccess: (s) => {
      history.replaceState(null, '', location.pathname);
      navigate(`/spaces/${s.id}`, { replace: true });
    },
  });
  return (
    <main className="light-page page-width spaces-page">
      <header className="page-head">
        <div>
          <p className="overline">PRIVATE INVITATION</p>
          <h1>Join a space</h1>
        </div>
        <Link to="/spaces">Back to Spaces →</Link>
      </header>
      <Tickets />
      <p>
        Accept using the invited, verified Accounts email. Once accepted, access stays with that account. Your
        private archive is not shared by accepting.
      </p>
      <button
        className="button button-accent"
        disabled={!token || accept.isPending}
        onClick={() => accept.mutate()}
      >
        {accept.isPending ? 'Checking invitation…' : 'Accept invitation'}
      </button>
      {!token && <p>The invitation secret is missing. Open the full link from its owner.</p>}
      {accept.isError && <p role="alert">{accept.error.message}</p>}
    </main>
  );
}
export function SpacePage() {
  const owner = useAccountId(),
    id = useParams().id ?? '';
  return <SpaceContent key={`${owner}:${id}`} id={id} owner={owner} />;
}
const shareDraftSchema = z
  .object({
    chosen: sourcePreview.nullable(),
    request: z
      .object({ preview: sourcePreview, revision: z.number().int().nonnegative(), key: z.string().uuid() })
      .strict()
      .nullable(),
  })
  .strict();
function SpaceContent({ id, owner }: { id: string; owner: string | undefined }) {
  const query = useQuery({ queryKey: ['space', owner, id], queryFn: () => api.space(id) }),
    space = query.data,
    client = useQueryClient(),
    navigate = useNavigate();
  usePageTitle(space?.name ?? 'Shared space');
  const [review, setReview] = useState<{ kind: 'item' | 'log'; id: string } | null>(null),
    [confirm, setConfirm] = useState<{ kind: 'remove' | 'member' | 'entry'; id?: string } | null>(null),
    [notice, setNotice] = useState('');
  const shareDraft = useDraft(
    `space:${id}:share`,
    { chosen: null, request: null } as z.infer<typeof shareDraftSchema>,
    (v): v is z.infer<typeof shareDraftSchema> => shareDraftSchema.safeParse(v).success,
  );
  const { chosen, request } = shareDraft.form;
  const setChosen = (chosen: SourcePreview | null) =>
    shareDraft.setForm((current) => ({ ...current, chosen }));
  const setRequest = (request: z.infer<typeof shareDraftSchema>['request']) =>
    shareDraft.setForm((current) => ({ ...current, request }));
  const publish = (s: SpaceView) => {
    client.setQueryData(['space', owner, id], s);
    void client.invalidateQueries({ queryKey: ['spaces'] });
  };
  const share = useMutation({
    mutationFn: async () => {
      if (!space || !chosen) throw new Error('Review a source first.');
      if ((await sourceReviewHash(chosen)) !== chosen.hash)
        throw new Error('Review this recovered source again.');
      const frozen = request ?? { preview: chosen, revision: space.revision, key: crypto.randomUUID() };
      shareDraft.checkpoint({ chosen, request: frozen });
      return api.shareSnapshot(id, frozen.preview, frozen.revision, frozen.key);
    },
    onSuccess: (s) => {
      publish(s);
      shareDraft.clear({ chosen: null, request: null });
      shareDraft.setForm({ chosen: null, request: null });
    },
    onError: (e) => {
      if (
        e instanceof RequestError &&
        (['SOURCE_CHANGED', 'SPACE_CHANGED'].includes(e.code) || e.status === 410)
      )
        setRequest(null);
      void query.refetch();
    },
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!space || !confirm) return;
      if (confirm.kind === 'remove') return api.removeSpace(id, space.revision);
      return confirm.kind === 'member'
        ? api.revokeSpaceMember(id, confirm.id!, space.revision)
        : api.removeSharedSnapshot(id, confirm.id!, space.revision);
    },
    onSuccess: (s) => {
      if (confirm?.kind === 'remove') {
        void client.invalidateQueries({ queryKey: ['spaces'] });
        navigate('/spaces', { replace: true });
      } else if (s) publish(s);
      setConfirm(null);
    },
    onError: () => void query.refetch(),
  });
  const copyKey = useRef(crypto.randomUUID()),
    copy = useMutation({
      mutationFn: () => api.saveSpaceCopy(id, copyKey.current),
      onSuccess: () => {
        copyKey.current = crypto.randomUUID();
        void client.invalidateQueries({ queryKey: ['space-archives'] });
        setNotice('Private copy saved. It remains yours if access ends.');
      },
    });
  const unavailable = query.error instanceof RequestError && query.error.status === 404;
  return (
    <main className="light-page page-width spaces-page">
      <header className="page-head">
        <div>
          <p className="overline">{space ? `PRIVATE SPACE · ${space.role}` : 'PRIVATE SPACE'}</p>
          <h1>{space?.name ?? 'Shared space'}</h1>
        </div>
        <Link to="/spaces">Back to Spaces →</Link>
      </header>
      {query.isPending && <p role="status">Reading shared space…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry space
          </button>
        </p>
      )}
      {space && !unavailable && (
        <>
          <p>
            People with active access can read shared text and keep private copies. Revoking access cannot
            erase copies already saved. Originals, photos and later private edits stay in their own archives.
          </p>
          <div className="board-directory-actions">
            <button className="button button-outline" onClick={() => void query.refetch()}>
              Refresh shared details
            </button>
            <button className="button button-outline" disabled={copy.isPending} onClick={() => copy.mutate()}>
              {copy.isPending ? 'Saving copy…' : 'Save private copy'}
            </button>
          </div>
          {copy.isError && <p role="alert">{copy.error.message}</p>}
          {notice && <p role="status">{notice}</p>}
          <SharedNote key={id} space={space} onSaved={publish} />
          {space.role === 'owner' && (
            <SpaceInvitations
              space={space}
              onSaved={publish}
              onRevoke={(memberId) => {
                remove.reset();
                setConfirm({ kind: 'member', id: memberId });
              }}
            />
          )}
          <section className="space-entries">
            <h2>
              Shared snapshots <small>{space.entries.length} / 30</small>
            </h2>
            <p>
              These fixed copies contain only fields their authors reviewed. To share an updated version, its
              author reviews another source snapshot.
            </p>
            {space.entries.map((entry) => (
              <article className="capsule-snapshot" key={entry.id}>
                <SnapshotProjection
                  data={entry.data}
                  listName={entry.listName}
                  label={`Shared by ${entry.authorName}`}
                />
                {(space.role === 'owner' || entry.authorId === owner) && space.role !== 'viewer' && (
                  <button
                    className="button button-outline"
                    onClick={() => {
                      remove.reset();
                      setConfirm({ kind: 'entry', id: entry.id });
                    }}
                  >
                    Remove shared snapshot
                  </button>
                )}
              </article>
            ))}
          </section>
          {space.role !== 'viewer' && (
            <details className="record-extras">
              <summary>Share selected text from your archive</summary>
              <PrivateRecordPicker
                disabled={share.isPending || !!request || space.entries.length >= 30}
                scopeLabel="Choose text to share"
                helper="Review exactly which text fields to copy into this space. Photos and private source identifiers stay private."
                actionLabel="Review text"
                accessibleVerb="Review"
                onPick={(row) => setReview({ kind: row.kind, id: row.id })}
              />
            </details>
          )}
          {shareDraft.status && <p role="status">{shareDraft.status}</p>}
          {chosen && (
            <section className="capsule-snapshot">
              <SnapshotProjection data={chosen.data} listName={chosen.listName} label="Sharing preview" />
              <p>
                These fields will be readable by everyone with active access to this space. They may save
                copies. Your original will stay private.
              </p>
              <button
                className="button button-accent"
                disabled={share.isPending}
                onClick={() => share.mutate()}
              >
                {share.isPending
                  ? 'Sharing…'
                  : request
                    ? 'Retry exact shared snapshot'
                    : 'Share reviewed snapshot'}
              </button>
              <button
                className="button button-outline"
                disabled={share.isPending || !!request}
                onClick={() => setChosen(null)}
              >
                Cancel sharing preview
              </button>
              {share.isError && (
                <p role="alert">
                  {share.error.message} Refresh shared details to check whether this copy saved.
                </p>
              )}
            </section>
          )}
          <PairRounds space={space} onChanged={() => void query.refetch()} />
          {space.role === 'owner' && (
            <button
              className="button button-outline"
              onClick={() => {
                remove.reset();
                setConfirm({ kind: 'remove' });
              }}
            >
              Remove shared space
            </button>
          )}
        </>
      )}
      {unavailable && (
        <section className="space-device-recovery">
          <h2>Unshared device drafts</h2>
          <p>
            Live access has ended. Only this account’s unfinished text from this browser is shown below for
            copying. It cannot be shared from here.
          </p>
          <RecoveredSharedNote id={id} />
          {chosen && (
            <SnapshotProjection data={chosen.data} listName={chosen.listName} label="Device sharing draft" />
          )}
        </section>
      )}
      {review && (
        <CapsuleSourceReview
          mode="share"
          maxPhotos={0}
          reference={review}
          onClose={() => setReview(null)}
          onUse={(preview) => {
            setChosen(preview);
            setReview(null);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'remove'
              ? 'Remove this shared space?'
              : confirm.kind === 'member'
                ? 'Revoke this invitation and access?'
                : 'Remove this shared snapshot?'
          }
          description={
            confirm.kind === 'remove'
              ? 'This removes live shared notes, snapshots, invitations and rounds for everyone. Private originals and already saved copies remain. This cannot be undone.'
              : confirm.kind === 'member'
                ? 'This ends access and invalidates rounds with this member. It cannot erase copies they already saved.'
                : 'This removes only the shared text copy. Private originals and already saved copies remain.'
          }
          confirmLabel={
            confirm.kind === 'remove'
              ? 'Remove shared space'
              : confirm.kind === 'member'
                ? 'Revoke access'
                : 'Remove shared snapshot'
          }
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onClose={() => setConfirm(null)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </main>
  );
}
const noteDraft = z.object({ note: z.string().max(4000), revision: z.number().int().nonnegative() }).strict();
function RecoveredSharedNote({ id }: { id: string }) {
  const draft = useDraft(
    `space:${id}:note`,
    { note: '', revision: 0 },
    (v): v is z.infer<typeof noteDraft> => noteDraft.safeParse(v).success,
  );
  return draft.form.note ? (
    <label>
      Recovered unshared note
      <textarea readOnly rows={5} value={draft.form.note} />
    </label>
  ) : (
    <p>No unfinished shared note was recovered on this device.</p>
  );
}
function SharedNote({ space, onSaved }: { space: SpaceView; onSaved: (s: SpaceView) => void }) {
  const draft = useDraft(
    `space:${space.id}:note`,
    { note: space.note, revision: space.revision },
    (v): v is z.infer<typeof noteDraft> => noteDraft.safeParse(v).success,
  );
  const touched = useRef(draft.status.startsWith('Draft restored') && draft.form.note !== space.note);
  const dirty = touched.current && draft.form.note !== space.note;
  useEffect(() => {
    if (!touched.current && (draft.form.note !== space.note || draft.form.revision !== space.revision)) {
      const next = { note: space.note, revision: space.revision };
      draft.clear(next);
      draft.setForm(next);
    }
  }, [space.note, space.revision, draft]);
  const blocker = useBlocker(() => dirty);
  const save = useMutation({
    mutationFn: () => api.spaceNote(space.id, draft.form.note, draft.form.revision),
    onSuccess: (s) => {
      touched.current = false;
      const next = { note: s.note, revision: s.revision };
      draft.clear(next);
      draft.setForm(next);
      onSaved(s);
    },
  });
  return (
    <section className="space-note">
      <h2>Shared note</h2>
      {space.role === 'viewer' ? (
        <p className="capsule-written-text">{space.note || 'No shared note yet.'}</p>
      ) : (
        <>
          <label>
            Shared note text
            <textarea
              rows={5}
              maxLength={4000}
              disabled={save.isPending}
              value={draft.form.note}
              onChange={(e) => {
                touched.current = true;
                draft.setForm({
                  ...draft.form,
                  note: e.target.value,
                  revision: dirty ? draft.form.revision : space.revision,
                });
              }}
            />
          </label>
          {draft.status && <p role="status">{draft.status}</p>}
          <button
            className="button button-accent"
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save shared note'}
          </button>
          {save.isError && <p role="alert">{save.error.message} Your text stays above.</p>}
          {dirty && space.revision !== draft.form.revision && (
            <section>
              <h3>Current saved note</h3>
              <p className="capsule-written-text">{space.note || 'Empty note'}</p>
              <button
                className="button button-outline"
                disabled={save.isPending}
                onClick={() => draft.setForm({ ...draft.form, revision: space.revision })}
              >
                Keep my text after comparing
              </button>
            </section>
          )}
        </>
      )}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Leave this shared note draft?"
          description="Your text stays in this account’s device draft when browser storage works. It has not been shared yet."
          confirmLabel="Leave draft"
          onClose={() => blocker.reset()}
          onConfirm={() => blocker.proceed()}
        />
      )}
    </section>
  );
}
function SpaceInvitations({
  space,
  onSaved,
  onRevoke,
}: {
  space: SpaceView;
  onSaved: (s: SpaceView) => void;
  onRevoke: (id: string) => void;
}) {
  const [email, setEmail] = useState(''),
    [role, setRole] = useState<'viewer' | 'editor'>('viewer'),
    [link, setLink] = useState(''),
    [status, setStatus] = useState('');
  const key = useRef(crypto.randomUUID());
  const invite = useMutation({
    mutationFn: () => api.spaceInvite(space.id, email, role, space.revision, key.current),
    onError: () => {
      key.current = crypto.randomUUID();
    },
    onSuccess: (r) => {
      onSaved(r.space);
      setLink(new URL(r.link, location.origin).href);
      setEmail('');
      key.current = crypto.randomUUID();
    },
  });
  return (
    <details className="space-invitations">
      <summary>Invitations and access · {space.members.filter((m) => !m.revoked).length} / 8</summary>
      <p>
        Send the link yourself. The invited email must be verified in Accounts. Unaccepted invitations expire
        after seven days. Viewers can read and keep copies; editors can also change the shared note and
        contribute their own snapshots.
      </p>
      <label>
        Invited email
        <input
          type="email"
          autoComplete="off"
          maxLength={254}
          value={email}
          disabled={invite.isPending}
          onChange={(e) => {
            setEmail(e.target.value);
            setLink('');
          }}
        />
      </label>
      <label>
        Access
        <select
          value={role}
          disabled={invite.isPending}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
      </label>
      <button
        className="button button-outline"
        disabled={invite.isPending || !email.trim() || space.members.filter((m) => !m.revoked).length >= 8}
        onClick={() => invite.mutate()}
      >
        {invite.isPending ? 'Creating invitation…' : 'Create invitation link'}
      </button>
      {invite.isError && (
        <p role="alert">
          {invite.error.message} If the reply was lost, refresh shared details. Revoke the saved invitation
          and create another link.
        </p>
      )}
      {link && (
        <div>
          <label>
            Invitation link
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          <button
            className="button button-outline"
            onClick={() => {
              void navigator.clipboard
                .writeText(link)
                .then(() => setStatus('Invitation link copied.'))
                .catch(() => setStatus('Select the link field and copy it manually.'));
            }}
          >
            Copy invitation link
          </button>
        </div>
      )}
      {status && <p role="status">{status}</p>}
      <ul>
        {space.members.map((m) => (
          <li key={m.id}>
            <div>
              <strong>{m.email}</strong>
              <p>
                {m.role} ·{' '}
                {m.revoked
                  ? 'Revoked'
                  : m.accountId
                    ? 'Accepted'
                    : `Awaiting acceptance · expires ${new Date(m.expiresAt).toLocaleDateString()}`}
              </p>
            </div>
            {!m.revoked && (
              <button className="button button-outline" onClick={() => onRevoke(m.id)}>
                Revoke access for {m.email}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
const roundDraftSchema = z
  .object({
    title: z.string().max(80),
    a: z.string().max(80),
    b: z.string().max(80),
    partner: z.string().max(100),
    pending: pairInput.nullable(),
  })
  .strict();
function PairRounds({ space, onChanged }: { space: SpaceView; onChanged: () => void }) {
  const owner = useAccountId(),
    query = useQuery({ queryKey: ['pairs', owner, space.id], queryFn: () => api.pairs(space.id) });
  const empty = { title: '', a: '', b: '', partner: '', pending: null };
  const draft = useDraft(
    `space:${space.id}:round`,
    empty as z.infer<typeof roundDraftSchema>,
    (v): v is z.infer<typeof roundDraftSchema> => roundDraftSchema.safeParse(v).success,
  );
  const { title, a, b, partner, pending } = draft.form;
  const setTitle = (title: string) => draft.setForm({ ...draft.form, title });
  const setA = (a: string) => draft.setForm({ ...draft.form, a });
  const setB = (b: string) => draft.setForm({ ...draft.form, b });
  const setPartner = (partner: string) => draft.setForm({ ...draft.form, partner });
  const create = useMutation({
    mutationFn: () => {
      const frozen = pending ?? {
        title,
        options: [a, b] as [string, string],
        partnerId: partner,
        expectedRevision: space.revision,
      };
      draft.checkpoint({ ...draft.form, pending: frozen });
      return api.createPair(space.id, frozen, draft.operationId.current);
    },
    onSuccess: () => {
      draft.clear(empty);
      draft.setForm(empty);
      draft.operationId.current = crypto.randomUUID();
      void query.refetch();
      onChanged();
    },
    onError: (e) => {
      if (
        e instanceof RequestError &&
        (e.status === 400 || ['SPACE_CHANGED', 'SPACE_LIMIT'].includes(e.code))
      )
        draft.checkpoint({ ...draft.form, pending: null });
      void query.refetch();
      onChanged();
    },
  });
  return (
    <section className="space-rounds">
      <header>
        <Tickets />
        <div>
          <h2>This or that</h2>
          <p>
            Two people, two options. Choose privately, then each reveal deliberately. The choices appear
            together only after both reveal.
          </p>
        </div>
      </header>
      {space.role === 'owner' && (
        <details>
          <summary>Start a two-person round</summary>
          <fieldset disabled={create.isPending || !!pending}>
            <label>
              Round name
              <input maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              First option
              <input maxLength={80} value={a} onChange={(e) => setA(e.target.value)} />
            </label>
            <label>
              Second option
              <input maxLength={80} value={b} onChange={(e) => setB(e.target.value)} />
            </label>
            <label>
              Choose one accepted member
              <select value={partner} onChange={(e) => setPartner(e.target.value)}>
                <option value="">Choose a member</option>
                {space.members
                  .filter((m) => !m.revoked && m.accountId)
                  .map((m) => (
                    <option key={m.id} value={m.accountId!}>
                      {m.email}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              Options stay fixed once the round is saved. Only these two accounts can participate. Revoking
              the member’s access ends the live round.
            </p>
            <button
              className="button button-accent"
              disabled={!title.trim() || !a.trim() || !b.trim() || !partner}
              onClick={() => create.mutate()}
            >
              Start round
            </button>
          </fieldset>
          {pending && (
            <button
              className="button button-accent"
              disabled={create.isPending}
              onClick={() => create.mutate()}
            >
              Retry exact round save
            </button>
          )}
          {draft.status && <p role="status">{draft.status}</p>}
          {create.isError && <p role="alert">{create.error.message} Refresh rounds before another save.</p>}
        </details>
      )}
      <button className="button button-outline" onClick={() => void query.refetch()}>
        Refresh rounds
      </button>
      {query.isError && <p role="alert">{query.error.message}</p>}
      {query.data?.pairs.map((p) => (
        <PairRound key={p.id} pair={p} onChanged={() => void query.refetch()} />
      ))}
      {query.data && !query.data.pairs.length && <p>No available rounds for you in this space.</p>}
    </section>
  );
}
function PairRound({ pair, onChanged }: { pair: PairView; onChanged: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const choose = useMutation({
    mutationFn: (choice: number) => api.pairChoice(pair.id, choice, pair.ownRevision),
    onSettled: onChanged,
  });
  const reveal = useMutation({
    mutationFn: () => api.revealPair(pair.id, pair.ownChoice!, pair.ownRevision),
    onSuccess: () => {
      setConfirm(false);
      onChanged();
    },
    onError: onChanged,
  });
  return (
    <article className="space-round">
      <p className="overline">TWO PERSON ROUND</p>
      <h3>{pair.title}</h3>
      {pair.result ? (
        <>
          <h4>Both revealed.</h4>
          {pair.result.map((r, i) => (
            <p key={i}>
              {r.name}: <strong>{pair.options[r.choice]}</strong>
            </p>
          ))}
        </>
      ) : (
        <>
          <div className="space-options" role="group" aria-label={`Your choice for ${pair.title}`}>
            {pair.options.map((option, i) => (
              <button
                className="button button-outline"
                aria-pressed={pair.ownChoice === i}
                disabled={pair.ownRevealed || choose.isPending || reveal.isPending}
                key={i}
                onClick={() => choose.mutate(i)}
              >
                {option}
              </button>
            ))}
          </div>
          <p>
            {pair.ownRevealed
              ? 'Your choice is sealed.'
              : 'Your saved choice stays private until both reveal.'}{' '}
            {pair.partnerRevealed ? 'Your partner has revealed.' : 'Your partner has not revealed yet.'}
          </p>
          <button
            className="button button-accent"
            disabled={pair.ownChoice === null || pair.ownRevealed || choose.isPending || reveal.isPending}
            onClick={() => setConfirm(true)}
          >
            Reveal my choice
          </button>
        </>
      )}
      {choose.isError && (
        <p role="alert">{choose.error.message} Refresh rounds to check your saved choice.</p>
      )}
      {reveal.isError && !confirm && <p role="alert">{reveal.error.message}</p>}
      {confirm && (
        <ConfirmDialog
          title="Seal and reveal your choice?"
          description={`Your choice is ${pair.options[pair.ownChoice!]}. You cannot change it after revealing. Both choices appear together only after your partner also reveals.`}
          confirmLabel="Seal and reveal"
          pending={reveal.isPending}
          error={reveal.isError ? reveal.error.message : undefined}
          onClose={() => setConfirm(false)}
          onConfirm={() => reveal.mutate()}
        />
      )}
    </article>
  );
}
