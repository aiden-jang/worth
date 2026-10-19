import { useState } from 'react';
import type { ReceiptDraft } from '../shared/receipts';
import { ReceiptMapping } from './ReceiptMapping';
type Line = ReceiptDraft['current']['lines'][number];
export function ReceiptLineEditor({
  line,
  index,
  disabled,
  onPatch,
  onRemove,
}: {
  line: Line;
  index: number;
  disabled: boolean;
  onPatch: (patch: Partial<Omit<Line, 'id'>>) => void;
  onRemove: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(Boolean(line.note));
  return (
    <li>
      <h3>Line {index}</h3>
      <label>
        Text for line {index}
        <input
          disabled={disabled}
          maxLength={240}
          value={line.label}
          onChange={(event) => onPatch({ label: event.target.value })}
        />
      </label>
      <label>
        Amount as written for line {index} · optional
        <input
          disabled={disabled}
          maxLength={80}
          value={line.amount}
          onChange={(event) => onPatch({ amount: event.target.value })}
        />
      </label>
      <details
        className="receipt-line-details"
        open={notesOpen}
        onToggle={(event) => setNotesOpen(event.currentTarget.open)}
      >
        <summary>Note for line {index} · optional</summary>
        <textarea
          aria-label={`Note for line ${index} · optional`}
          disabled={disabled}
          maxLength={1000}
          value={line.note}
          onChange={(event) => onPatch({ note: event.target.value })}
        />
      </details>
      <ReceiptMapping
        index={index}
        value={line.mapping}
        disabled={disabled}
        onChange={(mapping) => onPatch({ mapping })}
      />
      <button className="button button-outline" disabled={disabled} onClick={onRemove}>
        Remove line {index}
      </button>
    </li>
  );
}
