CREATE TABLE drops (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('file','text','link')), content TEXT, file_name TEXT, mime_type TEXT, size INTEGER, storage_key TEXT, metadata TEXT CHECK (metadata IS NULL OR json_valid(metadata)), encrypted INTEGER NOT NULL DEFAULT 0 CHECK (encrypted IN (0,1)), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX drops_expires_at_idx ON drops(expires_at);
CREATE TABLE upload_intents (storage_key TEXT PRIMARY KEY NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, declared_size INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER);
CREATE INDEX upload_intents_expires_at_idx ON upload_intents(expires_at);
