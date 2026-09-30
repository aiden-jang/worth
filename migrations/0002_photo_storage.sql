CREATE TABLE item_photos (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE log_photos (
  log_id TEXT PRIMARY KEY REFERENCES logs(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE items DROP COLUMN photo_key;
ALTER TABLE logs DROP COLUMN photo_key;
