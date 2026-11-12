import { useState } from 'react';
import { Link } from 'react-router';
import type { InboxEntry } from '../shared/inbox';
import type { Item, ListSummary } from '../shared/models';
import { InlineCollectionCreate } from './InlineCollectionCreate';
import { recordHref } from '../shared/record-links';

export function InboxFileActions({
  entry,
  collections,
  disabled,
  checking,
  error,
  duplicate,
  onFile,
  onCancelDuplicate,
  onFileSeparate,
  onBusyChange,
}: {
  entry: InboxEntry;
  collections: ListSummary[];
  disabled: boolean;
  checking: boolean;
  error: string;
  duplicate: { item: Item; target: ListSummary } | null;
  onFile: (target: ListSummary) => void;
  onCancelDuplicate: () => void;
  onFileSeparate: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [creating, setCreating] = useState(false);
  // Related names are suggestions only; filing always requires choosing a destination.
  const key = entry.type.trim().toLocaleLowerCase();
  const suggested = [...collections]
    .sort(
      (a, b) =>
        Number(!!key && b.name.toLocaleLowerCase().includes(key)) -
        Number(!!key && a.name.toLocaleLowerCase().includes(key)),
    )
    .slice(0, 3);
  return (
    <div className="inbox-row-filing" role="group" aria-label={`File ${entry.title}`}>
      <div className="inbox-filing-choices">
        <span>File in</span>
        {suggested.map((list) => (
          <button type="button" key={list.id} disabled={disabled || creating} onClick={() => onFile(list)}>
            {list.name}
          </button>
        ))}
        {collections.length > 3 && (
          <label className="inbox-filing-more">
            <span className="sr-only">File {entry.title} in another collection</span>
            <select
              value=""
              disabled={disabled || creating}
              onChange={(event) => {
                const list = collections.find((value) => value.id === event.target.value);
                if (list) onFile(list);
              }}
            >
              <option value="" disabled>
                More collections…
              </option>
              {collections.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!creating && (
          <InlineCollectionCreate
            lists={collections}
            open={false}
            onOpenChange={setCreating}
            onCreated={onFile}
            disabled={disabled}
          />
        )}
      </div>
      {creating && (
        <InlineCollectionCreate
          lists={collections}
          open
          onOpenChange={setCreating}
          onCreated={onFile}
          disabled={disabled}
          onBusyChange={onBusyChange}
          submitLabel="Create & file"
          existingLabel="File here"
        />
      )}
      {checking && (
        <p className="quick-entry-helper" role="status">
          Checking this collection…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error} Choose a collection to try again.
        </p>
      )}
      {duplicate && (
        <div className="inbox-filing-duplicate" role="status">
          <p>
            “{duplicate.item.title}” is already in {duplicate.target.name}.
          </p>
          <div className="data-actions">
            <Link to={recordHref(duplicate.item.listId, 'item', duplicate.item.id)}>Open existing item</Link>
            <button type="button" disabled={disabled} onClick={onFileSeparate}>
              File as a separate item
            </button>
            <button type="button" disabled={disabled} onClick={onCancelDuplicate}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
