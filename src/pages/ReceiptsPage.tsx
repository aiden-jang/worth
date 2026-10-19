import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import '../receipts.css';
export function ReceiptsPage() {
  usePageTitle('Receipts');
  const query = useQuery({ queryKey: ['receipts'], queryFn: api.receipts }),
    [filter, setFilter] = useState(''),
    [limit, setLimit] = useState(25);
  const rows = (query.data?.receipts ?? []).filter((r) =>
    `${r.name} ${r.merchant}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );
  return (
    <main className="light-page page-width receipts-page">
      <header className="page-head">
        <div>
          <p className="overline">PRIVATE REVIEWED COPIES</p>
          <h1>Receipts</h1>
          <p>Keep the useful bits.</p>
        </div>
        <Link to="/capture">Back to capture →</Link>
      </header>
      <p>
        Saved receipts keep the words you reviewed and the record choices you made. Existing records are never
        edited by a receipt. Photos are attached only after explicit review. Keep up to 100 receipts.
      </p>
      <Link className="button button-accent" to="/receipts/new">
        Review a receipt
      </Link>
      <label>
        Find a receipt
        <input
          value={filter}
          maxLength={120}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(25);
          }}
        />
      </label>
      {query.isPending && <p role="status">Opening your receipts…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry receipts
          </button>
        </p>
      )}
      {query.data && !rows.length && (
        <section className="receipt-empty">
          <svg viewBox="0 0 120 110" aria-hidden="true">
            <path d="M25 10h70v90l-10-5-10 5-10-5-10 5-10-5-10 5-10-5z" fill="#eae5d5" />
            <path d="M40 32h40M40 45h25M40 58h40M40 78h12" stroke="#626456" strokeWidth="3" />
          </svg>
          <h2>{query.data.receipts.length ? 'No receipts match.' : 'Nothing to squint at yet.'}</h2>
          <p>
            {query.data.receipts.length
              ? 'Try another name or merchant.'
              : 'Paste receipt text, type a line or read a photo on this device.'}
          </p>
        </section>
      )}
      <ul className="receipt-directory">
        {rows.slice(0, limit).map((r) => (
          <li key={r.id}>
            <Link to={`/receipts/${r.id}`}>
              <span className="overline">{r.day || 'DATE NOT ENTERED'}</span>
              <h2>{r.name}</h2>
              <p>
                {r.merchant || 'Merchant not entered'} · {r.lineCount} {r.lineCount === 1 ? 'line' : 'lines'}
              </p>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button className="button button-outline" onClick={() => setLimit(limit + 25)}>
          Show more receipts
        </button>
      )}
    </main>
  );
}
export function ReceiptPage() {
  const id = useParams().id ?? '',
    query = useQuery({
      queryKey: ['receipt', id],
      queryFn: () => api.receipt(id),
    }),
    receipt = query.data?.receipt,
    navigate = useNavigate(),
    client = useQueryClient(),
    [confirm, setConfirm] = useState(false),
    [failed, setFailed] = useState(''),
    [retry, setRetry] = useState(0);
  usePageTitle(receipt?.name ?? 'Receipt');
  const remove = useMutation({
    mutationFn: () => api.removeReceipt(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['receipts'] });
      navigate('/receipts', { replace: true });
    },
  });
  const sources = new Map(receipt?.sources.map((s) => [s.id, s]));
  const image = `/api/receipts/${id}/attachment?retry=${retry}`;
  return (
    <main className="light-page page-width receipt-page">
      <header className="page-head">
        <div>
          <p className="overline">PRIVATE REVIEWED RECEIPT</p>
          <h1>{receipt?.name ?? 'Receipt'}</h1>
        </div>
        <Link to="/receipts">Back to Receipts →</Link>
      </header>
      {query.isPending && <p role="status">Opening this receipt…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}
          <button className="button button-outline" onClick={() => void query.refetch()}>
            Retry receipt
          </button>
        </p>
      )}
      {receipt && !query.isError && (
        <>
          <p>
            {receipt.merchant || 'Merchant not entered'} · {receipt.day || 'Date not entered'}
          </p>
          <p>
            This is the fixed review you saved. Linked record names are current. Receipt removal leaves linked
            and created records intact.
          </p>
          <button className="button button-outline" onClick={() => setConfirm(true)}>
            Remove receipt
          </button>
          {receipt.note && <p className="receipt-note">{receipt.note}</p>}
          {receipt.attachment?.available ? (
            <section className="receipt-attachment" aria-label="Saved receipt attachment">
              {failed !== image ? (
                <>
                  <a href={`/api/receipts/${id}/attachment`} target="_blank" rel="noreferrer">
                    Open saved attachment at full size →
                  </a>
                  <img
                    key={retry}
                    src={image}
                    alt={`Reviewed attachment for ${receipt.name}`}
                    onError={() => setFailed(image)}
                  />
                </>
              ) : (
                <p role="alert">
                  The attachment could not be displayed. Receipt text remains below.
                  <button
                    className="button button-outline"
                    onClick={() => {
                      setRetry((v) => v + 1);
                      setFailed('');
                    }}
                  >
                    Retry attachment
                  </button>
                </p>
              )}
            </section>
          ) : (
            receipt.attachment && (
              <p>No image bytes came with this records-only restore. Your receipt text remains available.</p>
            )
          )}
          <details className="receipt-original-text">
            <summary>Reviewed text kept with this receipt</summary>
            <p>{receipt.text || 'No text entered.'}</p>
          </details>
          <ol className="receipt-saved-lines" aria-label="Reviewed receipt lines">
            {receipt.lines.map((line, index) => {
              const source = line.mapping.mode === 'none' ? undefined : sources.get(line.mapping.itemId);
              return (
                <li key={line.id}>
                  <p className="overline">LINE {index + 1}</p>
                  <h2>{line.label}</h2>
                  {line.amount && <p>Amount as entered: {line.amount}</p>}
                  {line.note && <p className="receipt-note">{line.note}</p>}
                  {line.createdName && line.createdName !== source?.title && (
                    <p>Created record name in this review: {line.createdName}</p>
                  )}
                  {source ? (
                    <Link to={`/lists/${source.listId}?focus=item:${source.id}`}>
                      Open {line.createdHere || line.mapping.mode === 'create' ? 'created' : 'linked'} record:{' '}
                      {source.title}
                      {source.archived ? ' · Archived' : ''} →
                    </Link>
                  ) : line.mapping.mode !== 'none' || line.referenceMissing ? (
                    <p>Linked record unavailable. Your reviewed line, amount and note are kept.</p>
                  ) : (
                    <p>Unlinked. No record was created for this line.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {confirm && (
        <ConfirmDialog
          className="receipt-confirm"
          title={`Remove ${receipt?.name ?? 'this receipt'}?`}
          description="Permanently removes this receipt and its attachment only. Linked and created records stay. This cannot be undone."
          confirmLabel="Remove receipt"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onClose={() => setConfirm(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </main>
  );
}
