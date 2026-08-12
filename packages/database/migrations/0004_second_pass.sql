PRAGMA foreign_keys = ON;

-- Align the original settings primary-key name with the public/admin API vocabulary.
-- SQLite/D1 preserves the primary-key constraint and existing values during this rename.
ALTER TABLE site_settings RENAME COLUMN setting_key TO key;
