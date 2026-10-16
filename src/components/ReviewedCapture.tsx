import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { itemInput } from '../shared/validation';
import { emptyItemContext } from '../shared/item-context';
import { decisionLabel } from '../shared/decisions';
import {
  emptyCsvMapping,
  readCsv,
  reviewCsv,
  suggestCsvMapping,
  suggestLink,
  duplicateIdentity,
  captureIssueText,
  type CsvMapping,
  type CaptureReview,
  type ReviewedItem,
} from '../shared/reviewed-capture';
import type { Item, ListDetail } from '../shared/models';
import { ConfirmDialog } from './ConfirmDialog';
import '../reviewed-capture.css';

const column = z.number().int().min(-1).max(29);
const captureDraft = z
  .object({
    mode: z.enum(['csv', 'link']),
    csv: z.string().max(262144),
    delimiter: z.enum([',', ';', '\t']),
    mapping: z
      .object({
        title: column,
        type: column,
        note: column,
        sourceUrl: column,
        decision: column,
        startedOn: column,
        endedOn: column,
      })
      .strict(),
    sourceUrl: z.string().max(1000),
    title: z.string().max(120),
    type: z.string().max(60),
    wantToTry: z.boolean(),
    stage: z.enum(['edit', 'review']),
    skipped: z.array(z.number().int().min(1).max(101)).max(100),
    approvedDuplicates: z.array(z.number().int().min(1).max(101)).max(100),
    frozen: z.array(itemInput).min(1).max(100).nullable(),
  })
  .strict();
type CaptureDraft = z.infer<typeof captureDraft>;
const initial: CaptureDraft = {
  mode: 'csv',
  csv: '',
  delimiter: ',',
  mapping: emptyCsvMapping,
  sourceUrl: '',
  title: '',
  type: '',
  wantToTry: false,
  stage: 'edit',
  skipped: [],
  approvedDuplicates: [],
  frozen: null,
};
const labels: Record<keyof CsvMapping, string> = {
  title: 'Name',
  type: 'Type',
  note: 'Note',
  sourceUrl: 'Source URL',
  decision: 'Personal call',
  startedOn: 'Start date',
  endedOn: 'End date',
};

export function ReviewedCapture({ list, items }: { list: ListDetail; items: Item[] }) {
  const client = useQueryClient();
  const draft = useDraft<CaptureDraft>(
    `reviewed-capture:${list.id}`,
    initial,
    (value): value is CaptureDraft => captureDraft.safeParse(value).success,
  );
  const { form, setForm } = draft;
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [reset, setReset] = useState(false);
  const [reading, setReading] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const parsed = useMemo(() => {
    if (form.mode !== 'csv' || !form.csv) return { table: null, error: '' };
    try {
      return { table: readCsv(form.csv, form.delimiter), error: '' };
    } catch (failure) {
      return { table: null, error: failure instanceof Error ? failure.message : 'Could not read this CSV.' };
    }
  }, [form.csv, form.delimiter, form.mode]);
  const reviewed = useMemo((): { rows: CaptureReview[]; error: string } => {
    if (form.stage !== 'review') return { rows: [], error: '' };
    if (form.frozen)
      return {
        rows: form.frozen.map((item, index) => ({ item, row: index + 1, duplicate: false })),
        error: '',
      };
    try {
      if (form.mode === 'csv') {
        if (!parsed.table) throw new Error(parsed.error || 'Add CSV data first.');
        return { rows: reviewCsv(parsed.table, form.mapping, items, form.wantToTry), error: '' };
      }
      const link = suggestLink(form.sourceUrl);
      const item = itemInput.parse({
        title: form.title,
        type: form.type,
        wantToTry: form.wantToTry,
        context: { ...emptyItemContext, sourceUrl: link.sourceUrl },
      });
      return {
        rows: [
          {
            row: 1,
            item,
            duplicate: items.some((existing) => duplicateIdentity(existing) === duplicateIdentity(item)),
          },
        ],
        error: '',
      };
    } catch (failure) {
      return {
        rows: [],
        error:
          failure instanceof z.ZodError
            ? captureIssueText(failure.issues)
            : failure instanceof Error
              ? failure.message
              : 'Review the capture fields.',
      };
    }
  }, [form, items, parsed]);
  const selected =
    form.frozen ??
    reviewed.rows
      .filter(
        (row) =>
          row.item &&
          !form.skipped.includes(row.row) &&
          (!row.duplicate || form.approvedDuplicates.includes(row.row)),
      )
      .map((row) => row.item!);
  const save = useMutation({
    mutationFn: (records: ReviewedItem[]) => api.importItems(list.id, records, draft.operationId.current),
    onSuccess: (saved) => {
      const next = { ...initial, mode: form.mode };
      draft.clear(next);
      setForm(next);
      draft.operationId.current = crypto.randomUUID();
      setStatus(
        `${saved.items.length} ${saved.items.length === 1 ? 'record saved' : 'records saved'} to ${list.name}.`,
      );
      setError('');
    },
    onSettled: () => {
      for (const key of [['items', list.id], ['list', list.id], ['lists'], ['overview'], ['patterns']])
        void client.invalidateQueries({ queryKey: key });
    },
  });
  const failureMessage = error || (save.isError ? save.error.message : '');
  useEffect(() => {
    if (failureMessage) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [failureMessage]);
  function edit(patch: Partial<CaptureDraft>) {
    setForm((current) => ({ ...current, ...patch, stage: 'edit', skipped: [], approvedDuplicates: [] }));
    setError('');
    setStatus('');
    save.reset();
  }
  function preview() {
    setError('');
    setStatus('');
    save.reset();
    try {
      let rows: CaptureReview[];
      if (form.mode === 'csv') {
        if (!parsed.table) throw new Error(parsed.error || 'Add CSV data first.');
        rows = reviewCsv(parsed.table, form.mapping, items, form.wantToTry);
      } else {
        const link = suggestLink(form.sourceUrl);
        const item = itemInput.parse({
          title: form.title,
          type: form.type,
          wantToTry: form.wantToTry,
          context: { ...emptyItemContext, sourceUrl: link.sourceUrl },
        });
        rows = [
          {
            row: 1,
            item,
            duplicate: items.some((existing) => duplicateIdentity(existing) === duplicateIdentity(item)),
          },
        ];
      }
      setForm({
        ...form,
        stage: 'review',
        approvedDuplicates: [],
        skipped: rows.filter((row) => !row.item || row.duplicate).map((row) => row.row),
      });
    } catch (failure) {
      setError(
        failure instanceof z.ZodError
          ? captureIssueText(failure.issues)
          : failure instanceof Error
            ? failure.message
            : 'Review the fields.',
      );
    }
  }
  return (
    <section className="workbench-section reviewed-capture" aria-label="Reviewed capture">
      <p>
        Bring names in from a CSV or a source link. Review the exact records before saving them to {list.name}
        . New records stay unranked.
      </p>
      <fieldset
        className="capture-kind"
        disabled={reading || save.isPending || !!form.frozen || form.stage === 'review'}
      >
        <legend>Capture from</legend>
        {(['csv', 'link'] as const).map((mode) => (
          <label key={mode} className="workbench-check">
            <input
              type="radio"
              name={`capture-kind-${list.id}`}
              checked={form.mode === mode}
              onChange={() => edit({ mode })}
            />
            {mode === 'csv' ? 'CSV file' : 'A link'}
          </label>
        ))}
      </fieldset>
      {form.stage === 'edit' && (
        <>
          {form.mode === 'csv' ? (
            <fieldset className="capture-inputs" disabled={reading || save.isPending}>
              <legend>CSV data</legend>
              <p>
                Up to 100 records and 256 KB, with a header row. Quoted commas and multi-line notes are
                supported. Dates must use <span className="capture-date-format">YYYY-MM-DD</span>. No ranking
                is imported.
              </p>
              <label>
                Choose a CSV file
                <input
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    if (file.size > 256 * 1024) {
                      setError('Choose a file up to 256 KB.');
                      return;
                    }
                    setReading(true);
                    try {
                      const csv = await file.text();
                      edit({ csv, mapping: emptyCsvMapping });
                      const table = readCsv(csv, form.delimiter);
                      setForm((current) => ({ ...current, mapping: suggestCsvMapping(table.headers) }));
                    } catch (failure) {
                      setError(failure instanceof Error ? failure.message : 'Could not open this file.');
                    } finally {
                      setReading(false);
                    }
                  }}
                />
              </label>
              <label>
                Separator
                <select
                  value={form.delimiter}
                  onChange={(event) =>
                    edit({
                      delimiter: event.target.value as CaptureDraft['delimiter'],
                      mapping: emptyCsvMapping,
                    })
                  }
                >
                  <option value=",">Comma</option>
                  <option value=";">Semicolon</option>
                  <option value={'\t'}>Tab</option>
                </select>
              </label>
              <label>
                Or paste CSV
                <textarea
                  rows={6}
                  maxLength={262144}
                  value={form.csv}
                  onChange={(event) => edit({ csv: event.target.value })}
                  placeholder={'Name,Type,Note\nCoffee,Drink,"A reliable one."'}
                />
              </label>
              {parsed.error && <p className="capture-hint">{parsed.error}</p>}
              {parsed.table && (
                <>
                  <p>{parsed.table.rows.length} records found. Review the column mapping.</p>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => edit({ mapping: suggestCsvMapping(parsed.table!.headers) })}
                  >
                    Suggest column mapping
                  </button>
                  <div className="capture-mapping">
                    {(Object.keys(labels) as (keyof CsvMapping)[]).map((key) => (
                      <label key={key}>
                        {labels[key]} column
                        <select
                          value={form.mapping[key]}
                          onChange={(event) =>
                            edit({ mapping: { ...form.mapping, [key]: Number(event.target.value) } })
                          }
                        >
                          <option value={-1}>
                            {key === 'title' ? 'Choose a name column' : 'Do not import'}
                          </option>
                          {parsed.table!.headers.map((header, index) => (
                            <option key={index} value={index}>
                              {index + 1}. {header}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          ) : (
            <fieldset className="capture-inputs" disabled={reading || save.isPending}>
              <legend>Source link</legend>
              <label>
                Source URL
                <input
                  type="url"
                  maxLength={1000}
                  value={form.sourceUrl}
                  onChange={(event) => edit({ sourceUrl: event.target.value })}
                  placeholder="https://example.com/a-good-find"
                />
              </label>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  try {
                    const link = suggestLink(form.sourceUrl);
                    edit(link);
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : 'Review the link.');
                  }
                }}
              >
                Suggest a name from the address
              </button>
              <p>
                The suggestion uses only the address. Worth does not open the link or verify its name. Review
                or replace the name below.
              </p>
              <label>
                Name
                <input
                  value={form.title}
                  maxLength={120}
                  onChange={(event) => edit({ title: event.target.value })}
                />
              </label>
              <label>
                Type
                <input
                  value={form.type}
                  maxLength={60}
                  onChange={(event) => edit({ type: event.target.value })}
                />
              </label>
            </fieldset>
          )}
          <label className="workbench-check">
            <input
              type="checkbox"
              disabled={reading}
              checked={form.wantToTry}
              onChange={(event) => edit({ wantToTry: event.target.checked })}
            />
            Save to Want to try
          </label>
          <button className="button button-accent" disabled={reading} onClick={preview}>
            Preview records
          </button>
        </>
      )}
      <p className="draft-status" role="status">
        {draft.status || 'Capture drafts can recover on this device for seven days.'}
      </p>
      {form.stage === 'review' && (
        <section className="capture-review" aria-label="Records to save">
          <h3>Review for {list.name}</h3>
          <p>
            {form.frozen ? (
              `${selected.length} ${selected.length === 1 ? 'record' : 'records'} in this request. Retry saves this same selection.`
            ) : (
              <>
                {selected.length} selected. Possible duplicates match names and types in this file or
                collection. They start unselected; choose them explicitly to keep both. Existing records are
                never changed.
              </>
            )}
          </p>
          {reviewed.error && <p role="alert">{reviewed.error}</p>}
          <fieldset disabled={save.isPending || !!form.frozen}>
            <legend>Choose records</legend>
            <ul>
              {reviewed.rows.map((row) => (
                <li key={row.row}>
                  <label className="workbench-check">
                    <input
                      type="checkbox"
                      disabled={!row.item}
                      checked={
                        !!row.item &&
                        !form.skipped.includes(row.row) &&
                        (!row.duplicate || form.approvedDuplicates.includes(row.row))
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          skipped: event.target.checked
                            ? form.skipped.filter((value) => value !== row.row)
                            : [...form.skipped, row.row],
                          approvedDuplicates:
                            event.target.checked && row.duplicate
                              ? [...form.approvedDuplicates.filter((value) => value !== row.row), row.row]
                              : form.approvedDuplicates.filter((value) => value !== row.row),
                        })
                      }
                    />
                    {row.item ? `Keep row ${row.row}: ${row.item.title}` : `Row ${row.row}`}
                  </label>
                  {row.error && <p className="form-error">{row.error}</p>}
                  {row.duplicate && (
                    <p className="capture-duplicate">Possible duplicate · choose this row to keep both.</p>
                  )}
                  {row.item && <RecordPreview item={row.item} />}
                </li>
              ))}
            </ul>
          </fieldset>
          {form.frozen && !save.isPending && (
            <p role="status">
              This selection is locked for retry. Check the collection before starting a new capture.
            </p>
          )}
          <div className="data-actions">
            <button
              className="button button-accent"
              disabled={!selected.length || save.isPending || !!reviewed.error}
              onClick={() => {
                const records = form.frozen ?? selected;
                if (!form.frozen) draft.checkpoint({ ...form, frozen: records, skipped: [] });
                save.mutate(records);
              }}
            >
              {save.isPending
                ? 'Saving…'
                : form.frozen
                  ? 'Retry saving these records'
                  : `Save ${selected.length} ${selected.length === 1 ? 'record' : 'records'}`}
            </button>
            {!form.frozen ? (
              <button
                className="button button-outline"
                disabled={save.isPending}
                onClick={() => setForm({ ...form, stage: 'edit' })}
              >
                Edit input
              </button>
            ) : (
              <button
                className="button button-outline"
                disabled={save.isPending}
                onClick={() => setReset(true)}
              >
                Start over
              </button>
            )}
          </div>
        </section>
      )}
      {failureMessage && (
        <p ref={errorRef} className="form-error" role="alert">
          {failureMessage}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {reset && (
        <ConfirmDialog
          title="Start a new capture?"
          description="A request that timed out may already be saved. Check the collection first. Starting over allows a new save and can create duplicates if the previous request succeeded."
          confirmLabel="Start new capture"
          onClose={() => setReset(false)}
          onConfirm={() => {
            draft.clear(initial);
            setForm(initial);
            draft.operationId.current = crypto.randomUUID();
            setReset(false);
            save.reset();
            setError('');
            setStatus('');
          }}
        />
      )}
    </section>
  );
}
function RecordPreview({ item }: { item: ReviewedItem }) {
  return (
    <div className="capture-record-preview">
      <p>
        {item.type || 'No type'} · {decisionLabel(item.decision) || 'No call'} · Unranked
        {item.wantToTry ? ' · Want to try' : ''}
      </p>
      {(item.startedOn || item.endedOn) && (
        <p>
          {item.startedOn || 'No start date'} → {item.endedOn || 'No end date'}
        </p>
      )}
      {item.context.sourceUrl && <p className="capture-source">Source: {item.context.sourceUrl}</p>}
      {item.note && (
        <details>
          <summary>Note</summary>
          <p className="capture-note">{item.note}</p>
        </details>
      )}
    </div>
  );
}
