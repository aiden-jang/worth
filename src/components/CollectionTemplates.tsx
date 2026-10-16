import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api';
import type { CollectionTemplate } from '../shared/templates';
import { ConfirmDialog } from './ConfirmDialog';
import { CollectionArtwork } from './CollectionArtwork';
import { starterCollectionCover } from '../shared/starter-covers';

export function TemplatePicker({
  onUse,
  disabled,
}: {
  onUse: (template: CollectionTemplate) => void;
  disabled: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState('');
  const [removing, setRemoving] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['collection-templates'], queryFn: api.templates, enabled: opened });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: async () => {
      setRemoving(false);
      setSelected('');
      await client.invalidateQueries({ queryKey: ['collection-templates'] });
    },
  });
  const template = query.data?.templates.find((entry) => entry.id === selected);
  return (
    <details
      className="collection-templates"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>
        Start from a template <span className="optional">optional</span>
      </summary>
      <p>
        Copy a saved name, description, artwork and reusable detail names into this draft. Records and private
        cover photos are never copied.
      </p>
      {query.isPending && <p role="status">Loading templates…</p>}
      {query.isError && (
        <p role="alert">
          {query.error.message}{' '}
          <button type="button" className="button button-outline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {query.data &&
        (!query.data.templates.length ? (
          <p>No saved templates. Save one from a collection’s Workbench → Collection setup.</p>
        ) : (
          <>
            <label>
              Saved template
              <select
                value={selected}
                disabled={disabled || remove.isPending}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Choose a template</option>
                {query.data.templates.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            {template && (
              <>
                <TemplatePreview template={template} />
                <div className="data-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={disabled || remove.isPending}
                    onClick={() => onUse(template)}
                  >
                    Use template
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={disabled || remove.isPending}
                    onClick={() => {
                      remove.reset();
                      setRemoving(true);
                    }}
                  >
                    Remove saved template
                  </button>
                </div>
              </>
            )}
          </>
        ))}
      {removing && template && (
        <ConfirmDialog
          title="Remove this template?"
          description={`Removes “${template.name}” from saved templates. Existing collections and this creation draft stay unchanged.`}
          confirmLabel="Remove template"
          pending={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate(template.id)}
          onClose={() => {
            if (!remove.isPending) setRemoving(false);
          }}
        />
      )}
    </details>
  );
}

export function TemplatePreview({ template }: { template: CollectionTemplate }) {
  return (
    <div className="template-preview">
      <CollectionArtwork
        name={template.collectionName}
        cover={starterCollectionCover(template.collectionName, template.artwork)}
      />
      <div>
        <p className="overline">SETUP PREVIEW</p>
        <h3>{template.collectionName}</h3>
        <p>{template.description || 'No description'}</p>
        <p>Detail names: {template.detailFields.join(' · ') || 'None'}</p>
        <p>New collections start empty, with no calls or ranks.</p>
      </div>
    </div>
  );
}
