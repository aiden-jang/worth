CREATE TABLE workout_sessions (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  happened_on TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX workout_sessions_owner_list_date ON workout_sessions(owner_id, list_id, happened_on);
ALTER TABLE logs ADD COLUMN workout_id TEXT REFERENCES workout_sessions(id) ON DELETE SET NULL;
CREATE INDEX logs_workout ON logs(workout_id);
