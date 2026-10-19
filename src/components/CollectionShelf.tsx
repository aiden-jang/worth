import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { api } from '../api';
import { useDraft } from '../hooks/useDraft';
import { useWorkspace } from '../hooks/useWorkspace';
import type { Item, ListDetail } from '../shared/models';
import {
  collectionShelf,
  emptyCollectionShelf,
  type ShelfPresentation,
  type WorkspaceResponse,
} from '../shared/workspace';
import { ConfirmDialog } from './ConfirmDialog';
import '../shelf.css';

const shelfDraft = z.object({ settings: collectionShelf, revision: z.number().int().nonnegative() }).strict();
type ShelfDraft = z.infer<typeof shelfDraft>;

export function CollectionShelf({
  list,
  items,
  onOpen,
}: {
  list: ListDetail;
  items: Item[];
  onOpen: (id: string) => void;
}) {
  const { query } = useWorkspace(list.id);
  if (query.isPending) return <p role="status">Loading your shelf…</p>;
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
    <ShelfEditor
      list={list}
      items={items}
      data={query.data}
      refreshing={query.isFetching}
      onRefresh={() => void query.refetch()}
      onOpen={onOpen}
    />
  );
}

function ShelfEditor({
  list,
  items,
  data,
  refreshing,
  onRefresh,
  onOpen,
}: {
  list: ListDetail;
  items: Item[];
  data: WorkspaceResponse;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
}) {
  const client = useQueryClient();
  const draft = useDraft<ShelfDraft>(
    `shelf:${list.id}`,
    { settings: data.workspace.shelf ?? emptyCollectionShelf, revision: data.revision },
    (value): value is ShelfDraft => shelfDraft.safeParse(value).success,
  );
  const settings = draft.form.settings;
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(30);
  const [reload, setReload] = useState(false);
  const [status, setStatus] = useState('');
  const byId = new Map(items.map((item) => [item.id, item]));
  const staleRecords = !!(
    (settings.keepsakeId && !byId.has(settings.keepsakeId)) ||
    (settings.inscription && !byId.has(settings.inscription.itemId))
  );
  const stale = draft.form.revision !== data.revision;
  const changed = JSON.stringify(settings) !== JSON.stringify(data.workspace.shelf ?? emptyCollectionShelf);
  const save = useMutation({
    mutationFn: () =>
      api.updateWorkspace(list.id, { ...data.workspace, shelf: settings }, draft.form.revision),
    onSuccess: (saved) => {
      client.setQueryData(['workspace', list.id], saved);
      const next = { settings: saved.workspace.shelf ?? emptyCollectionShelf, revision: saved.revision };
      draft.clear(next);
      draft.setForm(next);
      setStatus('Shelf saved.');
    },
    onError: onRefresh,
  });
  function edit(patch: Partial<ShelfPresentation>) {
    draft.setForm((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    setStatus('');
    save.reset();
  }
  const ordered = [...items].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const matches = ordered.filter((item) =>
    `${item.title} ${item.type}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const keepsake = settings.keepsakeId ? byId.get(settings.keepsakeId) : undefined;
  const inscribed = settings.inscription ? byId.get(settings.inscription.itemId) : undefined;
  const undecided = items.filter((item) => item.decision === null).length;
  return (
    <section className="workbench-section collection-shelf" aria-label="Your shelf">
      <p>
        A different way to browse. Choose a keepsake, leave a dedication, or add a small bookend. Shelf
        choices are private and stay separate from ranks and calls.
      </p>
      <details className="shelf-options">
        <summary>Personalize this shelf</summary>
        <fieldset disabled={save.isPending}>
          <legend>Shelf choices</legend>
          <label>
            Presentation
            <select
              value={settings.style}
              onChange={(event) => edit({ style: event.target.value as ShelfPresentation['style'] })}
            >
              <option value="pockets">Paper pockets</option>
              <option value="spines">Book spines</option>
            </select>
          </label>
          <label>
            Bookend
            <select
              value={settings.bookend}
              onChange={(event) => edit({ bookend: event.target.value as ShelfPresentation['bookend'] })}
            >
              <option value="none">None</option>
              <option value="arch">Sage arch</option>
              <option value="plant">Small plant</option>
            </select>
          </label>
          <label>
            Private dedication
            <textarea
              rows={2}
              maxLength={280}
              value={settings.dedication}
              onChange={(event) => edit({ dedication: event.target.value })}
              placeholder="For the things that stayed."
            />
          </label>
          <label>
            Keepsake
            <select
              value={settings.keepsakeId ?? ''}
              onChange={(event) => edit({ keepsakeId: event.target.value || null })}
            >
              <option value="">No keepsake</option>
              {settings.keepsakeId && !byId.has(settings.keepsakeId) && (
                <option value={settings.keepsakeId}>Unavailable record — choose another or clear</option>
              )}
              {ordered.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p>The keepsake can be any record. It does not become a Favorite or move in your ranking.</p>
          <label>
            Inscription record
            <select
              value={settings.inscription?.itemId ?? ''}
              onChange={(event) =>
                edit({
                  inscription: event.target.value
                    ? { itemId: event.target.value, text: settings.inscription?.text ?? '' }
                    : null,
                })
              }
            >
              <option value="">No inscription</option>
              {settings.inscription && !byId.has(settings.inscription.itemId) && (
                <option value={settings.inscription.itemId}>
                  Unavailable record — choose another or clear
                </option>
              )}
              {ordered.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button-outline"
            disabled={!ordered.length}
            onClick={() =>
              edit({ inscription: { itemId: ordered[0].id, text: settings.inscription?.text ?? '' } })
            }
          >
            Use earliest kept record
          </button>
          <p>
            This chooses the earliest record currently kept here. The inscription stays with that choice;
            removing it never attaches the inscription to a different record.
          </p>
          {settings.inscription && (
            <label>
              Inscription
              <textarea
                rows={2}
                maxLength={280}
                value={settings.inscription.text}
                onChange={(event) =>
                  edit({ inscription: { ...settings.inscription!, text: event.target.value } })
                }
              />
            </label>
          )}
          <label className="workbench-check">
            <input
              type="checkbox"
              checked={settings.paperCreature}
              onChange={(event) => edit({ paperCreature: event.target.checked })}
            />
            Show the undecided paper creature
          </label>
        </fieldset>
        <p className="draft-status" role="status">
          {draft.status || 'Shelf drafts can recover on this device for seven days.'}
        </p>
        {(stale || save.isError || staleRecords) && (
          <div role="alert">
            <p>
              {staleRecords
                ? 'A chosen record is no longer available here. Choose another or clear it before saving.'
                : (save.error?.message ??
                  'Saved tools changed elsewhere. Reload the saved shelf before applying this draft.')}
            </p>
            <button
              className="button button-outline"
              disabled={refreshing || save.isPending}
              onClick={() => {
                onRefresh();
                setReload(true);
              }}
            >
              Reload saved shelf
            </button>
          </div>
        )}
        <button
          className="button button-accent"
          disabled={!changed || stale || staleRecords || refreshing || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save shelf'}
        </button>
        {status && <p role="status">{status}</p>}
      </details>
      <div className="shelf-scene" role="region" aria-label="Shelf preview">
        <div className="shelf-introduction">
          <div>
            <p className="overline">YOUR COLLECTION</p>
            <h3>{list.name}</h3>
            {settings.dedication && <p className="shelf-dedication">{settings.dedication}</p>}
          </div>
          {settings.bookend !== 'none' && <Bookend kind={settings.bookend} />}
        </div>
        {keepsake && (
          <article className="shelf-keepsake">
            <p className="overline">KEEPSAKE</p>
            <h4>{keepsake.title}</h4>
            {keepsake.type && <p>{keepsake.type}</p>}
            <button className="button button-outline" onClick={() => onOpen(keepsake.id)}>
              Open keepsake
            </button>
          </article>
        )}
        {inscribed && settings.inscription?.text && (
          <blockquote className="shelf-inscription">
            <p>{settings.inscription.text}</p>
            <footer>Kept with {inscribed.title}</footer>
          </blockquote>
        )}
        {settings.paperCreature && undecided > 0 && (
          <div className="shelf-undecided">
            <PaperCreature />
            <p>
              {undecided} {undecided === 1 ? 'record' : 'records'} without a call.
              <br />
              <span>No opinion required.</span>
            </p>
          </div>
        )}
        <label className="shelf-search">
          Find on this shelf
          <input
            value={search}
            maxLength={200}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(30);
            }}
            placeholder="Search names and types"
          />
        </label>
        <p className="shelf-order">In the order you kept them. This does not show your ranking.</p>
        <ul className={`shelf-records shelf-${settings.style}`}>
          {matches.slice(0, limit).map((item, index) => (
            <li key={item.id} className={`shelf-record shelf-color-${index % 3}`}>
              <button onClick={() => onOpen(item.id)}>
                <span className="shelf-record-name">{item.title}</span>
                {item.type && <span className="shelf-record-type">{item.type}</span>}
                {settings.keepsakeId === item.id && <span className="shelf-record-tag">Keepsake</span>}
              </button>
            </li>
          ))}
        </ul>
        {!matches.length && (
          <p>
            {items.length
              ? 'No matching records. Try a different search.'
              : 'An empty shelf. Add a name in the collection to begin.'}
          </p>
        )}
        {matches.length > limit && (
          <button className="button button-outline" onClick={() => setLimit(limit + 30)}>
            Show more records · {limit} of {matches.length}
          </button>
        )}
      </div>
      {reload && (
        <ConfirmDialog
          title="Reload the saved shelf?"
          description="This replaces your shelf draft with the latest saved choices. Your records and rankings stay unchanged."
          confirmLabel="Reload saved shelf"
          pending={refreshing}
          onClose={() => setReload(false)}
          onConfirm={() => {
            const next = { settings: data.workspace.shelf ?? emptyCollectionShelf, revision: data.revision };
            draft.clear(next);
            draft.setForm(next);
            save.reset();
            setReload(false);
            setStatus('Saved shelf loaded.');
          }}
        />
      )}
    </section>
  );
}

function Bookend({ kind }: { kind: 'arch' | 'plant' }) {
  return (
    <svg
      className="shelf-bookend"
      viewBox="0 0 144 152"
      fill="none"
      role="img"
      aria-label={kind === 'arch' ? 'Sage arch bookend' : 'Small plant bookend'}
    >
      {kind === 'arch' ? (
        <>
          <path d="M32 132V69a40 40 0 0 1 80 0v63H94V69a22 22 0 0 0-44 0v63Z" fill="#bdc7a8" />
          <path d="M22 132h100v9H22z" fill="#737d62" />
          <path d="M43 130V70a29 29 0 0 1 58 0v60" stroke="#737d62" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M42 96h65l-9 41H51Z" fill="#cdaa99" />
          <path d="M38 94h72v9H38z" fill="#b49180" />
          <path d="M75 95V42m0 37 24-24M75 66 51 49" stroke="#879473" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M76 45C48 47 50 13 73 17c20 4 20 23 3 28Zm-20 9C27 58 28 29 45 34c16 4 17 14 11 20Zm38 6c-4-26 27-32 28-12 0 15-15 20-28 12Z"
            fill="#bdc7a8"
          />
        </>
      )}
      <path d="M13 143h120" stroke="#737566" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PaperCreature() {
  return (
    <svg
      className="shelf-paper-creature"
      viewBox="0 0 120 110"
      fill="none"
      role="img"
      aria-label="Faceless folded paper creature"
    >
      <path d="M26 17 91 12l9 72-65 6Z" fill="#eae5d5" />
      <path d="m26 17 17 18-8 55m8-55 50-5" stroke="#aaa99b" strokeWidth="2" />
      <path d="m46 90-1 8H35m42-11 3 9h10" stroke="#aaa99b" strokeWidth="3" strokeLinecap="round" />
      <path d="m91 12-8 16 10 2" fill="#dedaca" />
    </svg>
  );
}
