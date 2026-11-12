import { DialogSaveFooter } from './DialogSaveFooter';
import { useModalDialog } from '../hooks/useModalDialog';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { X } from '@phosphor-icons/react';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useDraftPhoto } from '../hooks/useDraftPhoto';
import { preparePhoto } from '../shared/photos';
import { inboxPayload } from '../shared/inbox';
import { DraftPhoto } from './DraftPhoto';
import { useConnection } from '../hooks/useConnection';
import { today } from '../format';
import { itemInput, logInput } from '../shared/validation';
import { experienceInput } from '../shared/memories';
import {
  quickEntryDraft,
  emptyCaptureSource,
  type QuickEntryDraft,
  type QuickEntryPending,
  type SavedEntry,
} from '../shared/quick-entry';
import type { ListSummary } from '../shared/models';
import { CallChoices } from './PersonalCall';
import { ConfirmDialog } from './ConfirmDialog';
import { emptyItemContext } from '../shared/item-context';
import { hasItemDetails, itemIdentity } from '../shared/item-details';
import { ItemDetailsFields } from './ItemDetailsFields';
import { collectionDetailProfile } from '../shared/item-details';
import { InlineCollectionCreate } from './InlineCollectionCreate';
import { QuickCaptureTools } from './QuickCaptureTools';
import { applyCaptureSuggestion, matchingSavedItems, type CaptureSuggestion } from '../shared/capture-assist';
import { suggestLink } from '../shared/reviewed-capture';
import { recordHref } from '../shared/record-links';
import type { Item } from '../shared/models';

export function QuickEntry({
  lists,
  initialListId,
  initialTitle = '',
  onClose,
  onSaved,
}: {
  lists: ListSummary[];
  initialListId: string;
  initialTitle?: string;
  onClose: () => void;
  onSaved: (entry: SavedEntry) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    name = useRef<HTMLInputElement>(null);
  const online = useConnection(),
    client = useQueryClient();
  const initial: QuickEntryDraft = {
    listId: initialListId,
    title: initialTitle,
    type: '',
    context: emptyItemContext,
    itemId: null,
    note: '',
    decision: null,
    wantToTry: false,
    experienced: false,
    happenedOn: today(),
    pending: null,
  };
  const draft = useDraft<QuickEntryDraft>(
    'quick-entry',
    initial,
    (value): value is QuickEntryDraft => quickEntryDraft.safeParse(value).success,
  );
  const { form, setForm } = draft;
  const photo = useDraftPhoto('quick-entry');
  const [preparing, setPreparing] = useState(false);
  const [createdList, setCreatedList] = useState<ListSummary | null>(null);
  const destinations =
    createdList && !lists.some((list) => list.id === createdList.id) ? [...lists, createdList] : lists;
  const target = destinations.find((list) => list.id === form.listId && !list.archived);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureNotice, setCaptureNotice] = useState('');
  const activity = form.pending?.kind === 'activity' || target?.kind === 'activity';
  const collection = target?.kind === 'collection';
  const itemDetails = hasItemDetails(form.type, form.context);
  const hasCaptureContext =
    !!form.context && JSON.stringify(form.context) !== JSON.stringify(emptyItemContext);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(
      form.note || form.wantToTry || form.decision || form.experienced || itemDetails || hasCaptureContext,
    ),
  );
  const names = useQuery({
    queryKey: ['items', form.listId],
    queryFn: () => api.items(form.listId),
    enabled: collection,
  });
  const matchingNames = matchingSavedItems(names.data?.items ?? [], form.title);
  const duplicateBlocked = collection && !form.itemId && matchingNames.length > 0 && !form.keepSeparate;
  const ready = form.listId === 'inbox' || !!target;
  const [discard, setDiscard] = useState(false);
  const [switching, setSwitching] = useState<Partial<QuickEntryDraft> | null>(null);
  useEffect(() => {
    if (photo.file) setDetailsOpen(true);
  }, [photo.file]);
  const [validation, setValidation] = useState('');
  useModalDialog(dialog);
  useEffect(() => {
    name.current?.focus();
  }, []);
  const save = useMutation({
    mutationFn: async ({
      pending,
      file,
    }: {
      pending: QuickEntryPending;
      file: File | null;
    }): Promise<SavedEntry> => {
      async function attach(entry: SavedEntry, revision = 0) {
        draft.rememberSaved(entry.id);
        if (pending.photoKey && file) {
          if (entry.kind === 'inbox') await api.uploadInboxPhoto(entry.id, file, pending.photoKey, revision);
          else
            await api.uploadPhoto(entry.kind === 'item' ? 'items' : 'logs', entry.id, file, pending.photoKey);
        }
        return entry;
      }
      if (pending.kind === 'inbox') {
        const { entry } = await api.createInbox(pending.item, draft.operationId.current);
        return attach({ id: entry.id, title: entry.title, listId: null, kind: 'inbox' }, entry.revision);
      }
      if (pending.kind === 'item') {
        const { item } = await api.createItem(pending.listId, pending.item, draft.operationId.current);
        return attach({ id: item.id, title: item.title, listId: item.listId, kind: 'item' });
      }
      if (pending.kind === 'experience') {
        const { item, log } = await api.createExperience(
          pending.listId,
          pending.body,
          draft.operationId.current,
        );
        return attach({
          id: log.id,
          title: pending.body.title,
          listId: pending.listId,
          kind: 'log',
          // A new name and its first visit are one save; repeat visits undo only the visit.
          undoItemId: pending.body.itemId ? undefined : item.id,
        });
      }
      const { log } = await api.createLog(pending.listId, pending.body, draft.operationId.current);
      return attach({ id: log.id, title: log.title, listId: log.listId, kind: 'log' });
    },
    onSuccess: (entry) => {
      draft.clear();
      photo.clear();
      for (const key of ['inbox', 'items', 'logs', 'list', 'lists', 'overview', 'patterns', 'search'])
        void client.invalidateQueries({ queryKey: [key] });
      onSaved(entry);
      dialog.current?.close();
    },
  });
  const locked = preparing || save.isPending || !!form.pending || collectionBusy;
  function edit(patch: Partial<QuickEntryDraft>) {
    setForm({
      ...form,
      ...patch,
      ...(('title' in patch || 'listId' in patch) && !('keepSeparate' in patch)
        ? { keepSeparate: false }
        : {}),
    });
    setValidation('');
    setCaptureNotice('');
    save.reset();
  }
  function applySuggestion(suggestion: CaptureSuggestion) {
    try {
      setForm(applyCaptureSuggestion(form, suggestion));
      setValidation('');
      setCaptureNotice('Name added. Check it before saving.');
      setDetailsOpen(true);
      name.current?.focus();
      return true;
    } catch (cause) {
      setValidation(cause instanceof Error ? cause.message : 'Check the suggested details.');
      return false;
    }
  }
  function chooseExisting(item: Item) {
    const patch: Partial<QuickEntryDraft> = {
      itemId: item.id,
      title: item.title,
      type: '',
      context: emptyItemContext,
      experienced: true,
      wantToTry: false,
      decision: form.experienced ? form.decision : null,
    };
    setDetailsOpen(true);
    if (itemDetails || hasCaptureContext) setSwitching(patch);
    else edit(patch);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      preparing ||
      save.isPending ||
      collectionBusy ||
      creatingCollection ||
      captureBusy ||
      (!form.pending && (duplicateBlocked || (collection && names.isPending))) ||
      !photo.ready ||
      !online ||
      (!ready && !form.pending)
    )
      return;
    setPreparing(true);
    try {
      const quick = !detailsOpen && !form.pending;
      let pending: QuickEntryPending =
        form.pending ??
        (activity
          ? {
              kind: 'activity',
              listId: form.listId,
              body: logInput.parse({
                title: form.title,
                happenedOn: form.happenedOn,
                note: quick ? '' : form.note,
              }),
            }
          : !quick && collection && form.experienced
            ? {
                kind: 'experience',
                listId: form.listId,
                body: experienceInput.parse({
                  itemId: form.itemId ?? null,
                  title: form.title,
                  happenedOn: form.happenedOn,
                  note: form.note,
                  context: { reaction: form.decision },
                  type: form.type ?? '',
                  ...(!form.itemId && (itemDetails || hasCaptureContext)
                    ? { itemContext: form.context }
                    : {}),
                }),
              }
            : form.listId === 'inbox'
              ? {
                  kind: 'inbox',
                  item: inboxPayload.parse({
                    title: form.title,
                    type: quick ? '' : (form.type ?? ''),
                    context: quick ? emptyItemContext : form.context,
                    note: quick ? '' : form.note,
                    decision: quick || form.experienced ? null : form.decision,
                    wantToTry: !quick && form.wantToTry,
                    memory:
                      !quick && form.experienced
                        ? { happenedOn: form.happenedOn, reaction: form.decision }
                        : null,
                  }),
                }
              : {
                  kind: 'item',
                  listId: form.listId,
                  item: itemInput.parse({
                    title: form.title,
                    type: quick ? '' : (form.type ?? ''),
                    context: quick ? emptyItemContext : form.context,
                    note: quick ? '' : form.note,
                    decision: quick ? null : form.decision,
                    wantToTry: !quick && form.wantToTry,
                  }),
                });
      let file: File | null = null;
      if (pending.photoKey && (!photo.file || photo.operationId.current !== pending.photoKey))
        throw new Error(
          'This photo draft could not be recovered. Check the saved entry before clearing this draft and choosing another photo.',
        );
      if (photo.file && (!quick || pending.photoKey) && (!form.pending || pending.photoKey)) {
        const prepared = await photo.freeze(await preparePhoto(photo.file));
        file = prepared.file;
        pending = { ...pending, photoKey: prepared.key };
      }
      draft.checkpoint({
        ...form,
        ...(quick
          ? {
              type: '',
              context: emptyItemContext,
              note: '',
              decision: null,
              wantToTry: false,
              experienced: false,
            }
          : {}),
        pending,
      });
      save.mutate({ pending, file });
    } catch (error) {
      setValidation(
        error instanceof Error && !('issues' in error)
          ? error.message
          : error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues)
            ? String(error.issues[0]?.message ?? 'Check your details before saving.')
            : 'Check the name and details before saving.',
      );
      setDetailsOpen(true);
    } finally {
      setPreparing(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog quick-entry-dialog"
      aria-labelledby="quick-entry-title"
      onClose={(event) => {
        event.stopPropagation();
        if (!dialog.current?.open) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!save.isPending && !preparing) dialog.current?.close();
      }}
    >
      <div className="editor-inner">
        <header className="editor-head">
          <h2 id="quick-entry-title">Add item</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close Add"
            disabled={save.isPending || preparing}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </header>
        <form onSubmit={submit} className="editor-form quick-entry-form">
          <fieldset disabled={locked}>
            <label>
              Name
              <input
                ref={name}
                autoFocus
                required
                maxLength={120}
                value={form.title}
                placeholder={
                  collectionDetailProfile(target?.name ?? '') === 'place'
                    ? 'A restaurant, café, somewhere worth going…'
                    : target?.name.toLocaleLowerCase().includes('drink')
                      ? 'Coffee, wine, that very specific tea…'
                      : 'What did you try?'
                }
                onChange={(event) => edit({ title: event.target.value, itemId: null })}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData('text').trim();
                  const input = event.currentTarget;
                  if (
                    !activity &&
                    /^https?:\/\/\S+$/i.test(pasted) &&
                    (!input.value ||
                      (input.selectionStart === 0 && input.selectionEnd === input.value.length))
                  ) {
                    try {
                      const suggestion = suggestLink(pasted);
                      event.preventDefault();
                      applySuggestion(suggestion);
                    } catch {
                      /* Ordinary pasting remains available for invalid addresses. */
                    }
                  }
                }}
              />
            </label>
            {!activity && !form.itemId && (
              <QuickCaptureTools
                title={form.title}
                disabled={locked}
                onApply={applySuggestion}
                onBusyChange={setCaptureBusy}
                source={form.captureSource}
                onSourceChange={(patch) =>
                  setForm((current) => ({
                    ...current,
                    captureSource: { ...emptyCaptureSource, ...current.captureSource, ...patch },
                  }))
                }
              />
            )}
            {form.context?.sourceUrl && (
              <div className="quick-entry-source">
                <span>Source: {form.context.sourceUrl}</span>
                <button type="button" onClick={() => edit({ context: { ...form.context!, sourceUrl: '' } })}>
                  Remove link
                </button>
              </div>
            )}
            {captureNotice && (
              <p className="quick-entry-helper" role="status">
                {captureNotice}
              </p>
            )}
            {collection && !form.pending && (
              <div className="quick-entry-existing">
                {form.itemId ? (
                  <p>
                    Adding an experience to this saved item.{' '}
                    <button type="button" onClick={() => edit({ itemId: null, keepSeparate: true })}>
                      Use a new item instead
                    </button>
                  </p>
                ) : matchingNames.length > 0 ? (
                  <>
                    <p className="quick-entry-helper">Already saved in {target?.name}:</p>
                    {matchingNames.slice(0, 5).map((item) => (
                      <div className="quick-existing-match" key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{[item.type, itemIdentity(item)].filter(Boolean).join(' · ')}</small>
                        </div>
                        <Link
                          to={recordHref(item.listId, 'item', item.id)}
                          onClick={() => dialog.current?.close()}
                        >
                          Open item
                        </Link>
                        <button type="button" onClick={() => chooseExisting(item)}>
                          {form.experienced ? `Use saved ${item.title}` : 'Add another experience'}
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      aria-pressed={!!form.keepSeparate}
                      onClick={() => edit({ keepSeparate: !form.keepSeparate })}
                    >
                      {form.keepSeparate ? 'Saving as a separate item ✓' : 'Save as a separate item'}
                    </button>
                  </>
                ) : null}
                {names.isPending && form.title.trim() && (
                  <p className="quick-entry-helper" role="status">
                    Checking saved names…
                  </p>
                )}
                {names.isError && (
                  <p className="quick-entry-helper">
                    Saved names couldn’t load.{' '}
                    <button type="button" onClick={() => void names.refetch()}>
                      Try again
                    </button>
                    . You can still save a new item.
                  </p>
                )}
              </div>
            )}
            <label>
              Save in
              <select
                value={form.listId}
                onChange={(event) => {
                  const patch = {
                    listId: event.target.value,
                    itemId: null,
                    experienced:
                      form.experienced &&
                      (event.target.value === 'inbox' ||
                        lists.some((list) => list.id === event.target.value && list.kind === 'collection')),
                    decision: lists.some((list) => list.id === event.target.value && list.kind === 'activity')
                      ? null
                      : form.decision,
                    wantToTry: lists.some(
                      (list) => list.id === event.target.value && list.kind === 'activity',
                    )
                      ? false
                      : form.wantToTry,
                  };
                  if (
                    (itemDetails || hasCaptureContext) &&
                    lists.some((list) => list.id === event.target.value && list.kind === 'activity')
                  )
                    setSwitching({ ...patch, type: '', context: emptyItemContext });
                  else edit(patch);
                }}
              >
                <option value="inbox">Unfiled — choose a collection later</option>
                {!ready && <option value={form.listId}>Unavailable collection — choose another</option>}
                <optgroup label="Collections">
                  {destinations
                    .filter((list) => list.kind === 'collection' && !list.archived)
                    .map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Activity">
                  {destinations
                    .filter((list) => list.kind === 'activity' && !list.archived)
                    .map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} · activity entry
                      </option>
                    ))}
                </optgroup>
              </select>
            </label>
            <InlineCollectionCreate
              lists={destinations}
              open={creatingCollection}
              onOpenChange={setCreatingCollection}
              disabled={preparing || save.isPending || !!form.pending || !online}
              onBusyChange={setCollectionBusy}
              onCreated={(list) => {
                setCreatedList(list);
                setForm((current) => ({ ...current, listId: list.id, itemId: null, keepSeparate: false }));
                name.current?.focus();
              }}
            />
            {activity && target && (
              <p className="quick-entry-helper">
                One dated activity entry. For exercise sets,{' '}
                <Link to={`/lists/${target.id}`} onClick={() => dialog.current?.close()}>
                  open {target.name} →
                </Link>
              </p>
            )}
            <fieldset
              hidden={!detailsOpen}
              disabled={!detailsOpen}
              aria-label="Item details"
              className="quick-entry-details"
            >
              {!activity && !form.itemId && (
                <ItemDetailsFields
                  key={form.listId}
                  collectionName={target?.name}
                  type={form.type ?? ''}
                  context={form.context ?? emptyItemContext}
                  items={names.data?.items ?? []}
                  onChange={(type, context) => edit({ type, context })}
                />
              )}
              {!activity && (
                <>
                  {(collection || form.listId === 'inbox') && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.experienced}
                        onChange={(event) =>
                          edit({
                            experienced: event.target.checked,
                            wantToTry: false,
                            decision: null,
                            itemId: null,
                          })
                        }
                      />
                      Record a dated experience
                    </label>
                  )}
                  {form.experienced && (
                    <label>
                      When
                      <input
                        type="date"
                        required
                        value={form.happenedOn}
                        onChange={(event) => edit({ happenedOn: event.target.value })}
                      />
                    </label>
                  )}
                </>
              )}
              <label>
                Note <span className="optional">optional</span>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={form.note}
                  onChange={(event) => edit({ note: event.target.value })}
                />
              </label>
              {!activity && !form.experienced && (
                <label className="capture-for-later check-label">
                  <input
                    type="checkbox"
                    aria-label="Want to try"
                    checked={form.wantToTry}
                    onChange={(event) =>
                      edit(
                        event.target.checked
                          ? { wantToTry: true, parkedDecision: form.decision, decision: null }
                          : { wantToTry: false, decision: form.parkedDecision ?? null },
                      )
                    }
                  />{' '}
                  Want to try <span>Save for later. Rate it after.</span>
                </label>
              )}
              {!activity && form.wantToTry && (
                <p className="quick-entry-helper">Verdict pending. Very reasonable.</p>
              )}
              {!activity && !form.wantToTry && (
                <div className="quick-entry-call">
                  <p className="quick-entry-label">
                    {form.experienced ? 'This time' : 'Your call'} <span className="optional">optional</span>
                  </p>
                  <CallChoices
                    label={form.experienced ? 'This time' : 'Overall call'}
                    value={form.decision}
                    onChange={(decision) => edit({ decision })}
                  />
                  <p className="quick-entry-helper">
                    {form.decision === 'favorite'
                      ? 'A repeat appearance seems likely.'
                      : form.decision === 'meh'
                        ? 'An event occurred.'
                        : form.decision === 'would_not_again'
                          ? 'Research concluded.'
                          : 'No opinion is also an option.'}
                  </p>
                </div>
              )}
              <DraftPhoto file={photo.file} onChange={photo.change} disabled={locked || !photo.ready} />
              {photo.status && (
                <p role="status" className="draft-state">
                  {photo.status}
                </p>
              )}
            </fieldset>
            {activity && (
              <label>
                When
                <input
                  type="date"
                  required
                  value={form.happenedOn}
                  onChange={(event) => edit({ happenedOn: event.target.value })}
                />
              </label>
            )}
          </fieldset>
          {form.pending && (
            <p className="quick-entry-helper">
              This save is waiting for confirmation. Retry to check the same entry.
            </p>
          )}

          {(draft.status.includes('restored') || draft.status.includes('could not')) && (
            <p role="status" className="draft-state">
              {draft.status}
            </p>
          )}
          <DialogSaveFooter>
            {!online && (
              <p role="status">You’re offline. Your draft stays on this device. Reconnect to save.</p>
            )}
            {(save.isError || validation) && (
              <p role="alert" className="form-error">
                {save.error?.message ?? validation}
              </p>
            )}
            <button
              className="button button-accent quick-entry-save"
              disabled={
                !online ||
                preparing ||
                !photo.ready ||
                save.isPending ||
                collectionBusy ||
                creatingCollection ||
                captureBusy ||
                (!form.pending && (duplicateBlocked || (collection && names.isPending))) ||
                (!ready && !form.pending)
              }
            >
              {preparing
                ? 'Preparing photo…'
                : save.isPending
                  ? 'Saving…'
                  : form.pending
                    ? 'Retry save'
                    : detailsOpen
                      ? activity
                        ? 'Save entry'
                        : 'Save item'
                      : 'Quick save'}
            </button>
            {!form.pending && (
              <button
                type="button"
                className="button button-outline"
                disabled={locked || creatingCollection || captureBusy}
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                {detailsOpen ? (activity ? 'Name and date' : 'Name only') : 'Save with details'}
              </button>
            )}
          </DialogSaveFooter>
        </form>
        <p className="quick-entry-helper">
          {activity
            ? 'Quick save keeps the name and date. You can add details later.'
            : 'Quick save keeps only the name. You can add details later.'}
        </p>
        {(form.title || form.pending) && (
          <button
            type="button"
            className="quick-entry-discard"
            disabled={save.isPending}
            onClick={() => setDiscard(true)}
          >
            Clear draft
          </button>
        )}
      </div>
      {discard && (
        <ConfirmDialog
          title="Clear this draft?"
          description={
            form.pending
              ? 'The save may already have completed. Check your saved entries before starting a new copy. This clears only the draft on this device.'
              : 'This removes the unfinished draft on this device.'
          }
          confirmLabel="Clear draft"
          onClose={() => setDiscard(false)}
          onConfirm={() => {
            draft.clear(initial);
            photo.clear();
            draft.savedId.current = null;
            setForm(initial);
            draft.operationId.current = crypto.randomUUID();
            save.reset();
            setDiscard(false);
          }}
        />
      )}
      {switching && (
        <ConfirmDialog
          title="Leave these item details behind?"
          description="This choice uses a saved name or an activity entry. Your unsaved item details will be cleared."
          confirmLabel="Switch and clear details"
          onClose={() => setSwitching(null)}
          onConfirm={() => {
            edit(switching);
            setSwitching(null);
          }}
        />
      )}
    </dialog>
  );
}
