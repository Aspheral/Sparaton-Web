import { HttpError, requireAdmin } from './access';
import type { Env } from './env';
import { randomId } from './security';

const STAFF_ROLES = ['owner', 'administrator', 'editor', 'support', 'creator'];
const MANAGE_ROLES = ['owner', 'administrator', 'editor'];

type CannedRow = { id:string; title:string; body:string; category:string; visibility:string; organization_id:string|null; team:string|null; active:number; sort_order:number; created_by:string; created_at:string; updated_at:string };

export async function adminCannedResponses(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env, request.method === 'GET' ? STAFF_ROLES : MANAGE_ROLES);
  if (request.method === 'GET') {
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === '1' && (admin.roles.has('owner') || admin.roles.has('administrator') || admin.roles.has('editor'));
    const rows = (await env.DB.prepare(`SELECT * FROM canned_responses ${includeInactive ? '' : 'WHERE active=1'} ORDER BY sort_order,title`).all<CannedRow>()).results;
    return json({ items: rows.map(publicFields) });
  }
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const data = await request.json<Record<string, unknown>>();
  const id = text(data.id, 120) || randomId('can');
  const title = required(data.title, 160);
  const body = required(data.body, 12000);
  const visibility = text(data.visibility, 32) || 'staff';
  if (!['staff','organization','team'].includes(visibility)) throw new HttpError(400, 'Invalid canned-response visibility');
  const organizationId = nullable(data.organizationId, 120);
  const team = nullable(data.team, 120);
  if (visibility === 'organization' && !organizationId) throw new HttpError(400, 'Organization visibility requires an organization');
  if (visibility === 'team' && !team) throw new HttpError(400, 'Team visibility requires a team');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO canned_responses(id,title,body,created_by,category,visibility,organization_id,team,active,sort_order,created_at,updated_at)
      VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,category=excluded.category,visibility=excluded.visibility,organization_id=excluded.organization_id,team=excluded.team,active=excluded.active,sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP`).bind(id,title,body,admin.email,text(data.category,80)||'general',visibility,organizationId,team,truthy(data.active,true)?1:0,integer(data.sortOrder)),
    audit(env,request,admin.email,'ticket.canned_response.saved',id,{title,visibility,organizationId,team})
  ]);
  const row=await env.DB.prepare('SELECT * FROM canned_responses WHERE id=?1').bind(id).first<CannedRow>();
  return json({item:publicFields(row!)},201);
}

export async function adminDeleteCannedResponse(request: Request, env: Env, id: string): Promise<Response> {
  const admin = await requireAdmin(request, env, ['owner','administrator']);
  const row = await env.DB.prepare('SELECT title FROM canned_responses WHERE id=?1').bind(id).first<{title:string}>();
  if (!row) throw new HttpError(404, 'Canned response not found');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM canned_responses WHERE id=?1').bind(id),
    audit(env,request,admin.email,'ticket.canned_response.deleted',id,{title:row.title})
  ]);
  return json({deleted:true,id});
}

function publicFields(row:CannedRow){return{id:row.id,title:row.title,body:row.body,category:row.category,visibility:row.visibility,organizationId:row.organization_id,team:row.team,active:Boolean(row.active),sortOrder:row.sort_order,createdBy:row.created_by,createdAt:row.created_at,updatedAt:row.updated_at};}
function text(value:unknown,max:number){return(typeof value==='string'?value.trim():'').slice(0,max);}
function required(value:unknown,max:number){const result=text(value,max);if(!result)throw new HttpError(400,'Required field missing');return result;}
function nullable(value:unknown,max:number){return text(value,max)||null;}
function integer(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.trunc(n):0;}
function truthy(value:unknown,fallback=false){if(value===undefined)return fallback;return value===true||value===1||value==='1'||value==='true'||value==='on';}
function audit(env:Env,request:Request,email:string,action:string,id:string,metadata:unknown){return env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json,request_id) VALUES(?1,?2,'staff',?3,'canned_response',?4,?5,?6)").bind(randomId('aud'),email,action,id,JSON.stringify(metadata),request.headers.get('x-sparaton-request-id'));}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
