import { reportAnalytics } from '../../analytics/browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConnection } from '../hooks/useConnection';
import {
  offlineOperation,
  type OfflineVault,
  type OfflineSnapshot,
  type OfflineOperation,
} from '../shared/offline';
import {
  deleteVault,
  listVaults,
  readVault,
  sealVault,
  unsealVault,
  vaultKey,
  vaultSalt,
  writeVault,
  type VaultEnvelope,
} from '../shared/offline-vault';
import {
  downloadOfflineSnapshot,
  prepareOfflineShell,
  syncOfflineOperation,
  verifiedOfflineOwner,
} from '../shared/offline-client';
type OfflineRecord = OfflineSnapshot['records'][number];
function Folder() {
  return (
    <svg viewBox="0 0 160 120" className="offline-folder" aria-hidden="true">
      <path d="M14 28q0-10 10-10h42l12 14h58q10 0 10 10v62H14Z" fill="#aaa99b" />
      <rect x="24" y="43" width="112" height="58" rx="8" fill="#eae5d5" />
      <path d="M10 58h140v46q0 10-10 10H20q-10 0-10-10Z" fill="#e8dc9d" />
      <path d="M70 78v-8a10 10 0 0 1 20 0v8" fill="none" stroke="#38392f" strokeWidth="5" />
      <rect x="64" y="77" width="32" height="24" rx="6" fill="#38392f" />
      <circle cx="80" cy="87" r="3" fill="#e8dc9d" />
    </svg>
  );
}
export function OfflinePage() {
  useEffect(() => {
    reportAnalytics({ name: 'page_view', page: 'offline' });
  }, []);
  const online = useConnection(),
    [copies, setCopies] = useState<VaultEnvelope[]>([]),
    [owner, setOwner] = useState(new URLSearchParams(location.search).get('account') ?? ''),
    [envelope, setEnvelope] = useState<VaultEnvelope | null>(null),
    [vault, setVault] = useState<OfflineVault | null>(null),
    [pass, setPass] = useState(''),
    [repeat, setRepeat] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [title, setTitle] = useState(''),
    [captureNote, setCaptureNote] = useState(''),
    [filter, setFilter] = useState(''),
    [list, setList] = useState('all'),
    [limit, setLimit] = useState(50),
    [editor, setEditor] = useState<OfflineRecord | null>(null),
    [note, setNote] = useState(''),
    [confirm, setConfirm] = useState<{
      kind: 'lock' | 'remove' | 'discard' | 'switch-note';
      operation?: OfflineOperation;
      record?: OfflineRecord;
    } | null>(null);
  const key = useRef<CryptoKey | null>(null),
    current = useRef<{ owner: string; stamp: string; salt: string } | null>(null),
    job = useRef(false),
    generation = useRef(0),
    mounted = useRef(true),
    latest = useRef({ dirty: false, busy: false });
  const dirty = !!title || !!captureNote || (!!editor && note !== editor.note);
  latest.current = { dirty, busy };
  const invalidateSession = useCallback(() => {
    mounted.current = false;
    generation.current++;
    key.current = null;
  }, []);
  useEffect(() => {
    let live = true;
    mounted.current = true;
    void listVaults()
      .then(async (rows) => {
        const selected = new URLSearchParams(location.search).get('account') ?? rows[0]?.owner ?? '';
        const found = selected ? await readVault(selected) : null;
        if (live) {
          setCopies(rows);
          setOwner(selected);
          setEnvelope(found);
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setReady(true);
        }
      });
    return () => {
      live = false;
      invalidateSession();
    };
  }, [invalidateSession]);
  function lock() {
    generation.current++;
    key.current = null;
    current.current = null;
    setVault(null);
    setPass('');
    setRepeat('');
    setEditor(null);
    setNote('');
    setTitle('');
    setCaptureNote('');
    setBusy(false);
    setStatus('Device copy locked. Pending saves remain encrypted on this device.');
  }
  const lockRef = useRef(lock);
  lockRef.current = lock;
  useEffect(() => {
    let used = Date.now();
    const activity = () => {
      used = Date.now();
    };
    const hide = () => lockRef.current();
    const timer = setInterval(() => {
      if (!job.current && !latest.current.dirty && Date.now() - used >= 15 * 60000) lockRef.current();
    }, 30000);
    const leave = (e: BeforeUnloadEvent) => {
      if (latest.current.dirty || latest.current.busy) e.preventDefault();
    };
    window.addEventListener('keydown', activity);
    window.addEventListener('pointerdown', activity);
    window.addEventListener('pagehide', hide);
    window.addEventListener('beforeunload', leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', activity);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('beforeunload', leave);
    };
  }, []);
  async function run(task: (token: number) => Promise<void>) {
    if (job.current) return;
    job.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    const token = generation.current;
    try {
      await task(token);
    } catch (e) {
      if (mounted.current && generation.current === token)
        setError(
          e instanceof Error
            ? e.message
            : 'Could not complete that action. Your earlier device copy is kept.',
        );
    } finally {
      job.current = false;
      if (mounted.current && generation.current === token) setBusy(false);
    }
  }
  const active = (token: number) => mounted.current && generation.current === token;
  async function commit(next: OfflineVault, token: number) {
    const session = current.current,
      secret = key.current;
    if (!session || !secret) throw new Error('Unlock this device copy first.');
    const sealed = await sealVault(session.owner, secret, session.salt, next);
    if (!active(token)) return false;
    await writeVault(sealed, session.stamp);
    if (!active(token)) return false;
    current.current = { ...session, stamp: sealed.stamp };
    setEnvelope(sealed);
    setVault(next);
    setCopies((rows) => [...rows.filter((r) => r.owner !== sealed.owner), sealed]);
    return true;
  }
  async function unlock(token: number) {
    if (!envelope) throw new Error('Choose an existing device copy.');
    const fresh = await readVault(envelope.owner);
    if (!fresh)
      throw new Error(
        'This device copy was removed in another tab. Reload the page to choose a current copy.',
      );
    const secret = await vaultKey(pass, fresh.salt),
      value = await unsealVault(fresh, secret);
    if (!active(token)) return;
    key.current = secret;
    current.current = { owner: fresh.owner, stamp: fresh.stamp, salt: fresh.salt };
    setEnvelope(fresh);
    setCopies((rows) => [...rows.filter((r) => r.owner !== fresh.owner), fresh]);
    setVault(value);
    setPass('');
    setRepeat('');
    setStatus('Device copy unlocked. Pending saves have not been sent.');
  }
  async function prepare(token: number) {
    if (pass !== repeat) throw new Error('The offline passphrases do not match.');
    const salt = vaultSalt(),
      secret = await vaultKey(pass, salt),
      actual = await verifiedOfflineOwner(owner);
    if (await readVault(actual))
      throw new Error('A device copy already exists for this account. Unlock it before refreshing.');
    setStatus('Preparing the offline page…');
    await prepareOfflineShell();
    const snapshot = await downloadOfflineSnapshot(actual),
      value = { snapshot, queue: [] },
      sealed = await sealVault(actual, secret, salt, value);
    if (!active(token)) return;
    await writeVault(sealed, null);
    if (!active(token)) return;
    key.current = secret;
    current.current = { owner: actual, stamp: sealed.stamp, salt };
    setOwner(actual);
    setEnvelope(sealed);
    setVault(value);
    setCopies((rows) => [...rows.filter((r) => r.owner !== actual), sealed]);
    setPass('');
    setRepeat('');
    setStatus('Encrypted device copy saved. This offline page is prepared for reloads.');
  }
  async function queueCapture(token: number) {
    if (
      !vault ||
      vault.queue.length >= 100 ||
      vault.snapshot.records.length + vault.queue.filter((q) => q.kind === 'capture').length >= 5000
    )
      throw new Error('Keep up to 100 pending saves.');
    const op = offlineOperation.parse({
      id: crypto.randomUUID(),
      epoch: vault.snapshot.epoch,
      kind: 'capture',
      recordKind: null,
      recordId: null,
      title,
      note: captureNote,
      expectedNote: null,
      expectedUpdatedAt: null,
    });
    if (await commit({ ...vault, queue: [...vault.queue, op] }, token)) {
      setTitle('');
      setCaptureNote('');
      setStatus('Capture queued on this device. It has not been saved to Worth yet.');
    }
  }
  async function queueNote(token: number) {
    if (!vault || !editor) throw new Error('Choose a saved record.');
    if (vault.queue.length >= 100 || vault.queue.some((q) => q.kind === 'note' && q.recordId === editor.id))
      throw new Error(
        'This record already has a pending note, or the queue is full. Sync or review that pending save first.',
      );
    const op = offlineOperation.parse({
      id: crypto.randomUUID(),
      epoch: vault.snapshot.epoch,
      kind: 'note',
      recordKind: editor.kind,
      recordId: editor.id,
      title: editor.title,
      note,
      expectedNote: editor.note,
      expectedUpdatedAt: editor.updatedAt,
    });
    if (await commit({ ...vault, queue: [...vault.queue, op] }, token)) {
      setEditor(null);
      setNote('');
      setStatus('Note edit queued on this device. It has not changed your saved archive yet.');
    }
  }
  async function sync(token: number) {
    if (!vault || !current.current) throw new Error('Unlock this device copy first.');
    const account = current.current.owner;
    await verifiedOfflineOwner(account);
    let next = vault;
    for (const op of vault.queue) {
      if (!active(token)) return;
      setStatus(`Checking pending save for ${op.title}…`);
      const result = await syncOfflineOperation(account, op);
      const old = next.snapshot.records.find((r) => r.id === result.record.id),
        record: OfflineRecord = old
          ? { ...old, note: result.record.note, updatedAt: result.record.updatedAt }
          : {
              id: result.record.id,
              kind: 'inbox',
              listId: null,
              title: op.title,
              note: op.note,
              updatedAt: result.record.updatedAt,
              date: null,
              decision: null,
              rank: null,
            };
      next = {
        ...next,
        snapshot: {
          ...next.snapshot,
          records: old
            ? next.snapshot.records.map((r) => (r.id === record.id ? record : r))
            : [record, ...next.snapshot.records],
        },
        queue: next.queue.filter((q) => q.id !== op.id),
      };
      if (!(await commit(next, token))) return;
    }
    setStatus('Pending saves confirmed by Worth. Refresh the copy to read current archive changes.');
  }
  async function refresh(token: number) {
    if (!vault || !current.current) throw new Error('Unlock this copy first.');
    if (vault.queue.length || dirty)
      throw new Error('Sync or review pending saves and queue unfinished text before refreshing.');
    const snapshot = await downloadOfflineSnapshot(current.current.owner);
    await prepareOfflineShell();
    if (await commit({ snapshot, queue: [] }, token)) setStatus('Offline copy refreshed from Worth.');
  }
  function copyText(value: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => setStatus('Text copied.'))
      .catch(() => setError('Select the visible text and copy it manually.'));
  }
  function downloadPending() {
    if (!vault) return;
    const content = vault.queue
      .map((op) => `${op.kind === 'capture' ? 'Unfiled capture' : 'Note edit'}: ${op.title}\n${op.note}`)
      .join('\n\n---\n\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' })),
      a = document.createElement('a');
    a.href = url;
    a.download = `worth-pending-text-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Pending text download started. This downloaded file is plain text; keep it private.');
  }
  const records =
    vault?.snapshot.records.filter(
      (r) =>
        (list === 'all' || (list === 'inbox' ? r.kind === 'inbox' : r.listId === list)) &&
        `${r.title} ${r.note}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
    ) ?? [];
  return (
    <main className="offline-page">
      <header className="offline-header">
        <a href="/" className="product-wordmark">
          worth
        </a>
        <a href="/settings">Back to Worth →</a>
      </header>
      <header className="offline-heading">
        <div>
          <p className="overline">ON THIS DEVICE · {online ? 'CONNECTION AVAILABLE' : 'OFFLINE'}</p>
          <h1>Your offline copy.</h1>
          <p>Read what you kept. Save the next thing for later.</p>
        </div>
        <Folder />
      </header>
      <p>
        Bookmark this page for offline access after preparing a copy. Keep an encrypted text copy of
        collections, names, notes, recorded dates, calls and ranks. Photos, receipts, capsules and shared
        spaces stay in the connected app. Offline copies support up to 2,000 records, 500 collections and 4 MB
        of text.
      </p>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="offline-status">
          {status}
        </p>
      )}
      {!ready && <p role="status">Reading device copies…</p>}
      {ready && !vault && (
        <section className="offline-unlock">
          <h2>{envelope ? 'Unlock device copy' : 'Prepare a device copy'}</h2>
          {copies.length > 0 && (
            <label>
              Device copy
              <select
                disabled={busy}
                value={owner}
                onChange={(e) => {
                  const next = e.target.value;
                  setOwner(next);
                  setEnvelope(copies.find((c) => c.owner === next) ?? null);
                  setPass('');
                  setRepeat('');
                  setError('');
                  setStatus('');
                }}
              >
                {!copies.some((c) => c.owner === owner) && (
                  <option value={owner}>Current account · no device copy</option>
                )}
                {copies.map((c, i) => (
                  <option key={c.owner} value={c.owner}>
                    Device copy {i + 1} · saved {new Date(c.savedAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            Use a separate offline passphrase of 12–200 characters. It can unlock this copy without signing
            in; syncing requires its original account. Worth cannot recover it. Removing a locked copy
            requires connecting and signing in to that account. Reloading or locking removes the unlocked text
            from this page.
          </p>
          <label>
            Offline passphrase
            <input
              type="password"
              autoComplete={envelope ? 'current-password' : 'new-password'}
              disabled={busy}
              minLength={12}
              maxLength={200}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </label>
          {!envelope && (
            <label>
              Repeat offline passphrase
              <input
                type="password"
                autoComplete="new-password"
                disabled={busy}
                maxLength={200}
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
          )}
          <button
            className="button button-accent"
            disabled={busy || (!envelope && !online) || !pass}
            onClick={() => void run(envelope ? unlock : prepare)}
          >
            {busy ? 'Checking…' : envelope ? 'Unlock copy' : 'Save offline copy'}
          </button>
          {envelope && (
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => setConfirm({ kind: 'remove' })}
            >
              Remove device copy
            </button>
          )}
          {!online && !envelope && <p>Connect and sign in to Worth to prepare this device first.</p>}
        </section>
      )}
      {vault && (
        <>
          <section className="offline-summary">
            <h2>Saved text archive</h2>
            <p>
              Snapshot prepared {new Date(vault.snapshot.savedAt).toLocaleString()}.{' '}
              {vault.snapshot.records.length} {vault.snapshot.records.length === 1 ? 'record' : 'records'}.
              This is a device copy; connected records may have changed.
            </p>
            <div className="offline-actions">
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => (dirty ? setConfirm({ kind: 'lock' }) : lock())}
              >
                Lock copy
              </button>
              <button
                className="button button-outline"
                disabled={busy || !online || vault.queue.length > 0 || dirty}
                onClick={() => void run(refresh)}
              >
                Refresh offline copy
              </button>
            </div>
            <p>
              This copy locks on reload, when leaving the page and after 15 minutes without interaction when
              there is no unqueued form text. Browser cleanup can remove local copies; keep important backups
              separately.
            </p>
          </section>
          <section className="offline-pending" aria-label="Pending saves">
            <header>
              <h2>
                Pending saves <small>{vault.queue.length} / 100</small>
              </h2>
              <p>
                Nothing here has been sent automatically. Sync checks the signed-in account and each original
                note. Conflicts and uncertain replies keep the exact request.
              </p>
            </header>
            <div className="offline-actions">
              <button
                className="button button-accent"
                disabled={busy || !online || !vault.queue.length}
                onClick={() => void run(sync)}
              >
                {busy ? 'Checking saves…' : 'Sync pending saves'}
              </button>
              <button
                className="button button-outline"
                disabled={busy || !vault.queue.length}
                onClick={downloadPending}
              >
                Download pending text
              </button>
            </div>
            {vault.queue.length === 0 && <p>No pending saves.</p>}
            {vault.queue.map((op) => (
              <details key={op.id} className="offline-pending-row">
                <summary>
                  {op.kind === 'capture' ? 'Unfiled capture' : 'Note edit'} · {op.title}
                </summary>
                <label>
                  Queued text
                  <textarea rows={4} readOnly value={op.note || op.title} />
                </label>
                {op.kind === 'note' && (
                  <>
                    <h3>Note in the device snapshot</h3>
                    <p className="offline-written">{op.expectedNote || 'No previous note'}</p>
                  </>
                )}
                <div className="offline-actions">
                  <button
                    className="button button-outline"
                    onClick={() => copyText(op.kind === 'capture' ? `${op.title}\n${op.note}` : op.note)}
                  >
                    Copy queued text
                  </button>
                  <a
                    href={
                      op.kind === 'capture'
                        ? '/inbox'
                        : op.recordKind === 'inbox'
                          ? '/inbox'
                          : `/lists/${vault.snapshot.records.find((r) => r.id === op.recordId)?.listId ?? ''}?focus=${op.recordKind}:${op.recordId}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Compare in connected Worth ↗
                  </a>
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'discard', operation: op })}
                  >
                    Discard pending save
                  </button>
                </div>
              </details>
            ))}
          </section>
          <section className="offline-capture">
            <h2>Capture for the Unfiled</h2>
            <p>A name is enough. Queue it to keep it encrypted on this device, then sync when connected.</p>
            <label>
              Find name
              <input
                maxLength={120}
                value={title}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Capture note <span>optional</span>
              <textarea
                rows={3}
                maxLength={4000}
                value={captureNote}
                disabled={busy}
                onChange={(e) => setCaptureNote(e.target.value)}
              />
            </label>
            <button
              className="button button-accent"
              disabled={busy || !title.trim() || vault.queue.length >= 100}
              onClick={() => void run(queueCapture)}
            >
              Queue Unfiled capture
            </button>
            <p>Unqueued text stays only on this page. It has not been saved to the device copy.</p>
          </section>
          <section className="offline-browse">
            <h2>Read your archive</h2>
            <div className="offline-filters">
              <label>
                Find saved text
                <input
                  value={filter}
                  maxLength={120}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setLimit(50);
                  }}
                />
              </label>
              <label>
                Collection or Unfiled
                <select
                  value={list}
                  onChange={(e) => {
                    setList(e.target.value);
                    setLimit(50);
                  }}
                >
                  <option value="all">All saved text</option>
                  <option value="inbox">Unfiled</option>
                  {vault.snapshot.lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              {records.length} matching {records.length === 1 ? 'record' : 'records'}.
            </p>
            {records.slice(0, limit).map((r) => (
              <details key={r.id} className="offline-record">
                <summary>
                  <strong>{r.title}</strong>
                  <span>
                    {r.kind === 'inbox'
                      ? 'Unfiled'
                      : (vault.snapshot.lists.find((l) => l.id === r.listId)?.name ?? 'Collection')}
                    {r.date ? ` · ${r.date}` : ''}
                  </span>
                </summary>
                {r.kind === 'item' && (
                  <p>
                    Personal call:{' '}
                    {r.decision === null
                      ? 'No call'
                      : r.decision === 'favorite'
                        ? 'Favorite'
                        : r.decision === 'meh'
                          ? 'Meh'
                          : 'Not again'}{' '}
                    · Collection rank: {r.rank === null ? 'Unranked' : `#${r.rank}`}
                  </p>
                )}
                <p className="offline-written">{r.note || 'No note recorded.'}</p>
                <button
                  className="button button-outline"
                  disabled={busy || vault.queue.some((q) => q.kind === 'note' && q.recordId === r.id)}
                  onClick={() => {
                    if (editor && note !== editor.note) setConfirm({ kind: 'switch-note', record: r });
                    else {
                      setEditor(r);
                      setNote(r.note);
                    }
                  }}
                >
                  Edit note offline
                </button>
              </details>
            ))}
            {records.length > limit && (
              <button className="button button-outline" onClick={() => setLimit(limit + 50)}>
                Show more saved text
              </button>
            )}
            {editor && (
              <section className="offline-note-editor" aria-label="Offline note editor">
                <h3>{editor.title}</h3>
                <label>
                  Offline note text
                  <textarea
                    rows={6}
                    maxLength={4000}
                    value={note}
                    disabled={busy}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <p>
                  This changes only the note after a successful sync. Other fields stay as recorded. Your
                  current saved note is checked first.
                </p>
                <button
                  className="button button-accent"
                  disabled={busy || note === editor.note || vault.queue.length >= 100}
                  onClick={() => void run(queueNote)}
                >
                  Queue note edit
                </button>
              </section>
            )}
          </section>
          <button
            className="button button-outline"
            disabled={busy}
            onClick={() => setConfirm({ kind: 'remove' })}
          >
            Remove device copy
          </button>
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === 'remove'
              ? 'Remove this encrypted device copy?'
              : confirm.kind === 'discard'
                ? 'Discard this pending save?'
                : confirm.kind === 'switch-note'
                  ? 'Discard the unqueued note draft?'
                  : 'Lock and discard unqueued text?'
          }
          description={
            confirm.kind === 'remove'
              ? 'This deletes only this account’s device copy and its pending saves. Connected Worth records and other device copies stay intact. A request with an uncertain reply may already have saved in Worth.'
              : confirm.kind === 'discard'
                ? 'This removes the exact pending request from this device. An uncertain save may already be in Worth; compare there before creating another request.'
                : confirm.kind === 'switch-note'
                  ? 'The current note draft has not been queued. Discard it to edit the other record. Queued requests are kept.'
                  : 'Unqueued form text will be discarded. Already queued saves stay encrypted on this device.'
          }
          confirmLabel={
            confirm.kind === 'remove'
              ? 'Remove device copy'
              : confirm.kind === 'discard'
                ? 'Discard pending save'
                : confirm.kind === 'switch-note'
                  ? 'Discard note draft'
                  : 'Lock copy'
          }
          pending={busy}
          error={error || undefined}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === 'lock') {
              setConfirm(null);
              lock();
            } else if (confirm.kind === 'switch-note') {
              setEditor(confirm.record!);
              setNote(confirm.record!.note);
              setConfirm(null);
            } else
              void run(async (token) => {
                if (confirm.kind === 'remove') {
                  if (!envelope) throw new Error('No device copy is selected.');
                  if (!vault) await verifiedOfflineOwner(envelope.owner);
                  await deleteVault(envelope.owner, envelope.stamp);
                  if (!active(token)) return;
                  setCopies((rows) => rows.filter((c) => c.owner !== envelope.owner));
                  setEnvelope(null);
                  setConfirm(null);
                  lock();
                  setStatus('Device copy removed. Connected Worth records stay intact.');
                } else {
                  if (!vault || !confirm.operation) return;
                  if (
                    await commit(
                      { ...vault, queue: vault.queue.filter((q) => q.id !== confirm.operation!.id) },
                      token,
                    )
                  ) {
                    setConfirm(null);
                    setStatus(
                      'Pending request removed from this device. Connected Worth records were not changed.',
                    );
                  }
                }
              });
          }}
        />
      )}
      <footer className="offline-footer">
        <a href="/help">Help</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </footer>
    </main>
  );
}
