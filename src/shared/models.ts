export type ListKind = 'collection' | 'activity';
export type ItemDecision = 'favorite' | 'meh' | 'would_not_again';

export interface ListSummary {
  id: string;
  name: string;
  kind: ListKind;
  description: string;
  itemCount: number;
  logCount: number;
  rankedCount: number;
  favoriteCount: number;
  hasCoverPhoto: boolean;
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
  decision: ItemDecision | null;
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
  recordKind: 'item' | 'log';
  decision: ItemDecision | null;
  itemId: string | null;
  title: string;
  happenedOn: string | null;
  recordedAt: number;
  amount: number | null;
  unit: string;
  sets: number | null;
  reps: number | null;
}

export interface Overview {
  lists: ListSummary[];
  recent: RecentEntry[];
  ranked: RankedPick[];
  favorites: DecisionPick[];
  notAgain: DecisionPick[];
  lastTimes: LastTime[];
}

export interface RankedPick {
  listId: string;
  listName: string;
  itemId: string;
  title: string;
  type: string;
  rank: number;
}

export interface ArchivePatterns {
  totalRecords: number;
  totalCollections: number;
  totalActivities: number;
  rankedItemCount: number;
  revisitCount: number;
  favoriteCount: number;
  notAgainCount: number;
  mehCount: number;
  mostReturned: {
    listId: string;
    itemId: string;
    listName: string;
    title: string;
    count: number;
  } | null;
  newestCollection: {
    id: string;
    name: string;
    itemCount: number;
  } | null;
  lastTouchedCollection: {
    id: string;
    name: string;
    itemCount: number;
  } | null;
  mostKeptCollection: {
    id: string;
    name: string;
    itemCount: number;
  } | null;
}

export interface LastTime {
  id: string;
  listId: string;
  listName: string;
  title: string;
  happenedOn: string;
}

export interface DecisionPick {
  listId: string;
  listName: string;
  itemId: string;
  title: string;
  type: string;
  decision: ItemDecision;
}

export interface SearchResult {
  id: string;
  listId: string;
  listName: string;
  kind: 'list' | 'item' | 'log';
  itemId: string | null;
  title: string;
  detail: string;
}
