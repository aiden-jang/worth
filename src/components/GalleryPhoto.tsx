import type { GalleryEntry } from '../shared/photo-gallery';
import { AnnotatedPhoto } from './AnnotatedPhoto';
export function GalleryPhoto({
  kind,
  recordId,
  entry,
  number,
}: {
  kind: 'items' | 'logs';
  recordId: string;
  entry: GalleryEntry;
  number: number;
}) {
  return <AnnotatedPhoto src={`/api/${kind}/${recordId}/photos/${entry.id}`} entry={entry} number={number} />;
}
