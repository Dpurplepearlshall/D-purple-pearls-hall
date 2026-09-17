ALTER TABLE results ADD COLUMN IF NOT EXISTS class_name VARCHAR(80);

UPDATE results
SET class_name = 'Unassigned'
WHERE class_name IS NULL;

ALTER TABLE results ALTER COLUMN class_name SET DEFAULT 'Unassigned';
ALTER TABLE results ALTER COLUMN class_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS results_term_student_idx ON results(term, student_id);
