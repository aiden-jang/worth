CREATE TABLE workout_routines (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  exercises TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX workout_routines_owner_list ON workout_routines(owner_id, list_id);
ALTER TABLE workout_sessions ADD COLUMN planned_exercises TEXT NOT NULL DEFAULT '[]';
