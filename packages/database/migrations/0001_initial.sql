PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'organization',
  relationship_label TEXT,
  description TEXT NOT NULL DEFAULT '',
  subdomain TEXT UNIQUE,
  logo_url TEXT,
  contact_route TEXT,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  legal_name TEXT,
  biography TEXT NOT NULL DEFAULT '',
  profile_image_url TEXT,
  availability TEXT,
  contact_route TEXT,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(person_id, organization_id, role_label)
);

CREATE TABLE external_links (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('person','organization','project')),
  owner_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'website',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_external_links_owner ON external_links(owner_type, owner_id);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in-development',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  highlighted INTEGER NOT NULL DEFAULT 0 CHECK (highlighted IN (0,1)),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  experimental INTEGER NOT NULL DEFAULT 0 CHECK (experimental IN (0,1)),
  repository_url TEXT,
  release_url TEXT,
  documentation_url TEXT,
  hero_media_id TEXT,
  seo_title TEXT,
  seo_description TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX idx_projects_featured ON projects(featured, highlighted, pinned);

CREATE TABLE project_people (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  credit_label TEXT NOT NULL DEFAULT 'Creator',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(project_id, person_id, credit_label)
);

CREATE TABLE project_metrics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  qualifier TEXT,
  status TEXT NOT NULL CHECK (status IN ('measured','provisional','historical','target')),
  source TEXT,
  source_url TEXT,
  measured_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, metric_key)
);
CREATE INDEX idx_project_metrics_project ON project_metrics(project_id, updated_at DESC);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  pricing_model TEXT,
  availability TEXT,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('announcement','project-update','engineering-note','release','research','studio-news','creator-update')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  hero_media_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  seo_title TEXT,
  seo_description TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_posts_publication ON posts(status, published_at DESC);
CREATE INDEX idx_posts_project ON posts(project_id, published_at DESC);

CREATE TABLE post_authors (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(post_id, person_id)
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  requester_email_normalized TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_organization TEXT,
  inquiry_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  related_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  related_service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  preferred_team TEXT,
  budget_range TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','assigned','awaiting_staff','awaiting_client','resolved','closed','archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  requester_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_response_at TEXT
);
CREATE INDEX idx_tickets_requester_active ON tickets(requester_email_normalized, status);
CREATE INDEX idx_tickets_queue ON tickets(status, priority, updated_at DESC);

CREATE TABLE ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('client','staff','system')),
  author_id TEXT,
  body TEXT NOT NULL,
  safe_email_preview TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at TEXT
);
CREATE INDEX idx_ticket_messages_timeline ON ticket_messages(ticket_id, created_at, id);

CREATE TABLE ticket_participants (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('client','staff')),
  participant_key TEXT NOT NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ticket_id, kind, participant_key)
);

CREATE TABLE ticket_assignments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  staff_email TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT
);
CREATE INDEX idx_ticket_assignments_active ON ticket_assignments(ticket_id, active);

CREATE TABLE ticket_status_events (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ticket_status_history ON ticket_status_events(ticket_id, created_at);

CREATE TABLE ticket_internal_notes (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  staff_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at TEXT
);
CREATE INDEX idx_ticket_notes ON ticket_internal_notes(ticket_id, created_at);

CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email_verification_expiry ON email_verifications(expires_at);

CREATE TABLE ticket_access_sessions (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ticket_sessions_ticket ON ticket_access_sessions(ticket_id, expires_at);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES ticket_messages(id) ON DELETE CASCADE,
  media_id TEXT REFERENCES media(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'client' CHECK (visibility IN ('client','internal')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_roles (
  id TEXT PRIMARY KEY,
  staff_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','administrator','editor','support','creator')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_email, role, organization_id)
);
CREATE INDEX idx_staff_roles_email ON staff_roles(staff_email);

CREATE TABLE canned_responses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_email TEXT,
  actor_kind TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_recent ON audit_events(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id, created_at DESC);

CREATE TABLE site_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rate_limit_events (
  key_hash TEXT NOT NULL,
  bucket TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_rate_limit_key_time ON rate_limit_events(key_hash, bucket, occurred_at);
