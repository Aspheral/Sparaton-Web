import { HttpError, requireAdmin } from './access';
import type { Env } from './env';
import { randomId } from './security';

const EDIT_ROLES = ['owner', 'administrator', 'editor'];
type RelationshipKind = 'people' | 'organizations' | 'projects';

export async function adminRelationships(request: Request, env: Env, kind: string, id: string): Promise<Response> {
  const admin = await requireAdmin(request, env, EDIT_ROLES);
  const valid = asKind(kind);
  await assertEntity(env, valid, id);
  if (request.method === 'GET') return readRelationships(env, valid, id);
  if (request.method !== 'PUT') throw new HttpError(405, 'Method not allowed');
  const data = await request.json<Record<string, unknown>>();
  if (valid === 'people') await savePersonRelationships(env, id, data);
  else if (valid === 'organizations') await saveOrganizationRelationships(env, id, data);
  else await saveProjectRelationships(env, id, data);
  await audit(env, request, admin.email, `cms.${valid}.relationships.updated`, valid, id, summarize(data));
  return readRelationships(env, valid, id);
}

async function readRelationships(env: Env, kind: RelationshipKind, id: string): Promise<Response> {
  const choices = {
    people: (await env.DB.prepare('SELECT id,display_name AS name,slug FROM people ORDER BY sort_order,display_name').all()).results,
    organizations: (await env.DB.prepare('SELECT id,name,slug FROM organizations ORDER BY sort_order,name').all()).results,
    projects: (await env.DB.prepare('SELECT id,name,slug FROM projects ORDER BY name').all()).results
  };
  const current: Record<string, unknown> = {};
  if (kind === 'people') {
    current.memberships = (await env.DB.prepare('SELECT organization_id AS organizationId,role_label AS role,is_public AS isPublic,sort_order AS sortOrder,is_primary AS isPrimary FROM memberships WHERE person_id=?1 ORDER BY sort_order,role_label').bind(id).all()).results;
    current.projects = (await env.DB.prepare('SELECT project_id AS projectId,credit_label AS credit,sort_order AS sortOrder FROM project_people WHERE person_id=?1 ORDER BY sort_order,credit_label').bind(id).all()).results;
    current.links = await links(env, 'person', id);
  } else if (kind === 'organizations') {
    current.members = (await env.DB.prepare('SELECT person_id AS personId,role_label AS role,is_public AS isPublic,sort_order AS sortOrder,is_primary AS isPrimary FROM memberships WHERE organization_id=?1 ORDER BY sort_order,role_label').bind(id).all()).results;
    current.projects = (await env.DB.prepare('SELECT project_id AS projectId,credit_label AS credit,sort_order AS sortOrder FROM project_organizations WHERE organization_id=?1 ORDER BY sort_order,credit_label').bind(id).all()).results;
    current.organizations = (await env.DB.prepare('SELECT target_organization_id AS organizationId,relationship_label AS label,sort_order AS sortOrder FROM organization_relationships WHERE source_organization_id=?1 ORDER BY sort_order,relationship_label').bind(id).all()).results;
    current.links = await links(env, 'organization', id);
  } else {
    current.people = (await env.DB.prepare('SELECT person_id AS personId,credit_label AS credit,sort_order AS sortOrder FROM project_people WHERE project_id=?1 ORDER BY sort_order,credit_label').bind(id).all()).results;
    current.organizations = (await env.DB.prepare('SELECT organization_id AS organizationId,credit_label AS credit,sort_order AS sortOrder FROM project_organizations WHERE project_id=?1 ORDER BY sort_order,credit_label').bind(id).all()).results;
    current.relatedProjects = (await env.DB.prepare('SELECT related_project_id AS projectId,relationship_label AS label,sort_order AS sortOrder FROM project_relationships WHERE project_id=?1 ORDER BY sort_order,relationship_label').bind(id).all()).results;
    current.links = await links(env, 'project', id);
  }
  return json({ kind, id, current, choices });
}

async function savePersonRelationships(env: Env, personId: string, data: Record<string, unknown>) {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM memberships WHERE person_id=?1').bind(personId),
    env.DB.prepare('DELETE FROM project_people WHERE person_id=?1').bind(personId),
    env.DB.prepare("DELETE FROM external_links WHERE owner_type='person' AND owner_id=?1").bind(personId)
  ];
  const primarySeen = { value: false };
  for (const row of uniqueRows(data.memberships, value => `${text(value.organizationId, 120)}\u0000${text(value.role, 160)}`)) {
    const organizationId = text(row.organizationId, 120);
    const role = text(row.role, 160);
    if (!organizationId || !role) continue;
    const isPrimary = truthy(row.isPrimary) && !primarySeen.value;
    if (isPrimary) primarySeen.value = true;
    statements.push(env.DB.prepare('INSERT INTO memberships(id,person_id,organization_id,role_label,is_public,sort_order,is_primary) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(randomId('mem'), personId, organizationId, role, truthy(row.isPublic, true) ? 1 : 0, integer(row.sortOrder), isPrimary ? 1 : 0));
  }
  for (const row of uniqueRows(data.projects, value => `${text(value.projectId, 120)}\u0000${text(value.credit, 120) || 'Creator'}`)) {
    const projectId = text(row.projectId, 120);
    if (!projectId) continue;
    statements.push(env.DB.prepare('INSERT INTO project_people(project_id,person_id,credit_label,sort_order) VALUES(?1,?2,?3,?4)').bind(projectId, personId, text(row.credit, 120) || 'Creator', integer(row.sortOrder)));
  }
  addLinks(statements, env, 'person', personId, data.links);
  await env.DB.batch(statements);
}

async function saveOrganizationRelationships(env: Env, organizationId: string, data: Record<string, unknown>) {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM memberships WHERE organization_id=?1').bind(organizationId),
    env.DB.prepare('DELETE FROM project_organizations WHERE organization_id=?1').bind(organizationId),
    env.DB.prepare('DELETE FROM organization_relationships WHERE source_organization_id=?1').bind(organizationId),
    env.DB.prepare("DELETE FROM external_links WHERE owner_type='organization' AND owner_id=?1").bind(organizationId)
  ];
  for (const row of uniqueRows(data.members, value => `${text(value.personId, 120)}\u0000${text(value.role, 160)}`)) {
    const personId = text(row.personId, 120);
    const role = text(row.role, 160);
    if (!personId || !role) continue;
    statements.push(env.DB.prepare('INSERT INTO memberships(id,person_id,organization_id,role_label,is_public,sort_order,is_primary) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(randomId('mem'), personId, organizationId, role, truthy(row.isPublic, true) ? 1 : 0, integer(row.sortOrder), truthy(row.isPrimary) ? 1 : 0));
  }
  for (const row of uniqueRows(data.projects, value => `${text(value.projectId, 120)}\u0000${text(value.credit, 120) || 'Organization'}`)) {
    const projectId = text(row.projectId, 120);
    if (!projectId) continue;
    statements.push(env.DB.prepare('INSERT INTO project_organizations(project_id,organization_id,credit_label,sort_order) VALUES(?1,?2,?3,?4)').bind(projectId, organizationId, text(row.credit, 120) || 'Organization', integer(row.sortOrder)));
  }
  for (const row of uniqueRows(data.organizations, value => `${text(value.organizationId, 120)}\u0000${text(value.label, 160)}`)) {
    const targetId = text(row.organizationId, 120);
    const label = text(row.label, 160);
    if (!targetId || targetId === organizationId || !label) continue;
    statements.push(env.DB.prepare('INSERT INTO organization_relationships(source_organization_id,target_organization_id,relationship_label,sort_order) VALUES(?1,?2,?3,?4)').bind(organizationId, targetId, label, integer(row.sortOrder)));
  }
  addLinks(statements, env, 'organization', organizationId, data.links);
  await env.DB.batch(statements);
}

async function saveProjectRelationships(env: Env, projectId: string, data: Record<string, unknown>) {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM project_people WHERE project_id=?1').bind(projectId),
    env.DB.prepare('DELETE FROM project_organizations WHERE project_id=?1').bind(projectId),
    env.DB.prepare('DELETE FROM project_relationships WHERE project_id=?1').bind(projectId),
    env.DB.prepare("DELETE FROM external_links WHERE owner_type='project' AND owner_id=?1").bind(projectId)
  ];
  for (const row of uniqueRows(data.people, value => `${text(value.personId, 120)}\u0000${text(value.credit, 120) || 'Creator'}`)) {
    const personId = text(row.personId, 120);
    if (!personId) continue;
    statements.push(env.DB.prepare('INSERT INTO project_people(project_id,person_id,credit_label,sort_order) VALUES(?1,?2,?3,?4)').bind(projectId, personId, text(row.credit, 120) || 'Creator', integer(row.sortOrder)));
  }
  for (const row of uniqueRows(data.organizations, value => `${text(value.organizationId, 120)}\u0000${text(value.credit, 120) || 'Organization'}`)) {
    const organizationId = text(row.organizationId, 120);
    if (!organizationId) continue;
    statements.push(env.DB.prepare('INSERT INTO project_organizations(project_id,organization_id,credit_label,sort_order) VALUES(?1,?2,?3,?4)').bind(projectId, organizationId, text(row.credit, 120) || 'Organization', integer(row.sortOrder)));
  }
  for (const row of uniqueRows(data.relatedProjects, value => `${text(value.projectId, 120)}\u0000${text(value.label, 160) || 'Related project'}`)) {
    const relatedId = text(row.projectId, 120);
    if (!relatedId || relatedId === projectId) continue;
    statements.push(env.DB.prepare('INSERT INTO project_relationships(project_id,related_project_id,relationship_label,sort_order) VALUES(?1,?2,?3,?4)').bind(projectId, relatedId, text(row.label, 160) || 'Related project', integer(row.sortOrder)));
  }
  addLinks(statements, env, 'project', projectId, data.links);
  await env.DB.batch(statements);
}

function addLinks(statements: D1PreparedStatement[], env: Env, ownerType: 'person' | 'organization' | 'project', ownerId: string, value: unknown) {
  let index = 0;
  for (const row of uniqueRows(value, item => `${text(item.kind, 80) || 'website'}\u0000${text(item.url, 1000)}`)) {
    const url = text(row.url, 1000);
    const label = text(row.label, 120);
    if (!url || !label || !/^https?:\/\//i.test(url)) continue;
    statements.push(env.DB.prepare('INSERT INTO external_links(id,owner_type,owner_id,label,url,kind,sort_order) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(randomId('lnk'), ownerType, ownerId, label, url, text(row.kind, 80) || 'website', integer(row.sortOrder, index++)));
  }
}

async function links(env: Env, ownerType: string, ownerId: string) {
  return (await env.DB.prepare('SELECT label,url,kind,sort_order AS sortOrder FROM external_links WHERE owner_type=?1 AND owner_id=?2 ORDER BY sort_order,label').bind(ownerType, ownerId).all()).results;
}

async function assertEntity(env: Env, kind: RelationshipKind, id: string) {
  const table = kind === 'people' ? 'people' : kind === 'organizations' ? 'organizations' : 'projects';
  const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE id=?1`).bind(id).first();
  if (!row) throw new HttpError(404, 'Content item not found');
}

function asKind(kind: string): RelationshipKind {
  if (kind !== 'people' && kind !== 'organizations' && kind !== 'projects') throw new HttpError(404, 'Relationship type not found');
  return kind;
}
function rows(value: unknown): Record<string, unknown>[] { return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[] : []; }
function uniqueRows(value: unknown, key: (row: Record<string, unknown>) => string) { const seen = new Set<string>(); return rows(value).filter(row => { const k = key(row); if (!k || seen.has(k)) return false; seen.add(k); return true; }); }
function text(value: unknown, max: number) { const result = typeof value === 'string' ? value.trim() : ''; return result.slice(0, max); }
function integer(value: unknown, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? Math.trunc(number) : fallback; }
function truthy(value: unknown, fallback = false) { if (value === undefined) return fallback; return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'; }
function summarize(data: Record<string, unknown>) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.length : undefined]).filter(([, value]) => value !== undefined)); }
async function audit(env: Env, request: Request, email: string, action: string, entityType: string, entityId: string, metadata: unknown) { await env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json,request_id) VALUES(?1,?2,'staff',?3,?4,?5,?6,?7)").bind(randomId('aud'), email, action, entityType, entityId, JSON.stringify(metadata), request.headers.get('x-sparaton-request-id')).run(); }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
