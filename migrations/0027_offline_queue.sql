-- statement
CREATE TABLE offline_epochs(owner_id TEXT PRIMARY KEY,epoch TEXT NOT NULL);
-- statement
CREATE TABLE offline_operations(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,epoch TEXT NOT NULL,fingerprint TEXT NOT NULL,result_json TEXT NOT NULL);
-- statement
CREATE INDEX offline_operations_owner ON offline_operations(owner_id);
