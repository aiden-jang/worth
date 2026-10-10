ALTER TABLE items ADD COLUMN revisit_queued INTEGER NOT NULL DEFAULT 0 CHECK (revisit_queued IN (0, 1));
ALTER TABLE workout_sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'finished' CHECK (status IN ('active', 'finished'));
ALTER TABLE workout_sessions ADD COLUMN skipped_exercises TEXT NOT NULL DEFAULT '[]';
