-- Archived collections remain readable and independent of the 30-day Trash lifecycle.
ALTER TABLE lists ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1));
CREATE INDEX lists_archived ON lists(owner_id, archived, updated_at);
