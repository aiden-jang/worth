import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import { missingFieldNames, readFieldNames } from '../shared/collection-fields';
import type { ItemContext } from '../shared/item-context';

export function FieldNamesInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const parsed = readFieldNames(value);
  return (
    <>
      <label>
        Reusable detail names
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={1000}
          rows={4}
          disabled={disabled}
          placeholder={'Roaster\nOrigin\nBrew method'}
        />
      </label>
      <p>One per line. Up to 12 unique names, 40 characters each. Every detail stays optional.</p>
      {!parsed.success && (
        <p className="form-error" role="alert">
          {parsed.error.issues[0].message}
        </p>
      )}
    </>
  );
}

export function SuggestedDetails({
  listId,
  fields,
  onChange,
}: {
  listId: string;
  fields: ItemContext['fields'];
  onChange: (fields: ItemContext['fields']) => void;
}) {
  const [opened, setOpened] = useState(false);
  const query = useQuery({
    queryKey: ['workspace', listId],
    queryFn: () => api.workspace(listId),
    enabled: opened,
  });
  const missing = missingFieldNames(query.data?.workspace.detailFields ?? [], fields);
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>Detail names from this collection</summary>
      <p>Add blank fields to this draft. Existing detail names and values stay as they are.</p>
      {query.isPending && <p role="status">Loading detail names…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}{' '}
          <button type="button" className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {query.data && (
        <>
          {!query.data.workspace.detailFields?.length && (
            <p>No reusable names yet. Set them up in Workbench → Collection setup.</p>
          )}
          {!!query.data.workspace.detailFields?.length && !missing.length && (
            <p>All saved detail names are already in this draft.</p>
          )}
          {!!missing.length && (
            <div className="data-actions">
              <button
                type="button"
                className="button button-outline"
                disabled={fields.length + missing.length > 12}
                onClick={() => onChange([...fields, ...missing.map((name) => ({ name, value: '' }))])}
              >
                Add all missing details
              </button>
              {missing.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="button button-outline"
                  disabled={fields.length >= 12}
                  onClick={() => onChange([...fields, { name, value: '' }])}
                >
                  Add {name}
                </button>
              ))}
            </div>
          )}
          {fields.length + missing.length > 12 && (
            <p>
              This draft has room for {12 - fields.length} more details. Add individual names or remove a
              field first.
            </p>
          )}
        </>
      )}
    </details>
  );
}
