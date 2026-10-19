-- statement
CREATE TABLE memory_boards (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 body_json TEXT NOT NULL CHECK(json_valid(body_json)),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
 create_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 removed_at INTEGER
);
-- statement
CREATE INDEX memory_boards_owner ON memory_boards(owner_id,removed_at,updated_at);
-- statement
CREATE TRIGGER memory_board_capacity BEFORE INSERT ON memory_boards
WHEN NEW.removed_at IS NULL AND (SELECT COUNT(*) FROM memory_boards WHERE owner_id=NEW.owner_id AND removed_at IS NULL)>=100
BEGIN SELECT RAISE(ABORT,'board capacity reached'); END;
