ALTER TABLE lists ADD COLUMN trashed_at INTEGER;
ALTER TABLE items ADD COLUMN trashed_at INTEGER;
ALTER TABLE logs ADD COLUMN trashed_at INTEGER;
ALTER TABLE items ADD COLUMN want_to_try INTEGER NOT NULL DEFAULT 0 CHECK (want_to_try IN (0, 1));
ALTER TABLE items ADD COLUMN merged_into_id TEXT REFERENCES items(id) ON DELETE CASCADE;

CREATE INDEX lists_trash ON lists(owner_id, trashed_at);
CREATE INDEX items_trash ON items(owner_id, trashed_at);
CREATE INDEX logs_trash ON logs(owner_id, trashed_at);
CREATE INDEX items_merge ON items(merged_into_id);

-- All ordinary reads use these views. Original rows and private photos stay in
-- their existing tables, so restoring a parent also restores its relationships.
CREATE VIEW active_lists AS SELECT * FROM lists WHERE trashed_at IS NULL;
CREATE VIEW record_items AS SELECT i.* FROM items i
WHERE i.trashed_at IS NULL
AND EXISTS (SELECT 1 FROM active_lists l WHERE l.id = i.list_id AND l.owner_id = i.owner_id)
AND (i.merged_into_id IS NULL OR EXISTS (
  SELECT 1 FROM items parent WHERE parent.id = i.merged_into_id
  AND parent.owner_id = i.owner_id AND parent.list_id = i.list_id
  AND parent.trashed_at IS NULL AND parent.merged_into_id IS NULL
));
CREATE VIEW active_items AS SELECT * FROM record_items WHERE merged_into_id IS NULL;
CREATE VIEW active_logs AS SELECT g.* FROM logs g
WHERE g.trashed_at IS NULL
AND EXISTS (SELECT 1 FROM active_lists l WHERE l.id = g.list_id AND l.owner_id = g.owner_id)
AND (g.item_id IS NULL OR EXISTS (
  SELECT 1 FROM record_items i WHERE i.id = g.item_id AND i.owner_id = g.owner_id
));

CREATE TABLE archive_operations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX archive_operations_owner ON archive_operations(owner_id, created_at);
