-- Cover edits use their own counter, independent of clock changes and record activity.
ALTER TABLE lists ADD COLUMN cover_revision INTEGER NOT NULL DEFAULT 0 CHECK (cover_revision >= 0);
