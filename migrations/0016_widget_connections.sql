CREATE TABLE widget_devices (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX widget_devices_owner ON widget_devices(owner_id, expires_at);
CREATE TABLE widget_scopes (
  device_id TEXT NOT NULL REFERENCES widget_devices(id) ON DELETE CASCADE,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  PRIMARY KEY (device_id, list_id)
);
CREATE TABLE widget_grants (
  code_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  challenge TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX widget_grants_owner ON widget_grants(owner_id, expires_at);
