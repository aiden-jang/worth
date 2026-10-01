ALTER TABLE items ADD COLUMN decision TEXT CHECK (decision IS NULL OR decision IN ('favorite', 'would_not_again'));
