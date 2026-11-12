import type { Item } from './models';
import { emptyItemContext } from './item-context';
import type { QuickEntryDraft } from './quick-entry';

const nameKey = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function matchingSavedItems(items: Item[], title: string) {
  const key = nameKey(title);
  return key ? items.filter((item) => nameKey(item.title) === key) : [];
}

export type CaptureSuggestion = {
  title: string;
  sourceUrl?: string;
  code?: string;
  type?: string;
  note?: string;
};

// Suggestions change only the fields the person reviewed, retaining other draft context.
export function applyCaptureSuggestion(
  form: QuickEntryDraft,
  suggestion: CaptureSuggestion,
): QuickEntryDraft {
  const context = form.context ?? emptyItemContext;
  const fields = [...context.fields];
  if (suggestion.code) {
    const index = fields.findIndex((field) => field.name.toLocaleLowerCase() === 'barcode');
    if (index >= 0) fields[index] = { ...fields[index], value: suggestion.code };
    else if (fields.length < 12) fields.push({ name: 'Barcode', value: suggestion.code });
    else throw new Error('All 12 detail fields are in use. Remove one before adding a barcode.');
  }
  const note = [form.note, suggestion.note].filter(Boolean).join('\n\n');
  if (note.length > 4000)
    throw new Error('The combined note is too long. Shorten it before adding these details.');
  return {
    ...form,
    title: suggestion.title.trim(),
    itemId: null,
    keepSeparate: false,
    type: form.type || suggestion.type || '',
    note,
    context: { ...context, sourceUrl: suggestion.sourceUrl ?? context.sourceUrl, fields },
  };
}
