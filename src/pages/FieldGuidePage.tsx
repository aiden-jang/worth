import type { FieldGuideDraft } from '../shared/field-guide';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useBlocker } from 'react-router';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { usePageTitle } from '../hooks/usePageTitle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BookletPreview } from '../components/BookletPreview';
import { emptyFieldGuide, fieldGuideData, isFieldGuideDraft } from '../shared/field-guide';
import { prepareBooklet, saveLocalFile } from '../shared/booklet-export';
import type { BookletData } from '../shared/booklet';
import '../field-guide.css';

type Ready = { signature: string; file: File; data: BookletData };
export function FieldGuidePage() {
  usePageTitle('Field guide');
  const draft = useDraft<FieldGuideDraft>('field-guide', emptyFieldGuide, isFieldGuideDraft),
    form = draft.form;
  const current = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const archived = useQuery({ queryKey: ['lists', 'archived'], queryFn: api.archivedLists });
  const lists = [...(current.data?.lists ?? []), ...(archived.data?.lists ?? [])].filter(
    (list) => list.kind === 'collection',
  );
  const availableLists = lists.filter((list) => !list.archived || form.includeArchived);
  const [sourceId, setSourceId] = useState(''),
    [recordId, setRecordId] = useState('');
  const source = useQuery({
    queryKey: ['items', sourceId],
    queryFn: () => api.items(sourceId),
    enabled: !!sourceId,
  });
  const records = useQueries({
    queries: form.entries.map((entry) => ({
      queryKey: ['field-guide-item', entry.id],
      queryFn: () => api.item(entry.id),
    })),
  });
  const items = records.flatMap((query) => query.data?.item ?? []);
  const names = new Map(lists.map((list) => [list.id, list.name]));
  const data = fieldGuideData(form, items, names),
    signature = JSON.stringify(data);
  const [ready, setReady] = useState<Ready | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [printReady, setPrintReady] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const active = useRef(true),
    sequence = useRef(0),
    controller = useRef<AbortController | null>(null);
  const valid =
    items.length === form.entries.length &&
    form.entries.length > 0 &&
    !records.some((query) => query.isError || query.isPending) &&
    (!form.collections ||
      form.entries.every((entry) => names.has(items.find((item) => item.id === entry.id)?.listId ?? '')));
  const prepared = ready?.signature === signature ? ready : null;
  const blocker = useBlocker(JSON.stringify(form) !== JSON.stringify(emptyFieldGuide));
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!prepared) {
      setPrintReady('');
      return;
    }
    let live = true;
    void document.fonts.ready.then(() => {
      if (live) setPrintReady(prepared.signature);
    });
    return () => {
      live = false;
    };
  }, [prepared]);
  function change(next: Partial<typeof form>) {
    draft.setForm({ ...form, ...next });
    setStatus('');
  }
  function remove(id: string) {
    change({ entries: form.entries.filter((entry) => entry.id !== id) });
    setRemoving(null);
  }
  async function prepare() {
    if (busy || !valid) return;
    const run = ++sequence.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setReady(null);
    setError('');
    setStatus('Preparing the previewed guide…');
    try {
      const result = await prepareBooklet(data, controller.current.signal);
      if (!active.current || run !== sequence.current) return;
      const name =
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 64) || 'field-guide';
      setReady({
        signature,
        file: new File([result.html], `worth-${name}.html`, { type: 'text/html' }),
        data: result.data,
      });
      setStatus('Guide ready. Review it below before downloading.');
    } catch (failure) {
      if (active.current && run === sequence.current) {
        setError(failure instanceof Error ? failure.message : 'Could not prepare this guide. Try again.');
        setStatus('');
      }
    } finally {
      if (active.current && run === sequence.current) setBusy(false);
    }
  }
  return (
    <main className="light-page page-width field-guide-page">
      <header className="page-head">
        <div>
          <p className="overline">SOMETHING TO KEEP</p>
          <h1>Field guide</h1>
          <p>A few finds, in your own order.</p>
        </div>
        <Link to="/patterns">Back to Patterns →</Link>
      </header>
      <p className="guide-intro">
        Choose up to 12 records across collections. Names and types are included; notes, saved locations,
        collection names and photos need your choice. The preview shows exactly what the file contains. Share
        the downloaded copy yourself; anyone with a copy can read what you included.
      </p>
      <fieldset className="guide-fields" disabled={busy}>
        <legend>Choose records</legend>
        <label className="guide-check">
          <input
            type="checkbox"
            checked={form.includeArchived}
            onChange={(e) => change({ includeArchived: e.target.checked })}
          />
          Include archived collections in choices
        </label>
        <div className="guide-two">
          <label>
            Collection
            <select
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setRecordId('');
              }}
            >
              <option value="">Choose a collection</option>
              {availableLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                  {list.archived ? ' · archived' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Record
            <select value={recordId} onChange={(e) => setRecordId(e.target.value)}>
              <option value="">Choose a record</option>
              {source.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="button button-outline"
          disabled={
            form.entries.length >= 12 ||
            form.entries.some((entry) => entry.id === recordId) ||
            !source.data?.items.some((item) => item.id === recordId) ||
            !availableLists.some((list) => list.id === sourceId)
          }
          onClick={() => {
            const item = source.data!.items.find((item) => item.id === recordId)!;
            change({
              entries: [
                ...form.entries,
                { id: item.id, listId: item.listId, title: item.title, caption: '' },
              ],
            });
            setRecordId('');
            setStatus(`${item.title} added to guide.`);
          }}
        >
          Add to guide
        </button>
        {(current.isError || archived.isError || source.isError) && (
          <p role="alert">
            {current.error?.message || archived.error?.message || source.error?.message}
            <button
              className="button button-outline"
              onClick={() => {
                void current.refetch();
                void archived.refetch();
                if (sourceId) void source.refetch();
              }}
            >
              Try sources again
            </button>
          </p>
        )}
        <p>{form.entries.length}/12 selected. Changing this guide does not edit your archive.</p>
      </fieldset>
      {!!form.entries.length && (
        <>
          <fieldset className="guide-fields" disabled={busy}>
            <legend>Guide details</legend>
            <label>
              Guide title
              <input maxLength={120} value={form.title} onChange={(e) => change({ title: e.target.value })} />
            </label>
            <label>
              Introduction (optional)
              <textarea
                aria-label="Guide introduction"
                maxLength={280}
                value={form.introduction}
                onChange={(e) => change({ introduction: e.target.value })}
              />
            </label>
            <div className="guide-two">
              {(
                [
                  ['notes', 'Include record notes'],
                  ['locations', 'Include saved locations'],
                  ['collections', 'Include collection names'],
                  ['photos', 'Include photos'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="guide-check">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => change({ [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p>
              Locations use the text you saved on each record. Nothing is inferred from visits, photos or your
              device. Exported photos are copies without original image metadata; visible details remain.
            </p>
            <ol className="guide-selection">
              {form.entries.map((entry, index) => {
                const query = records[index],
                  item = query.data?.item;
                return (
                  <li key={entry.id}>
                    <h2>{item?.title ?? entry.title}</h2>
                    {query.isPending && <p role="status">Opening current details…</p>}
                    {query.isError && (
                      <p role="alert">
                        This record is unavailable. Keep its caption for copying, retry or remove it from this
                        guide.{' '}
                        <button className="button button-outline" onClick={() => void query.refetch()}>
                          Retry record
                        </button>
                      </p>
                    )}
                    {item && (
                      <p>
                        {names.get(item.listId) ?? 'Opening collection…'}
                        {lists.find((list) => list.id === item.listId)?.archived ? ' · archived' : ''}
                      </p>
                    )}
                    <label>
                      Caption for {item?.title ?? entry.title}
                      <textarea
                        aria-label={`Caption for ${item?.title ?? entry.title}`}
                        maxLength={300}
                        value={entry.caption}
                        onChange={(e) =>
                          change({
                            entries: form.entries.map((row) =>
                              row.id === entry.id ? { ...row, caption: e.target.value } : row,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="data-actions">
                      <button
                        className="button button-outline"
                        disabled={index === 0}
                        aria-label={`Move ${item?.title ?? entry.title} earlier`}
                        onClick={() => {
                          const entries = [...form.entries];
                          [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]];
                          change({ entries });
                        }}
                      >
                        Earlier
                      </button>
                      <button
                        className="button button-outline"
                        disabled={index === form.entries.length - 1}
                        aria-label={`Move ${item?.title ?? entry.title} later`}
                        onClick={() => {
                          const entries = [...form.entries];
                          [entries[index], entries[index + 1]] = [entries[index + 1], entries[index]];
                          change({ entries });
                        }}
                      >
                        Later
                      </button>
                      <button
                        className="button button-outline"
                        onClick={() => (entry.caption ? setRemoving(entry.id) : remove(entry.id))}
                      >
                        Remove from guide
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </fieldset>
          <div className="data-actions">
            <button className="button button-accent" disabled={!valid || busy} onClick={() => void prepare()}>
              {busy ? 'Preparing…' : 'Prepare field guide'}
            </button>
            <button
              className="button button-outline"
              disabled={!prepared || busy}
              onClick={() => {
                if (prepared) {
                  saveLocalFile(prepared.file);
                  setStatus('Guide downloaded.');
                }
              }}
            >
              Download guide (.html)
            </button>
            <button
              className="button button-outline"
              disabled={!prepared || busy || printReady !== signature}
              onClick={() => window.print()}
            >
              Print / save PDF
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => {
                for (const query of records) void query.refetch();
                void current.refetch();
                void archived.refetch();
              }}
            >
              Refresh current details
            </button>
          </div>
          {ready && !prepared && (
            <p role="status">The preview changed. Prepare a new guide before downloading.</p>
          )}
          <BookletPreview data={prepared?.data ?? data} />
        </>
      )}
      {!form.entries.length && <p>No records in this guide yet. Choose a collection and a record above.</p>}
      <p role="status">{draft.status || 'Guide drafts can recover on this account/device for seven days.'}</p>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {prepared &&
        createPortal(
          <div className="booklet-print-root">
            <style>{'@page{size:A5;margin:12mm}'}</style>
            <BookletPreview data={prepared.data} print />
          </div>,
          document.body,
        )}
      {removing && (
        <ConfirmDialog
          title="Remove this guide entry?"
          description="Its guide caption will be cleared. The saved record stays unchanged."
          confirmLabel="Remove from guide"
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Leave this guide draft?"
          description="Drafts can recover for seven days when device storage is available. If storage is blocked, copy your captions before leaving."
          confirmLabel="Leave page"
          pending={busy}
          onConfirm={() => blocker.proceed()}
          onClose={() => blocker.reset()}
        />
      )}
    </main>
  );
}
