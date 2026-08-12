PRAGMA foreign_keys = ON;

-- Third-pass relationship management. Existing project.organization_id remains the
-- primary/owning organization; these tables add deliberate many-to-many credits.
ALTER TABLE memberships ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1));
CREATE UNIQUE INDEX idx_memberships_primary_org ON memberships(person_id) WHERE is_primary = 1;

CREATE TABLE project_organizations (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  credit_label TEXT NOT NULL DEFAULT 'Organization',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id, organization_id, credit_label)
);
CREATE INDEX idx_project_organizations_org ON project_organizations(organization_id, sort_order, project_id);

CREATE TABLE organization_relationships (
  source_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relationship_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(source_organization_id, target_organization_id, relationship_label),
  CHECK (source_organization_id <> target_organization_id)
);
CREATE INDEX idx_organization_relationships_target ON organization_relationships(target_organization_id, sort_order);

CREATE TABLE project_relationships (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  related_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  relationship_label TEXT NOT NULL DEFAULT 'Related project',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id, related_project_id, relationship_label),
  CHECK (project_id <> related_project_id)
);
CREATE INDEX idx_project_relationships_related ON project_relationships(related_project_id, sort_order);

-- Public CMS media is intentionally separate from the ticket `media`/`attachments`
-- system. Ticket files remain private and are never selectable as public content.
CREATE TABLE content_media (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  sha256 TEXT NOT NULL UNIQUE,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT,
  focal_x REAL CHECK (focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 1)),
  focal_y REAL CHECK (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 1)),
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_content_media_created ON content_media(created_at DESC);
CREATE INDEX idx_content_media_filename ON content_media(original_filename);

CREATE TABLE content_media_usage (
  media_id TEXT NOT NULL REFERENCES content_media(id) ON DELETE RESTRICT,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('person','organization','project','post','service','setting')),
  owner_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(media_id, owner_type, owner_id, field_name)
);
CREATE INDEX idx_content_media_usage_owner ON content_media_usage(owner_type, owner_id);

-- Canned staff replies remain drafts until a staff member explicitly sends a
-- normal canonical ticket message.
ALTER TABLE canned_responses ADD COLUMN category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE canned_responses ADD COLUMN visibility TEXT NOT NULL DEFAULT 'staff' CHECK (visibility IN ('staff','organization','team'));
ALTER TABLE canned_responses ADD COLUMN organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE canned_responses ADD COLUMN team TEXT;
ALTER TABLE canned_responses ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1));
ALTER TABLE canned_responses ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE canned_responses ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX idx_canned_responses_active ON canned_responses(active, sort_order, title);

-- Request IDs make mutation audit trails easier to correlate without storing
-- secrets or raw authorization material.
ALTER TABLE audit_events ADD COLUMN request_id TEXT;
CREATE INDEX idx_audit_request_id ON audit_events(request_id);

-- Privacy operations are recorded independently from the immutable security/audit
-- trail so requester exports/anonymization can be tracked without erasing evidence.
CREATE TABLE privacy_operations (
  id TEXT PRIMARY KEY,
  requester_email_hash TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('export','session-close','cleanup','anonymize','delete-attachments')),
  status TEXT NOT NULL CHECK (status IN ('started','completed','partial','failed')),
  actor_email TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX idx_privacy_operations_recent ON privacy_operations(created_at DESC);
