export type ListKind = 'collection' | 'activity';

export interface ListSummary {
  id: string;
  name: string;
  kind: ListKind;
  description: string;
  itemCount: number;
  logCount: number;
  updatedAt: number;
}

export interface ListDetail extends ListSummary {
  rankedIds: string[];
  rankRevision: number;
}

export interface Item {
  id: string;
  listId: string;
  title: string;
  type: string;
  note: string;
  startedOn: string | null;
  endedOn: string | null;
  hasPhoto: boolean;
  createdAt: number;
  updatedAt: number;
  logCount: number;
  lastLoggedOn: string | null;
}

export interface Log {
  id: string;
  listId: string;
  itemId: string | null;
  title: string;
  happenedOn: string;
  note: string;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
  hasPhoto: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ShareSummary {
  id: string;
  title: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

export interface PublicShare {
  title: string;
  entries: { rank: number; title: string; type: string }[];
  createdAt: number;
}

export interface RecentEntry {
  id: string;
  listId: string;
  listName: string;
  kind: ListKind;
  title: string;
  happenedOn: string;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
}

export interface Overview {
  lists: ListSummary[];
  recent: RecentEntry[];
  rail: ArchiveFrame[];
  lastTimes: { title: string; happenedOn: string }[];
  highlight: { id: string; listId: string; title: string; startedOn: string | null } | null;
}

export interface ArchiveFrame {
  id: string;
  listId: string;
  listName: string;
  recordKind: 'item' | 'log';
  title: string;
  happenedOn: string;
  photo: { kind: 'items' | 'logs'; id: string; version: number } | null;
}

export interface SearchResult {
  id: string;
  listId: string;
  listName: string;
  kind: 'item' | 'log';
  title: string;
  detail: string;
}
