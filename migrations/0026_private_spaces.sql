-- statement
CREATE TABLE private_spaces(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 0,creation_hash TEXT NOT NULL,created_at INTEGER NOT NULL,removed_at INTEGER);
-- statement
CREATE INDEX private_spaces_owner ON private_spaces(owner_id,removed_at);
-- statement
CREATE TABLE space_members(id TEXT PRIMARY KEY,space_id TEXT NOT NULL REFERENCES private_spaces(id) ON DELETE CASCADE,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('viewer','editor')),account_id TEXT,account_name TEXT,token_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER);
-- statement
CREATE INDEX space_members_account ON space_members(account_id,space_id,revoked_at);
-- statement
CREATE TABLE space_entries(id TEXT PRIMARY KEY,space_id TEXT NOT NULL REFERENCES private_spaces(id) ON DELETE CASCADE,author_id TEXT NOT NULL,author_name TEXT NOT NULL,list_name TEXT NOT NULL,data_json TEXT NOT NULL CHECK(json_valid(data_json)),created_at INTEGER NOT NULL);
-- statement
CREATE TABLE pair_rounds(id TEXT PRIMARY KEY,space_id TEXT NOT NULL REFERENCES private_spaces(id) ON DELETE CASCADE,title TEXT NOT NULL,creation_hash TEXT NOT NULL,options_json TEXT NOT NULL,first_id TEXT NOT NULL,second_id TEXT NOT NULL,second_member_id TEXT NOT NULL,first_name TEXT NOT NULL,second_name TEXT NOT NULL,created_at INTEGER NOT NULL);
-- statement
CREATE TABLE pair_choices(round_id TEXT NOT NULL REFERENCES pair_rounds(id) ON DELETE CASCADE,owner_id TEXT NOT NULL,choice INTEGER NOT NULL CHECK(choice IN(0,1)),revision INTEGER NOT NULL DEFAULT 0,revealed_at INTEGER,PRIMARY KEY(round_id,owner_id));
-- statement
CREATE TABLE shared_archives(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,source_space_id TEXT,body_json TEXT NOT NULL CHECK(json_valid(body_json)));
-- statement
CREATE INDEX shared_archives_owner ON shared_archives(owner_id);
-- statement
CREATE TRIGGER space_capacity BEFORE INSERT ON private_spaces WHEN (SELECT COUNT(*) FROM private_spaces WHERE owner_id=NEW.owner_id AND removed_at IS NULL)>=20 BEGIN SELECT RAISE(ABORT,'space capacity reached'); END;
-- statement
CREATE TRIGGER space_member_capacity BEFORE INSERT ON space_members WHEN (SELECT COUNT(*) FROM space_members WHERE space_id=NEW.space_id AND revoked_at IS NULL)>=8 BEGIN SELECT RAISE(ABORT,'member capacity reached'); END;
-- statement
CREATE TRIGGER space_entry_capacity BEFORE INSERT ON space_entries WHEN (SELECT COUNT(*) FROM space_entries WHERE space_id=NEW.space_id)>=30 BEGIN SELECT RAISE(ABORT,'entry capacity reached'); END;
-- statement
CREATE TRIGGER pair_capacity BEFORE INSERT ON pair_rounds WHEN (SELECT COUNT(*) FROM pair_rounds WHERE space_id=NEW.space_id)>=30 BEGIN SELECT RAISE(ABORT,'pair capacity reached'); END;
-- statement
CREATE TRIGGER shared_archive_capacity BEFORE INSERT ON shared_archives WHEN (SELECT COUNT(*) FROM shared_archives WHERE owner_id=NEW.owner_id)>=50 BEGIN SELECT RAISE(ABORT,'shared archive capacity reached'); END;

-- statement
CREATE TABLE space_entry_receipts(id TEXT PRIMARY KEY,space_id TEXT NOT NULL REFERENCES private_spaces(id) ON DELETE CASCADE,author_id TEXT NOT NULL,fingerprint TEXT NOT NULL);

-- statement
CREATE INDEX space_members_space ON space_members(space_id,revoked_at,email,account_id);
-- statement
CREATE INDEX space_entries_space ON space_entries(space_id,created_at,id);
-- statement
CREATE INDEX pair_rounds_space ON pair_rounds(space_id,created_at,id);
