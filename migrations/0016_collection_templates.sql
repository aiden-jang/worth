CREATE TABLE collection_template_sets (
  owner_id TEXT PRIMARY KEY,
  templates_json TEXT NOT NULL DEFAULT '[]',
  CONSTRAINT collection_template_capacity CHECK (
    json_valid(templates_json) AND json_type(templates_json) = 'array'
    AND json_array_length(templates_json) <= 50
  )
);
CREATE TABLE collection_template_receipts (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  PRIMARY KEY (owner_id, id)
);
