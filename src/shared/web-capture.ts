import { z } from 'zod';
import { itemInput } from './validation';
import { emptyItemContext } from './item-context';

export const incomingCapture = z
  .object({
    title: z.string().max(1000),
    text: z.string().max(16000),
    url: z.string().max(4000),
  })
  .strict();
export type IncomingCapture = z.infer<typeof incomingCapture>;
export const emptyWebCapture = {
  listId: 'inbox',
  title: '',
  type: '',
  note: '',
  sourceUrl: '',
  wantToTry: false,
  approvedDuplicate: false,
  review: false,
  frozen: null,
};
export const webCaptureDraft = z
  .object({
    listId: z.string().max(100),
    title: z.string().max(1000),
    type: z.string().max(60),
    note: z.string().max(16000),
    sourceUrl: z.string().max(4000),
    wantToTry: z.boolean(),
    approvedDuplicate: z.boolean(),
    review: z.boolean(),
    frozen: z
      .union([
        z.object({ listId: z.string().uuid(), item: itemInput }).strict(),
        z.object({ inbox: z.literal(true), item: itemInput }).strict(),
      ])
      .nullable(),
  })
  .strict();
export type WebCaptureDraft = z.infer<typeof webCaptureDraft>;
export function captureItem(form: WebCaptureDraft) {
  return itemInput.parse({
    title: form.title,
    type: form.type,
    note: form.note,
    wantToTry: form.wantToTry,
    context: { ...emptyItemContext, sourceUrl: form.sourceUrl },
  });
}
export function sharedCapture(params: URLSearchParams): IncomingCapture | null {
  if (!['title', 'text', 'url'].some((name) => params.has(name))) return null;
  const value = incomingCapture.parse({
    title: params.get('title') ?? '',
    text: params.get('text') ?? '',
    url: params.get('url') ?? '',
  });
  if (!value.url && /^https?:\/\/\S+$/i.test(value.text.trim()))
    return { ...value, url: value.text.trim(), text: '' };
  return value;
}
export function captureBookmarklet(origin: string) {
  const target = new URL('/capture', origin);
  if (!['https:', 'http:'].includes(target.protocol)) throw new Error('Choose a website origin.');
  // Fragments keep the page title, URL and selection out of the receiving HTTP request.
  return `javascript:(()=>{const u=new URL(${JSON.stringify(target.href)});u.hash=new URLSearchParams({title:document.title,url:location.href,text:String(window.getSelection()||'')}).toString();window.open(u.href,'_blank','noopener,noreferrer')})()`;
}
