ALTER TABLE lists ADD COLUMN exercise_aliases TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(exercise_aliases) AND json_type(exercise_aliases)='array' AND json_array_length(exercise_aliases)<=30);
ALTER TABLE lists ADD COLUMN exercise_alias_revision INTEGER NOT NULL DEFAULT 0 CHECK(exercise_alias_revision>=0);
ALTER TABLE workout_routines ADD COLUMN targets_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(targets_json) AND json_type(targets_json)='array' AND json_array_length(targets_json)<=40);
ALTER TABLE workout_routines ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE workout_sessions ADD COLUMN targets_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(targets_json) AND json_type(targets_json)='array' AND json_array_length(targets_json)<=40);
ALTER TABLE workout_sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE logs ADD COLUMN measurements_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(measurements_json) AND json_type(measurements_json)='array' AND json_array_length(measurements_json)<=12);
ALTER TABLE logs ADD COLUMN exercise_mode INTEGER NOT NULL DEFAULT 0 CHECK(exercise_mode IN (0,1));
UPDATE logs SET exercise_mode=1 WHERE json_array_length(exercise_sets)>0 OR sets IS NOT NULL OR reps IS NOT NULL;
CREATE TABLE activity_plan_receipts(
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('routine','workout')),
 fingerprint TEXT NOT NULL
);
CREATE INDEX activity_plan_receipts_owner ON activity_plan_receipts(owner_id);
