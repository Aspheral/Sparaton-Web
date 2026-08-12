export type ProjectStatus =
  | 'active'
  | 'stable'
  | 'research'
  | 'archived'
  | 'private'
  | 'discontinued'
  | 'in-development';

export type ProjectFlag = 'featured' | 'highlighted' | 'pinned' | 'experimental';
export type MetricStatus = 'measured' | 'provisional' | 'historical' | 'target';

export interface ProjectMetric {
  key: string;
  label: string;
  value: string;
  qualifier?: string;
  status: MetricStatus;
  updatedAt?: string;
  source?: string;
}

export interface ProjectRecord {
  name: string;
  slug: string;
  organization: string;
  creators: string[];
  summary: string;
  status: ProjectStatus;
  flags: ProjectFlag[];
  categories: string[];
  technologies: string[];
  repository?: string;
  releaseUrl?: string;
  documentationUrl?: string;
  metrics: ProjectMetric[];
}

export type TicketStatus =
  | 'new'
  | 'open'
  | 'assigned'
  | 'awaiting_staff'
  | 'awaiting_client'
  | 'resolved'
  | 'closed'
  | 'archived';

export type StaffRole = 'owner' | 'administrator' | 'editor' | 'support' | 'creator';
