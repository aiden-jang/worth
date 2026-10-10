-- Replace the constrained column in place so item references, logs, and photos survive.
ALTER TABLE items ADD COLUMN decision_v2 TEXT CHECK (decision_v2 IS NULL OR decision_v2 IN ('favorite', 'meh', 'would_not_again'));
UPDATE items SET decision_v2 = decision;
ALTER TABLE items DROP COLUMN decision;
ALTER TABLE items RENAME COLUMN decision_v2 TO decision;
