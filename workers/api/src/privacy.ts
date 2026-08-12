import { HttpError, requireAdmin } from './access';
import type { Env } from './env';
import { randomId } from './security';

const PRIVACY_ROLES=['owner','administrator'];

type RetentionConfig={verificationDays:number|null;sessionDaysAfterExpiry:number|null;attachmentDaysAfterClosure:number|null;auditDays:number|null;allowAnonymization:boolean;legalConfirmed:boolean};
const EMPTY_RETENTION:RetentionConfig={verificationDays:null,sessionDaysAfterExpiry:null,attachmentDaysAfterClosure:null,auditDays:null,allowAnonymization:false,legalConfirmed:false};

export async function adminPrivacyLookup(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,PRIVACY_ROLES);
  const email=normalizeEmail(new URL(request.url).searchParams.get('email'));
  if(!email)throw new HttpError(400,'A valid requester email is required');
  const tickets=(await env.DB.prepare(`SELECT id,public_id,requester_name,requester_organization,inquiry_type,subject,status,created_at,updated_at,last_response_at
    FROM tickets WHERE requester_email_normalized=?1 ORDER BY created_at DESC`).bind(email).all()).results;
  const hash=await emailHash(email);
  return json({emailHash:hash,ticketCount:tickets.length,tickets});
}

export async function adminPrivacyExport(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,PRIVACY_ROLES),data=await request.json<{email?:unknown}>(),email=normalizeEmail(data.email);
  if(!email)throw new HttpError(400,'A valid requester email is required');
  const hash=await emailHash(email),tickets=(await env.DB.prepare('SELECT * FROM tickets WHERE requester_email_normalized=?1 ORDER BY created_at').bind(email).all<Record<string,unknown>>()).results;
  const exported=[];
  for(const ticket of tickets){const id=String(ticket.id);exported.push({
    ticket:stripInternalTicketFields(ticket),
    messages:(await env.DB.prepare("SELECT id,author_kind,body,created_at,edited_at FROM ticket_messages WHERE ticket_id=?1 AND author_kind IN ('client','staff','system') ORDER BY created_at,id").bind(id).all()).results,
    attachments:(await env.DB.prepare("SELECT a.id,a.original_filename,a.created_at,m.mime_type,m.byte_size,m.sha256 FROM attachments a JOIN media m ON m.id=a.media_id WHERE a.ticket_id=?1 AND a.visibility='client' ORDER BY a.created_at").bind(id).all()).results,
    sessions:(await env.DB.prepare('SELECT id,expires_at,revoked_at,last_seen_at,created_at FROM ticket_access_sessions WHERE ticket_id=?1 ORDER BY created_at').bind(id).all()).results,
    verificationRecords:(await env.DB.prepare('SELECT id,expires_at,used_at,created_at FROM email_verifications WHERE ticket_id=?1 ORDER BY created_at').bind(id).all()).results
  });}
  await recordOperation(env,admin.email,hash,'export','completed',{ticketCount:tickets.length});
  await audit(env,request,admin.email,'privacy.requester.exported',hash,{ticketCount:tickets.length});
  return new Response(JSON.stringify({exportedAt:new Date().toISOString(),requesterEmail:email,tickets:exported},null,2),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="sparaton-requester-export-${hash.slice(0,12)}.json"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export async function adminPrivacyCloseSessions(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,PRIVACY_ROLES),data=await request.json<{email?:unknown}>(),email=normalizeEmail(data.email);
  if(!email)throw new HttpError(400,'A valid requester email is required');
  const hash=await emailHash(email);
  const result=await env.DB.prepare(`UPDATE ticket_access_sessions SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP)
    WHERE ticket_id IN (SELECT id FROM tickets WHERE requester_email_normalized=?1) AND revoked_at IS NULL`).bind(email).run();
  await recordOperation(env,admin.email,hash,'session-close','completed',{changed:result.meta.changes});
  await audit(env,request,admin.email,'privacy.requester.sessions_closed',hash,{changed:result.meta.changes});
  return json({closed:result.meta.changes,emailHash:hash});
}

export async function adminPrivacyCleanup(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,PRIVACY_ROLES);
  const verification=await env.DB.prepare('DELETE FROM email_verifications WHERE expires_at < CURRENT_TIMESTAMP').run();
  const sessions=await env.DB.prepare('DELETE FROM ticket_access_sessions WHERE expires_at < CURRENT_TIMESTAMP AND (revoked_at IS NOT NULL OR expires_at < datetime(CURRENT_TIMESTAMP,\'-7 days\'))').run();
  await recordOperation(env,admin.email,'system','cleanup','completed',{expiredVerificationRecords:verification.meta.changes,expiredSessions:sessions.meta.changes});
  await audit(env,request,admin.email,'privacy.expired_records.cleaned','privacy','expired-records',{expiredVerificationRecords:verification.meta.changes,expiredSessions:sessions.meta.changes});
  return json({expiredVerificationRecords:verification.meta.changes,expiredSessions:sessions.meta.changes,note:'Attachment and audit retention are not automatically applied until owner/legal retention settings are confirmed.'});
}

export async function adminPrivacyAnonymize(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,PRIVACY_ROLES),config=await retentionConfig(env),data=await request.json<Record<string,unknown>>(),email=normalizeEmail(data.email),confirm=normalizeEmail(data.confirmEmail);
  if(!email||confirm!==email)throw new HttpError(400,'Anonymization requires the requester email to be entered twice');
  if(!config.legalConfirmed||!config.allowAnonymization)throw new HttpError(409,'Requester anonymization is disabled until the owner/legal retention policy explicitly permits it');
  const active=await env.DB.prepare("SELECT COUNT(*) AS count FROM tickets WHERE requester_email_normalized=?1 AND status NOT IN ('resolved','closed','archived')").bind(email).first<{count:number}>();
  if((active?.count??0)>0)throw new HttpError(409,'Active tickets must be resolved or closed before requester anonymization');
  const hash=await emailHash(email),replacement=`deleted+${hash.slice(0,24)}@privacy.invalid`;
  const tickets=(await env.DB.prepare('SELECT id FROM tickets WHERE requester_email_normalized=?1').bind(email).all<{id:string}>()).results;
  if(!tickets.length)throw new HttpError(404,'Requester not found');
  const statements:D1PreparedStatement[]=[];
  for(const ticket of tickets){
    statements.push(env.DB.prepare("UPDATE tickets SET requester_email_normalized=?2,requester_name='Deleted requester',requester_organization=NULL,budget_range=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(ticket.id,replacement));
    statements.push(env.DB.prepare("UPDATE ticket_messages SET author_id=NULL,safe_email_preview=NULL WHERE ticket_id=?1 AND author_kind='client'").bind(ticket.id));
    statements.push(env.DB.prepare('DELETE FROM email_verifications WHERE ticket_id=?1').bind(ticket.id));
    statements.push(env.DB.prepare('DELETE FROM ticket_access_sessions WHERE ticket_id=?1').bind(ticket.id));
  }
  await env.DB.batch(statements);
  await recordOperation(env,admin.email,hash,'anonymize','completed',{ticketCount:tickets.length,messageBodiesRetained:true,auditTrailRetained:true});
  await audit(env,request,admin.email,'privacy.requester.anonymized',hash,{ticketCount:tickets.length,messageBodiesRetained:true,auditTrailRetained:true});
  return json({anonymized:true,emailHash:hash,ticketCount:tickets.length,note:'Requester identifiers and sessions were removed. Canonical conversation bodies and staff/security audit evidence were retained according to the configured policy boundary.'});
}

export async function adminRetentionSettings(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,PRIVACY_ROLES);
  if(request.method==='GET')return json({config:await retentionConfig(env),requiresOwnerLegalConfirmation:true});
  if(request.method!=='PUT')throw new HttpError(405,'Method not allowed');
  const data=await request.json<Record<string,unknown>>();
  const config:RetentionConfig={verificationDays:days(data.verificationDays),sessionDaysAfterExpiry:days(data.sessionDaysAfterExpiry),attachmentDaysAfterClosure:days(data.attachmentDaysAfterClosure),auditDays:days(data.auditDays),allowAnonymization:Boolean(data.allowAnonymization),legalConfirmed:Boolean(data.legalConfirmed)};
  await env.DB.batch([
    env.DB.prepare('INSERT INTO site_settings(key,value_json,updated_by,updated_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').bind('privacy.retention',JSON.stringify(config),admin.email),
    auditStatement(env,request,admin.email,'privacy.retention.updated','privacy.retention',{...config})
  ]);
  return json({config,requiresOwnerLegalConfirmation:!config.legalConfirmed});
}

async function retentionConfig(env:Env):Promise<RetentionConfig>{const row=await env.DB.prepare("SELECT value_json FROM site_settings WHERE key='privacy.retention'").first<{value_json:string}>();if(!row)return EMPTY_RETENTION;try{return{...EMPTY_RETENTION,...JSON.parse(row.value_json)};}catch{return EMPTY_RETENTION;}}
function stripInternalTicketFields(row:Record<string,unknown>){const out={...row};delete out.id;delete out.requester_email_normalized;return out;}
function normalizeEmail(value:unknown){const email=typeof value==='string'?value.trim().toLowerCase():'';return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'';}
function days(value:unknown){if(value===null||value===undefined||value==='')return null;const n=Number(value);if(!Number.isInteger(n)||n<0||n>36500)throw new HttpError(400,'Retention days must be blank or an integer between 0 and 36500');return n;}
async function emailHash(email:string){const bytes=new TextEncoder().encode(email);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function recordOperation(env:Env,actor:string,hash:string,operation:string,status:string,metadata:unknown){const id=randomId('priv');await env.DB.prepare('INSERT INTO privacy_operations(id,requester_email_hash,operation,status,actor_email,metadata_json,completed_at) VALUES(?1,?2,?3,?4,?5,?6,CURRENT_TIMESTAMP)').bind(id,hash,operation,status,actor,JSON.stringify(metadata)).run();}
function auditStatement(env:Env,request:Request,email:string,action:string,entityId:string,metadata:unknown){return env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json,request_id) VALUES(?1,?2,'staff',?3,'privacy',?4,?5,?6)").bind(randomId('aud'),email,action,entityId,JSON.stringify(metadata),request.headers.get('x-sparaton-request-id'));}
async function audit(env:Env,request:Request,email:string,action:string,entityId:string,metadata:unknown){await auditStatement(env,request,email,action,entityId,metadata).run();}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
