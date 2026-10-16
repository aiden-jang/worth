import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { TrashPanel } from '../components/TrashTools';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useConnection } from '../hooks/useConnection';
import { cleanDeviceData } from '../shared/device-data';
import { archiveByteLimit, archiveFile, type ArchiveFile } from '../shared/portability';
export function SettingsPage() {
  const client = useQueryClient();
  const owner = client.getQueryData<{ user?: { id: string } }>(['me'])?.user?.id;
  const online = useConnection();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [confirm, setConfirm] = useState<'clear' | 'delete' | null>(null);
  const [file, setFile] = useState<ArchiveFile | null>(null);
  const [fileName, setFileName] = useState('');
  const retryStorage = useRef<string | null>(null);
  const retry = useRef(crypto.randomUUID());
  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    setError('');
    setStatus('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete this action. Try again.');
    } finally {
      setBusy('');
    }
  }
  async function download(photos: boolean) {
    await run(photos ? 'backup' : 'export', async () => {
      const archive = await api.exportArchive(photos);
      const url = URL.createObjectURL(new Blob([JSON.stringify(archive)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `worth-${photos ? 'backup' : 'records'}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(
        photos
          ? 'Backup download started, including photos.'
          : 'Records download started. Photos are not included.',
      );
    });
  }
  async function choose(input: HTMLInputElement) {
    const selected = input.files?.[0];
    input.value = '';
    if (!selected) return;
    setFile(null);
    setFileName('');
    await run('read', async () => {
      if (selected.size > archiveByteLimit) throw new Error('Choose a Worth file smaller than 32 MB.');
      let raw: unknown;
      try {
        raw = JSON.parse(await selected.text());
      } catch {
        throw new Error('This file is not valid JSON.');
      }
      const parsed = archiveFile.safeParse(raw);
      if (!parsed.success)
        throw new Error(
          `Could not read this Worth file: ${parsed.error.issues[0]?.message ?? 'Invalid records'}`,
        );
      if (!parsed.data.lists.length && !parsed.data.collectionTemplates.length)
        throw new Error('This file has no lists or templates to restore.');
      setFile(parsed.data);
      setFileName(selected.name);
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(parsed.data)),
      );
      const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
      retryStorage.current = `worth:restore:${owner}:${hash}`;
      try {
        const old = JSON.parse(localStorage.getItem(retryStorage.current) ?? 'null');
        retry.current =
          old && old.updatedAt > Date.now() - 7 * 86400000 && typeof old.key === 'string'
            ? old.key
            : crypto.randomUUID();
        localStorage.setItem(
          retryStorage.current,
          JSON.stringify({ key: retry.current, updatedAt: Date.now() }),
        );
      } catch {
        retry.current = crypto.randomUUID();
        setStatus('Restore retry protection is available only while this page stays open on this device.');
      }
    });
  }
  return (
    <main className="data-page">
      <header className="data-heading">
        <p className="overline">YOUR ACCOUNT / YOUR DATA</p>
        <h1>Settings.</h1>
        <p>Copies, drafts, and a little housekeeping.</p>
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="data-status" role="status">
          {status}
        </p>
      )}
      <TrashPanel />
      <section className="data-section">
        <h2>Take a copy.</h2>
        <p>Download your records, or a full backup with photos. Share links and Trash aren’t included.</p>
        <p className="data-hint">
          Records-only JSON excludes photos and covers. Photo backups and restore files are limited to 32 MB;
          restore supports up to 5,000 records, 500 lists, 50 templates and 200 photos/covers. Keep downloaded
          files somewhere private.
        </p>
        <div className="data-actions">
          <button
            className="button button-accent"
            disabled={!!busy || !online}
            onClick={() => void download(false)}
          >
            {busy === 'export' ? 'Preparing records…' : 'Export records'}
          </button>
          <button
            className="button button-outline"
            disabled={!!busy || !online}
            onClick={() => void download(true)}
          >
            {busy === 'backup' ? 'Preparing backup…' : 'Back up with photos'}
          </button>
        </div>
      </section>
      <section className="data-section">
        <h2>Bring it back.</h2>
        <p>
          Restore a Worth file as new lists and templates. Review it first; your existing archive stays
          intact.
        </p>
        <label className="button button-outline file-choice">
          Choose backup
          <input
            type="file"
            accept=".json,application/json"
            disabled={!!busy}
            onChange={(e) => void choose(e.currentTarget)}
          />
        </label>
        {file && (
          <div className="restore-preview">
            <p className="overline">RESTORE PREVIEW</p>
            <h3>{fileName}</h3>
            <p>
              {file.lists.length} lists · {file.items.length} items · {file.logs.length} logs ·{' '}
              {file.workoutSessions.length} visits · {file.workoutRoutines.length} routines ·{' '}
              {file.photos.length} photos · {file.collectionTemplates.length} templates
            </p>
            {!!file.lists.length && (
              <ul>
                {file.lists.map((l) => (
                  <li key={l.id}>
                    {l.name} <span> / {l.kind}</span>
                  </li>
                ))}
              </ul>
            )}
            {!!file.collectionTemplates.length && (
              <ul aria-label="Templates to restore">
                {file.collectionTemplates.map((template) => (
                  <li key={template.id}>{template.name} / template</li>
                ))}
              </ul>
            )}
            {file.photosExcluded && <p>Photos are not in this file and will not be restored.</p>}
            <p>
              No public share links will be created. Restoring the same file again after a successful restore
              creates another copy.
            </p>
            <div className="data-actions">
              <button
                className="button button-accent"
                disabled={!!busy || !online}
                onClick={() =>
                  void run('restore', async () => {
                    const result = await api.restoreArchive(file, retry.current);
                    await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
                    if (retryStorage.current) {
                      try {
                        localStorage.removeItem(retryStorage.current);
                      } catch {
                        /* Device storage may be unavailable or blocked. */
                      }
                    }
                    setFile(null);
                    setStatus(
                      `${result.ids.length} ${result.ids.length === 1 ? 'list' : 'lists'} and ${file.collectionTemplates.length} ${file.collectionTemplates.length === 1 ? 'template' : 'templates'} restored. Existing data was kept.`,
                    );
                  })
                }
              >
                {busy === 'restore' ? 'Restoring…' : 'Restore previewed data'}
              </button>
              <button className="button button-outline" disabled={!!busy} onClick={() => setFile(null)}>
                Cancel restore
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="data-section">
        <h2>This device.</h2>
        <p>
          Clear this account’s unfinished drafts, photo drafts and rest timers. Saved records stay in Worth.
        </p>
        <button
          className="button button-outline"
          disabled={!!busy}
          onClick={() => {
            setError('');
            setConfirm('clear');
          }}
        >
          Clear device drafts
        </button>
      </section>
      <section className="data-section">
        <h2>Delete Worth data.</h2>
        <p>Remove your lists, records, photos, routines and shared snapshots. Your shared login remains.</p>
        <p className="data-hint">
          Download a copy first. This removes live Worth data; provider recovery copies and logs may remain
          under their retention practices.
        </p>
        <button
          className="button button-danger"
          disabled={!!busy || !online}
          onClick={() => {
            setError('');
            setConfirm('delete');
          }}
        >
          Delete all Worth data
        </button>
      </section>
      <section className="data-section">
        <h2>Account & help.</h2>
        <p>
          <a href="https://accounts.aidenjang.com/account">Shared account settings ↗</a> ·{' '}
          <Link to="/help">Help & contact</Link> · <Link to="/privacy">Privacy</Link>
        </p>
        <p>
          Worth data deletion leaves your other apps and shared login intact. For shared account deletion,{' '}
          <a href="mailto:support@aidenjang.com?subject=Account%20and%20Worth%20data%20deletion">
            contact us
          </a>{' '}
          and ask for Worth data to be removed too.
        </p>
      </section>
      {confirm && (
        <ConfirmDialog
          title={confirm === 'delete' ? 'Delete all Worth data?' : 'Clear drafts on this device?'}
          description={
            confirm === 'delete'
              ? 'This permanently removes all your Worth lists, records, photos, workouts, routines, shared links and Trash. It cannot be undone. Your shared login and other apps remain.'
              : 'This removes this account’s unfinished text/photo drafts and timers from this device. Saved Worth records and other accounts’ drafts remain.'
          }
          confirmLabel={confirm === 'delete' ? 'Delete all Worth data' : 'Clear device drafts'}
          pending={!!busy}
          error={error}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={() =>
            void run(confirm, async () => {
              if (!owner) throw new Error('Sign in again to manage your data.');
              if (confirm === 'delete') await api.deleteWorthData();
              try {
                await cleanDeviceData(owner, true);
              } catch {
                if (confirm === 'delete') {
                  await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
                  setConfirm(null);
                  throw new Error(
                    'Worth data was deleted. Device storage could not be fully cleared; clear Worth’s site data in your browser.',
                  );
                }
                throw new Error(
                  'Device storage could not be fully cleared. Clear Worth’s site data in your browser.',
                );
              }
              if (confirm === 'delete')
                await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
              setConfirm(null);
              setFile(null);
              setStatus(
                confirm === 'delete'
                  ? 'All Worth data deleted. Your shared login remains.'
                  : 'Device drafts and timers cleared.',
              );
            })
          }
        />
      )}
    </main>
  );
}
