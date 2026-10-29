-- Unfiled finds can keep one private photo before a collection is chosen.
-- Removed uploads keep their identity so a late retry cannot resurrect a photo.
CREATE TABLE inbox_photos (
  id TEXT PRIMARY KEY,
  inbox_id TEXT NOT NULL REFERENCES inbox_entries(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  data BLOB,
  fingerprint TEXT,
  created_at INTEGER NOT NULL,
  removed_at INTEGER,
  CHECK (removed_at IS NULL OR data IS NULL)
);
-- statement
CREATE UNIQUE INDEX inbox_photos_current ON inbox_photos(owner_id,inbox_id) WHERE removed_at IS NULL;
-- statement
CREATE TRIGGER inbox_photos_owner BEFORE INSERT ON inbox_photos BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM inbox_entries e WHERE e.id=NEW.inbox_id AND e.owner_id=NEW.owner_id)
    THEN RAISE(ABORT,'photo owner changed') END;
END;
