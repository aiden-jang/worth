-- statement
CREATE TABLE taste_history (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('rank', 'opinion')),
  list_id TEXT REFERENCES lists(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  log_id TEXT REFERENCES logs(id) ON DELETE SET NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CHECK ((kind = 'rank' AND list_id IS NOT NULL AND item_id IS NULL)
    OR (kind = 'opinion' AND item_id IS NOT NULL AND list_id IS NULL))
);
-- statement
CREATE INDEX taste_history_owner ON taste_history(owner_id, created_at DESC, id DESC);
-- statement
CREATE INDEX taste_history_item ON taste_history(item_id);
-- statement
CREATE INDEX taste_history_list ON taste_history(list_id);
-- statement
CREATE TRIGGER remember_rank AFTER UPDATE OF ranked_ids ON lists
WHEN NEW.ranked_ids <> OLD.ranked_ids AND NEW.kind = 'collection'
BEGIN
  INSERT INTO taste_history (id, owner_id, kind, list_id, before_json, after_json, created_at)
  VALUES (lower(hex(randomblob(16))), NEW.owner_id, 'rank', NEW.id,
    OLD.ranked_ids, NEW.ranked_ids, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
END;
-- statement
CREATE TRIGGER remember_opinion AFTER UPDATE OF decision ON items
WHEN NEW.decision IS NOT OLD.decision
BEGIN
  INSERT INTO taste_history (id, owner_id, kind, item_id, before_json, after_json, created_at)
  VALUES (lower(hex(randomblob(16))), NEW.owner_id, 'opinion', NEW.id,
    json_quote(OLD.decision), json_quote(NEW.decision), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
END;
