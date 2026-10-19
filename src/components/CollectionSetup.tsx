import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useWorkspace } from '../hooks/useWorkspace';
import { readFieldNames } from '../shared/collection-fields';
import type { ListDetail } from '../shared/models';
import { collectionTemplate, type CollectionTemplate } from '../shared/templates';
import type { WorkspaceResponse } from '../shared/workspace';
import { FieldNamesInput } from './CollectionFields';
import { ConfirmDialog } from './ConfirmDialog';
import { TemplatePreview } from './CollectionTemplates';
import '../templates.css';

const fieldDraft = z
  .object({ text: z.string().max(1000), revision: z.number().int().nonnegative() })
  .strict();
const templateDraft = z.object({ name: z.string().max(80), pending: collectionTemplate.nullable() }).strict();

export function CollectionSetup({ list }: { list: ListDetail }) {
  const { query } = useWorkspace(list.id);
  if (query.isPending) return <p role="status">Loading collection setup…</p>;
  if (query.isError)
    return (
      <p role="alert">
        {query.error.message}{' '}
        <button className="button button-outline" onClick={() => void query.refetch()}>
          Try again
        </button>
      </p>
    );
  return (
    <SetupEditor
      list={list}
      data={query.data}
      refreshing={query.isFetching}
      onRefresh={() => void query.refetch()}
    />
  );
}

function SetupEditor({
  list,
  data,
  refreshing,
  onRefresh,
}: {
  list: ListDetail;
  data: WorkspaceResponse;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const client = useQueryClient();
  const fields = useDraft(
    `collection-fields:${list.id}`,
    { text: (data.workspace.detailFields ?? []).join('\n'), revision: data.revision },
    (value): value is z.infer<typeof fieldDraft> => fieldDraft.safeParse(value).success,
  );
  const template = useDraft(
    `collection-template:${list.id}`,
    { name: '', pending: null } as z.infer<typeof templateDraft>,
    (value): value is z.infer<typeof templateDraft> => templateDraft.safeParse(value).success,
  );
  const parsed = readFieldNames(fields.form.text);
  const changed =
    !parsed.success || JSON.stringify(parsed.data) !== JSON.stringify(data.workspace.detailFields ?? []);
  const stale = fields.form.revision !== data.revision;
  const [reload, setReload] = useState(false),
    [discardRetry, setDiscardRetry] = useState(false);
  const [status, setStatus] = useState('');
  const save = useMutation({
    mutationFn: () => {
      if (!parsed.success) throw new Error('Check the detail names.');
      return api.updateWorkspace(
        list.id,
        { ...data.workspace, detailFields: parsed.data },
        fields.form.revision,
      );
    },
    onSuccess: (saved) => {
      client.setQueryData(['workspace', list.id], saved);
      const next = { text: (saved.workspace.detailFields ?? []).join('\n'), revision: saved.revision };
      fields.clear(next);
      fields.setForm(next);
      setStatus('Reusable detail names saved.');
    },
    onError: onRefresh,
  });
  const create = useMutation({
    mutationFn: (pending: CollectionTemplate) => api.createTemplate(pending),
    onSuccess: async ({ template: saved }) => {
      const next = { name: '', pending: null };
      template.clear(next);
      template.setForm(next);
      setStatus(`Template “${saved.name}” saved. Choose it when creating a new collection.`);
      await client.invalidateQueries({ queryKey: ['collection-templates'] });
    },
  });
  const preview: CollectionTemplate = template.form.pending ?? {
    id: '00000000-0000-4000-8000-000000000000',
    name: template.form.name.trim(),
    collectionName: list.name,
    description: list.description,
    artwork: list.artwork ?? null,
    detailFields: data.workspace.detailFields ?? [],
  };
  function submitTemplate() {
    const pending = template.form.pending ?? { ...preview, id: crypto.randomUUID() };
    template.checkpoint({ ...template.form, pending });
    create.mutate(pending);
  }
  return (
    <section className="workbench-section collection-setup" aria-label="Collection setup">
      <h3>Reusable details</h3>
      <p>
        Save names you often use in this collection, such as roaster or edition. Add them explicitly from an
        item’s Custom details. Existing records are never changed.
      </p>
      <FieldNamesInput
        value={fields.form.text}
        disabled={save.isPending}
        onChange={(text) => {
          fields.setForm({ ...fields.form, text });
          save.reset();
          setStatus('');
        }}
      />
      {fields.status && (
        <p className="draft-status" role="status">
          {fields.status}
        </p>
      )}
      {stale && (
        <p className="error-banner" role="alert">
          Saved tools changed elsewhere. Your draft is still here. Reload before saving.
        </p>
      )}
      <div className="data-actions">
        <button
          className="button button-accent"
          disabled={save.isPending || refreshing || stale || !changed || !parsed.success}
          onClick={() => save.mutate()}
        >
          Save detail names
        </button>
        <button
          className="button button-outline"
          disabled={save.isPending || refreshing}
          onClick={() => {
            setReload(true);
            onRefresh();
          }}
        >
          Reload saved detail names
        </button>
      </div>
      {save.isError && (
        <p className="form-error" role="alert">
          {save.error.message}
        </p>
      )}
      <hr />
      <h3>Keep this setup</h3>
      <p>
        Save a private template for new collections. It includes only the collection name, description,
        authored artwork and saved detail names. Photos, records, notes, ranks and shelf keepsakes are
        excluded. Keep up to 50 templates.
      </p>
      <label>
        Template name
        <input
          maxLength={80}
          value={template.form.name}
          disabled={create.isPending || !!template.form.pending}
          onChange={(event) => template.setForm({ ...template.form, name: event.target.value })}
          placeholder="Coffee tasting setup"
        />
      </label>
      <TemplatePreview template={preview} />
      {changed && !template.form.pending && (
        <p>Save or reload your detail-name draft before creating a template.</p>
      )}
      {template.form.pending && (
        <p>
          A save request is waiting for confirmation. Retry the same setup safely; its preview is held until
          the result is known.
        </p>
      )}
      {template.status && (
        <p className="draft-status" role="status">
          {template.status}
        </p>
      )}
      <div className="data-actions">
        <button
          className="button button-outline"
          disabled={
            create.isPending ||
            (!template.form.pending && (changed || stale || refreshing || !template.form.name.trim()))
          }
          onClick={submitTemplate}
        >
          {template.form.pending ? 'Retry template save' : 'Save setup as template'}
        </button>
        {template.form.pending && (
          <button
            className="button button-outline"
            disabled={create.isPending}
            onClick={() => setDiscardRetry(true)}
          >
            Discard template retry
          </button>
        )}
      </div>
      {create.isError && (
        <p className="form-error" role="alert">
          {create.error.message}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {reload && (
        <ConfirmDialog
          pending={refreshing}
          title="Replace this detail-name draft?"
          description="Reloads the current saved detail names and discards this draft. Other collection tools stay unchanged."
          confirmLabel="Reload detail names"
          onClose={() => setReload(false)}
          onConfirm={() => {
            const next = { text: (data.workspace.detailFields ?? []).join('\n'), revision: data.revision };
            fields.clear(next);
            fields.setForm(next);
            save.reset();
            setReload(false);
            onRefresh();
          }}
        />
      )}
      {discardRetry && (
        <ConfirmDialog
          title="Discard this template retry?"
          description="The request may already have saved. Check saved templates before creating another copy. This only clears the local retry draft."
          confirmLabel="Discard retry"
          onClose={() => setDiscardRetry(false)}
          onConfirm={() => {
            const next = { name: template.form.name, pending: null };
            template.clear(next);
            template.setForm(next);
            create.reset();
            setDiscardRetry(false);
          }}
        />
      )}
    </section>
  );
}
