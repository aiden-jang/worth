-- statement
CREATE TABLE record_connections (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  from_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('related', 'edition', 'place', 'replaces')),
  reason TEXT NOT NULL DEFAULT '',
  fingerprint TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  removed_at INTEGER,
  CHECK (from_id <> to_id),
  CHECK (kind = 'replaces' OR from_id < to_id)
);
-- statement
CREATE UNIQUE INDEX record_connections_pair ON record_connections(owner_id, kind, from_id, to_id) WHERE removed_at IS NULL;
-- statement
CREATE INDEX record_connections_owner ON record_connections(owner_id, removed_at);
-- statement
CREATE INDEX record_connections_from ON record_connections(from_id);
-- statement
CREATE INDEX record_connections_to ON record_connections(to_id);

-- statement
CREATE TRIGGER bound_record_connections BEFORE INSERT ON record_connections
WHEN NEW.removed_at IS NULL AND (SELECT COUNT(*) FROM record_connections WHERE owner_id = NEW.owner_id AND removed_at IS NULL) >= 1000
BEGIN
 SELECT RAISE(ABORT, 'worth_connection_limit');
END;
