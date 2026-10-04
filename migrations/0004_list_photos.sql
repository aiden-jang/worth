CREATE TABLE list_photos (
  list_id TEXT PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);
