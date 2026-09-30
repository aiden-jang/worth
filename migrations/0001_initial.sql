CREATE TABLE lists (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('collection', 'activity')),
  description TEXT NOT NULL DEFAULT '',
  ranked_ids TEXT NOT NULL DEFAULT '[]',
  rank_revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX lists_owner_updated ON lists(owner_id, updated_at DESC);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  started_on TEXT,
  ended_on TEXT,
  photo_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX items_list_created ON items(list_id, created_at DESC);
CREATE INDEX items_owner_list ON items(owner_id, list_id);

CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  happened_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  amount REAL,
  unit TEXT NOT NULL DEFAULT '',
  sets INTEGER,
  reps INTEGER,
  photo_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX logs_list_happened ON logs(list_id, happened_on DESC, created_at DESC);
CREATE INDEX logs_item_happened ON logs(item_id, happened_on DESC);
CREATE INDEX logs_owner_list ON logs(owner_id, list_id);

CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX shares_owner_list ON shares(owner_id, list_id, created_at DESC);

