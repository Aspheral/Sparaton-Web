PRAGMA foreign_keys = ON;

ALTER TABLE people ADD COLUMN role_text TEXT;
ALTER TABLE people ADD COLUMN areas_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE people ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE people ADD COLUMN seo_title TEXT;
ALTER TABLE people ADD COLUMN seo_description TEXT;
ALTER TABLE people ADD COLUMN canonical_url TEXT;
ALTER TABLE people ADD COLUMN social_title TEXT;
ALTER TABLE people ADD COLUMN social_description TEXT;
ALTER TABLE people ADD COLUMN social_image_url TEXT;
ALTER TABLE people ADD COLUMN robots_index INTEGER NOT NULL DEFAULT 1 CHECK (robots_index IN (0,1));

ALTER TABLE organizations ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN seo_title TEXT;
ALTER TABLE organizations ADD COLUMN seo_description TEXT;
ALTER TABLE organizations ADD COLUMN canonical_url TEXT;
ALTER TABLE organizations ADD COLUMN social_title TEXT;
ALTER TABLE organizations ADD COLUMN social_description TEXT;
ALTER TABLE organizations ADD COLUMN social_image_url TEXT;
ALTER TABLE organizations ADD COLUMN robots_index INTEGER NOT NULL DEFAULT 1 CHECK (robots_index IN (0,1));

ALTER TABLE services ADD COLUMN category TEXT;
ALTER TABLE services ADD COLUMN scope_text TEXT;
ALTER TABLE services ADD COLUMN provider_text TEXT;
ALTER TABLE services ADD COLUMN inquiry_cta TEXT NOT NULL DEFAULT 'Request a quote';
ALTER TABLE services ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN seo_title TEXT;
ALTER TABLE services ADD COLUMN seo_description TEXT;
ALTER TABLE services ADD COLUMN canonical_url TEXT;
ALTER TABLE services ADD COLUMN social_title TEXT;
ALTER TABLE services ADD COLUMN social_description TEXT;
ALTER TABLE services ADD COLUMN social_image_url TEXT;
ALTER TABLE services ADD COLUMN robots_index INTEGER NOT NULL DEFAULT 1 CHECK (robots_index IN (0,1));

ALTER TABLE projects ADD COLUMN canonical_url TEXT;
ALTER TABLE projects ADD COLUMN social_title TEXT;
ALTER TABLE projects ADD COLUMN social_description TEXT;
ALTER TABLE projects ADD COLUMN social_image_url TEXT;
ALTER TABLE projects ADD COLUMN robots_index INTEGER NOT NULL DEFAULT 1 CHECK (robots_index IN (0,1));

ALTER TABLE posts ADD COLUMN canonical_url TEXT;
ALTER TABLE posts ADD COLUMN social_title TEXT;
ALTER TABLE posts ADD COLUMN social_description TEXT;
ALTER TABLE posts ADD COLUMN social_image_url TEXT;
ALTER TABLE posts ADD COLUMN robots_index INTEGER NOT NULL DEFAULT 1 CHECK (robots_index IN (0,1));

ALTER TABLE media ADD COLUMN sha256 TEXT;

CREATE TABLE ticket_tags (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ticket_id, tag)
);
CREATE INDEX idx_ticket_tags_ticket ON ticket_tags(ticket_id, created_at);

CREATE TABLE ticket_notification_deliveries (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES ticket_messages(id) ON DELETE CASCADE,
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('client','staff')),
  recipient_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'resend',
  status TEXT NOT NULL CHECK (status IN ('pending','sent','failed','skipped_online','skipped_unconfigured')),
  provider_message_id TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempted_at TEXT,
  completed_at TEXT
);
CREATE INDEX idx_ticket_notification_message ON ticket_notification_deliveries(message_id, recipient_kind);
CREATE INDEX idx_ticket_notification_recent ON ticket_notification_deliveries(created_at DESC);

CREATE TABLE project_github_metadata (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  repository_full_name TEXT NOT NULL,
  default_branch TEXT,
  latest_release_tag TEXT,
  latest_release_name TEXT,
  latest_release_url TEXT,
  latest_release_at TEXT,
  languages_json TEXT NOT NULL DEFAULT '{}',
  pushed_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'never' CHECK (sync_status IN ('never','ok','failed')),
  sync_error TEXT,
  synced_at TEXT
);

CREATE TABLE integration_cache (
  cache_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_integration_cache_expiry ON integration_cache(expires_at);

CREATE TABLE integration_syncs (
  integration TEXT PRIMARY KEY,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
