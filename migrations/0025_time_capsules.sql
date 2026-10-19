-- statement
CREATE TABLE time_capsules (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 body_json TEXT NOT NULL CHECK(json_valid(body_json)),
 creation_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 opens_at INTEGER NOT NULL,
 opened_at INTEGER,
 removed_at INTEGER
);
-- statement
CREATE INDEX time_capsules_owner ON time_capsules(owner_id,removed_at,opens_at,created_at);
-- statement
CREATE TABLE capsule_photos (
 id TEXT PRIMARY KEY,
 capsule_id TEXT NOT NULL REFERENCES time_capsules(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 fingerprint TEXT NOT NULL,
 data BLOB
);
-- statement
CREATE INDEX capsule_photos_owner ON capsule_photos(owner_id,capsule_id);
-- statement
CREATE TRIGGER capsule_capacity BEFORE INSERT ON time_capsules
WHEN NEW.removed_at IS NULL AND (SELECT COUNT(*) FROM time_capsules WHERE owner_id=NEW.owner_id AND removed_at IS NULL)>=25
BEGIN SELECT RAISE(ABORT,'capsule capacity reached'); END;
