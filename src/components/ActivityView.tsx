import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash, X } from '@phosphor-icons/react';
import type { Log } from '../shared/models';
import { api, type LogInput } from '../api';
import { formatDate, formatElapsedDays, today } from '../format';
import { PhotoControl } from './PhotoControl';

export function ActivityView({
  listId,
  logs,
  loading,
  error,
  newOpen,
  focusLogId,
  onCloseNew,
  onNew,
}: {
  listId: string;
  logs: Log[];
  loading: boolean;
  error: boolean;
  newOpen: boolean;
  focusLogId: string | null;
  onCloseNew: () => void;
  onNew: () => void;
}) {
  const [selected, setSelected] = useState<Log | null>(null);
  const [repeatTitle, setRepeatTitle] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
  const visible = logs
    .filter((log) => `${log.title} ${log.note}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : sort === 'oldest'
          ? a.happenedOn.localeCompare(b.happenedOn)
          : b.happenedOn.localeCompare(a.happenedOn),
    );
  const lastLog = logs.reduce<Log | null>(
    (latest, log) => (!latest || log.happenedOn > latest.happenedOn ? log : latest),
    null,
  );

  function close() {
    setSelected(null);
    setRepeatTitle('');
    if (newOpen) onCloseNew();
  }

  useEffect(() => {
    if (!focusLogId) return;
    const log = logs.find((entry) => entry.id === focusLogId);
    if (log) setSelected(log);
  }, [focusLogId, logs]);

  if (loading) return <p className="loading-line">Loading activity…</p>;
  if (error) return <p className="error-banner">Couldn't load the activity log. Refresh to try again.</p>;

  return (
    <section className="activity-view">
      {lastLog && (
        <section className="activity-summary" aria-label="Latest activity">
          <div>
            <span>Last done</span>
            <strong>{lastLog.title}</strong>
          </div>
          <div>
            <span>{formatElapsedDays(lastLog.happenedOn)}</span>
            <small>{formatDate(lastLog.happenedOn)}</small>
          </div>
        </section>
      )}
      <div className="activity-tools">
        <input
          aria-label="Search activity"
          placeholder="Find a log"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Sort activity"
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name</option>
        </select>
        <span>
          {visible.length} of {logs.length} {logs.length === 1 ? 'log' : 'logs'}
        </span>
      </div>
      {!visible.length ? (
        <div className="empty-list">
          <h2>{logs.length ? 'Nothing matches.' : 'Nothing here yet.'}</h2>
          <p>{logs.length ? 'Try another search.' : 'Log a run, a night out, or whatever belongs here.'}</p>
          {!logs.length && (
            <button className="button button-dark" onClick={onNew}>
              <Plus size={17} /> Add first log
            </button>
          )}
        </div>
      ) : (
        <div className="activity-rows">
          {visible.map((log) => (
            <article className="activity-row" key={log.id}>
              <span className="activity-date">
                {formatElapsedDays(log.happenedOn)}
                <small>{formatDate(log.happenedOn)}</small>
              </span>
              <button className="activity-main" onClick={() => setSelected(log)}>
                <strong>{log.title}</strong>
                <small>{formatMetric(log) || log.note || 'View detail'}</small>
              </button>
              {log.hasPhoto && (
                <img src={`/api/logs/${log.id}/photo?v=${log.updatedAt}`} alt="" loading="lazy" />
              )}
              <button
                className="activity-again"
                onClick={() => {
                  setRepeatTitle(log.title);
                  onNew();
                }}
              >
                Again <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </div>
      )}
      {(newOpen || selected) && (
        <ActivityEditor
          key={selected?.id ?? `new-${repeatTitle}`}
          listId={listId}
          log={newOpen ? null : selected}
          initialTitle={repeatTitle}
          onClose={close}
        />
      )}
    </section>
  );
}

function ActivityEditor({
  listId,
  log,
  initialTitle,
  onClose,
}: {
  listId: string;
  log: Log | null;
  initialTitle: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [form, setForm] = useState<LogInput>(log ? fromLog(log) : emptyLog(initialTitle));
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      dialog.current?.close();
    };
  }, []);
  const save = useMutation({
    mutationFn: () => (log ? api.updateLog(log.id, form) : api.createLog(listId, form)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      dialog.current?.close();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteLog(log!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['logs', listId] });
      void client.invalidateQueries({ queryKey: ['overview'] });
      dialog.current?.close();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <dialog
      className="editor-dialog activity-editor-dialog"
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="editor-inner">
        <div className="editor-head">
          <div>
            <p className="overline">{log ? 'ACTIVITY DETAIL' : 'QUICK LOG'}</p>
            <h2>{log ? log.title : 'What happened?'}</h2>
          </div>
          <button className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}>
            <X size={22} />
          </button>
        </div>
        {log && (
          <PhotoControl
            kind="logs"
            id={log.id}
            hasPhoto={log.hasPhoto}
            version={log.updatedAt}
            listId={listId}
          />
        )}
        <form className="editor-form record-form" onSubmit={submit}>
          <label>
            What
            <input
              required
              autoFocus={!log}
              maxLength={120}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Evening run, haircut, bench press…"
            />
          </label>
          <label>
            When
            <input
              type="date"
              required
              value={form.happenedOn}
              onChange={(event) => setForm({ ...form, happenedOn: event.target.value })}
            />
          </label>
          <div className="metric-row">
            <label>
              Amount <span className="optional">optional</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.amount ?? ''}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value === '' ? null : Number(event.target.value) })
                }
                placeholder="5.2"
              />
            </label>
            <label>
              Unit
              <input
                maxLength={24}
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                placeholder="mi, lb, km…"
              />
            </label>
          </div>
          <div className="metric-row">
            <label>
              Sets <span className="optional">optional</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.sets ?? ''}
                onChange={(event) =>
                  setForm({ ...form, sets: event.target.value === '' ? null : Number(event.target.value) })
                }
              />
            </label>
            <label>
              Reps <span className="optional">optional</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.reps ?? ''}
                onChange={(event) =>
                  setForm({ ...form, reps: event.target.value === '' ? null : Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Private note <span className="optional">optional</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="Anything you want to remember"
            />
          </label>
          {save.isError && <p className="form-error">{save.error.message}</p>}
          <button className="button button-dark" disabled={save.isPending}>
            {log ? 'Save changes' : 'Save log'}
          </button>
        </form>
        {log && (
          <button
            className="text-danger"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete this ${log.title} log?`)) remove.mutate();
            }}
          >
            <Trash size={16} /> Delete log
          </button>
        )}
        {remove.isError && <p className="form-error">{remove.error.message}</p>}
      </div>
    </dialog>
  );
}

function emptyLog(title = ''): LogInput {
  return {
    itemId: null,
    title,
    happenedOn: today(),
    note: '',
    amount: null,
    unit: '',
    sets: null,
    reps: null,
  };
}

function fromLog(log: Log): LogInput {
  return {
    itemId: null,
    title: log.title,
    happenedOn: log.happenedOn,
    note: log.note,
    amount: log.amount,
    unit: log.unit,
    sets: log.sets,
    reps: log.reps,
  };
}

function formatMetric(log: Log): string {
  const parts = [];
  if (log.amount !== null) parts.push(`${log.amount}${log.unit ? ` ${log.unit}` : ''}`);
  if (log.sets !== null && log.reps !== null) parts.push(`${log.sets} × ${log.reps}`);
  return parts.join(' · ');
}
