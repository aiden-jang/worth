CREATE TABLE inbox_entries (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  trashed_at INTEGER
);
CREATE INDEX inbox_entries_owner ON inbox_entries(owner_id, trashed_at, created_at);
CREATE TABLE inbox_operations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('create', 'file')),
  fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at INTEGER NOT NULL
);
CREATE INDEX inbox_operations_owner ON inbox_operations(owner_id);
