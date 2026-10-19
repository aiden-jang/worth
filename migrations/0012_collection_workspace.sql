ALTER TABLE lists ADD COLUMN workspace_json TEXT NOT NULL DEFAULT '{"rankings":[],"views":[]}';
ALTER TABLE lists ADD COLUMN workspace_revision INTEGER NOT NULL DEFAULT 0;
