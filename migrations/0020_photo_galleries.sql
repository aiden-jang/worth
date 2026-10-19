ALTER TABLE items ADD COLUMN gallery_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(gallery_json));
-- statement
ALTER TABLE items ADD COLUMN gallery_revision INTEGER NOT NULL DEFAULT 0;
-- statement
ALTER TABLE items ADD COLUMN cover_photo_id TEXT;
-- statement
ALTER TABLE logs ADD COLUMN gallery_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(gallery_json));
-- statement
ALTER TABLE logs ADD COLUMN gallery_revision INTEGER NOT NULL DEFAULT 0;
-- statement
ALTER TABLE logs ADD COLUMN cover_photo_id TEXT;
-- statement
CREATE TABLE photo_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
  log_id TEXT REFERENCES logs(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  data BLOB,
  fingerprint TEXT,
  created_at INTEGER NOT NULL,
  removed_at INTEGER,
  CHECK ((item_id IS NOT NULL) != (log_id IS NOT NULL)),
  CHECK (removed_at IS NULL OR data IS NULL)
);
-- statement
CREATE INDEX photo_assets_item ON photo_assets(owner_id,item_id,removed_at);
-- statement
CREATE INDEX photo_assets_log ON photo_assets(owner_id,log_id,removed_at);
-- statement
CREATE TRIGGER photo_assets_owner BEFORE INSERT ON photo_assets BEGIN
  SELECT CASE WHEN NEW.item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM items i WHERE i.id=NEW.item_id AND i.owner_id=NEW.owner_id)
    OR NEW.log_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM logs g WHERE g.id=NEW.log_id AND g.owner_id=NEW.owner_id)
    THEN RAISE(ABORT,'photo owner changed') END;
END;
-- statement
CREATE TRIGGER photo_assets_capacity BEFORE INSERT ON photo_assets WHEN NEW.removed_at IS NULL BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM photo_assets a WHERE a.owner_id=NEW.owner_id AND a.removed_at IS NULL AND
    (NEW.item_id IS NOT NULL AND a.item_id=NEW.item_id OR NEW.log_id IS NOT NULL AND a.log_id=NEW.log_id)) >= 12
    THEN RAISE(ABORT,'photo gallery full') END;
END;
-- statement
INSERT INTO photo_assets(id,owner_id,item_id,content_type,data,created_at)
SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-8'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),
  p.owner_id,p.item_id,p.content_type,p.data,p.updated_at FROM item_photos p JOIN items i ON i.id=p.item_id AND i.owner_id=p.owner_id;
-- statement
INSERT INTO photo_assets(id,owner_id,log_id,content_type,data,created_at)
SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-8'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),
  p.owner_id,p.log_id,p.content_type,p.data,p.updated_at FROM log_photos p JOIN logs g ON g.id=p.log_id AND g.owner_id=p.owner_id;
-- statement
UPDATE items SET gallery_json=(SELECT json_group_array(json_object('id',a.id,'caption','','arrows',json('[]'))) FROM photo_assets a WHERE a.item_id=items.id AND a.owner_id=items.owner_id),
  cover_photo_id=(SELECT a.id FROM photo_assets a WHERE a.item_id=items.id AND a.owner_id=items.owner_id LIMIT 1)
WHERE EXISTS (SELECT 1 FROM photo_assets a WHERE a.item_id=items.id AND a.owner_id=items.owner_id);
-- statement
UPDATE logs SET gallery_json=(SELECT json_group_array(json_object('id',a.id,'caption','','arrows',json('[]'))) FROM photo_assets a WHERE a.log_id=logs.id AND a.owner_id=logs.owner_id),
  cover_photo_id=(SELECT a.id FROM photo_assets a WHERE a.log_id=logs.id AND a.owner_id=logs.owner_id LIMIT 1)
WHERE EXISTS (SELECT 1 FROM photo_assets a WHERE a.log_id=logs.id AND a.owner_id=logs.owner_id);
