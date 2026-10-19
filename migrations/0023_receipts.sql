-- statement
CREATE TABLE receipts (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 body_json TEXT NOT NULL CHECK(json_valid(body_json)),
 creation_hash TEXT NOT NULL,
 attachment_data BLOB,
 created_at INTEGER NOT NULL,
 removed_at INTEGER
);
-- statement
CREATE INDEX receipts_owner ON receipts(owner_id,removed_at,created_at);
-- statement
CREATE TRIGGER receipt_capacity BEFORE INSERT ON receipts
WHEN NEW.removed_at IS NULL AND (SELECT COUNT(*) FROM receipts WHERE owner_id=NEW.owner_id AND removed_at IS NULL)>=100
BEGIN SELECT RAISE(ABORT,'receipt capacity reached'); END;
