CREATE TABLE capture_operations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  list_id TEXT REFERENCES lists(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('batch', 'import')),
  fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX capture_operations_owner ON capture_operations(owner_id);
CREATE TABLE request_limits (
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL,
  window INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (owner_id, category, window)
);
