import { requireAdmin, HttpError } from './access';
import type { Env } from './env';
import { notifyClient } from './notifications';
import { randomId } from './security';

const STAFF_ROLES=['owner','administrator','editor','support','creator'];
const MANAGE_ROLES=['owner','administrator','support'];
const TICKET_STATUSES=['new','open','assigned','awaiting_staff','awaiting_client','resolved','closed','archived'] as const;
const PRIORITIES=['low','normal','high','urgent'] as const;

export async function adminOverview(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,STAFF_ROLES);
  const counts=await env.DB.prepare("SELECT SUM(CASE WHEN status NOT IN ('resolved','closed','archived') THEN 1 ELSE 0 END) AS open_count,SUM(CASE WHEN status='awaiting_staff' THEN 1 ELSE 0 END) AS waiting_count FROM tickets").first<{open_count:number|null;waiting_count:number|null}>();
  const recent=await env.DB.prepare("SELECT public_id,subject,status,priority,requester_name,updated_at FROM tickets ORDER BY updated_at DESC LIMIT 8").all();
  const syncs=await env.DB.prepare('SELECT integration,last_attempt_at,last_success_at,last_error,updated_at FROM integration_syncs ORDER BY integration').all();
  const recentErrors=await env.DB.prepare("SELECT action,entity_type,entity_id,created_at FROM audit_events WHERE actor_kind='system' AND action LIKE '%failed%' ORDER BY created_at DESC LIMIT 8").all();
  let database=true;
  try{await env.DB.prepare('SELECT 1 AS ok').first();}catch{database=false;}
  return json({
    tickets:{open:counts?.open_count??0,waiting:counts?.waiting_count??0,recent:recent.results},
    integrations:{
      database,
      durableObjects:Boolean(env.TICKET_ROOMS),
      email:Boolean(env.RESEND_API_KEY),
      analytics:Boolean(env.CLOUDFLARE_API_TOKEN&&env.CLOUDFLARE_ZONE_ID),
      attachments:Boolean(env.ATTACHMENTS),
      github:{configured:true,authenticated:Boolean(env.GITHUB_TOKEN)}
    },
    syncs:syncs.results,
    recentErrors:recentErrors.results
  });
}

export async function adminTickets(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,STAFF_ROLES);
  const url=new URL(request.url),query=(url.searchParams.get('q')??'').trim(),status=(url.searchParams.get('status')??'').trim();
  const where:string[]=[];const binds:unknown[]=[];
  if(query){binds.push(`%${query}%`);where.push(`(t.subject LIKE ?${binds.length} OR t.requester_email_normalized LIKE ?${binds.length} OR t.requester_name LIKE ?${binds.length})`);}
  if(status&&TICKET_STATUSES.includes(status as typeof TICKET_STATUSES[number])){binds.push(status);where.push(`t.status=?${binds.length}`);}
  const sql=`SELECT t.id,t.public_id,t.requester_name,t.requester_email_normalized,t.inquiry_type,t.subject,t.status,t.priority,t.created_at,t.updated_at,t.last_response_at,p.name AS project_name,s.name AS service_name,(SELECT staff_email FROM ticket_assignments a WHERE a.ticket_id=t.id AND a.active=1 ORDER BY a.created_at DESC LIMIT 1) AS assigned_staff FROM tickets t LEFT JOIN projects p ON p.id=t.related_project_id LEFT JOIN services s ON s.id=t.related_service_id ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,t.updated_at DESC LIMIT 100`;
  const stmt=binds.length?env.DB.prepare(sql).bind(...binds):env.DB.prepare(sql);
  return json({tickets:(await stmt.all()).results});
}

export async function adminTicketDetail(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,STAFF_ROLES);
  const ticket=await getTicketRecord(env,publicId);
  await env.DB.prepare("INSERT INTO ticket_participants(id,ticket_id,kind,participant_key,unread_count,last_read_at) VALUES(?1,?2,'staff',?3,0,CURRENT_TIMESTAMP) ON CONFLICT(ticket_id,kind,participant_key) DO UPDATE SET unread_count=0,last_read_at=CURRENT_TIMESTAMP").bind(randomId('par'),ticket.id,admin.email).run();
  const [messages,notes,statusHistory,assignments,tags,audit,notifications]=await Promise.all([
    env.DB.prepare('SELECT id,author_kind,author_id,body,created_at,edited_at FROM ticket_messages WHERE ticket_id=?1 ORDER BY created_at,id').bind(ticket.id).all(),
    env.DB.prepare('SELECT id,staff_email,body,created_at,edited_at FROM ticket_internal_notes WHERE ticket_id=?1 ORDER BY created_at,id').bind(ticket.id).all(),
    env.DB.prepare('SELECT previous_status,next_status,actor_kind,actor_id,created_at FROM ticket_status_events WHERE ticket_id=?1 ORDER BY created_at,id').bind(ticket.id).all(),
    env.DB.prepare('SELECT id,staff_email,assigned_by,active,created_at,ended_at FROM ticket_assignments WHERE ticket_id=?1 ORDER BY created_at DESC').bind(ticket.id).all(),
    env.DB.prepare('SELECT id,tag,created_by,created_at FROM ticket_tags WHERE ticket_id=?1 ORDER BY tag').bind(ticket.id).all(),
    env.DB.prepare("SELECT actor_email,actor_kind,action,metadata_json,created_at FROM audit_events WHERE entity_type='ticket' AND entity_id=?1 ORDER BY created_at DESC LIMIT 100").bind(ticket.id).all(),
    env.DB.prepare('SELECT recipient_kind,recipient_key,status,provider,error_text,created_at,completed_at FROM ticket_notification_deliveries WHERE ticket_id=?1 ORDER BY created_at DESC LIMIT 50').bind(ticket.id).all()
  ]);
  const room=env.TICKET_ROOMS.get(env.TICKET_ROOMS.idFromName(publicId));
  const presence=await (await room.fetch('https://room/presence')).json<{client:number;staff:number}>();
  return json({ticket,messages:messages.results,notes:notes.results,statusHistory:statusHistory.results,assignments:assignments.results,tags:tags.results,audit:audit.results,notifications:notifications.results,presence});
}

export async function adminReply(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,STAFF_ROLES),ticket=await getTicketRecord(env,publicId);
  if(['closed','archived'].includes(ticket.status))throw new HttpError(409,'Reopen this ticket before replying');
  const data=await request.json<{body?:unknown}>(),body=clean(data.body,12000,true),messageId=randomId('msg'),previous=ticket.status;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ticket_messages(id,ticket_id,author_kind,author_id,body,safe_email_preview) VALUES(?1,?2,'staff',?3,?4,?5)").bind(messageId,ticket.id,admin.email,body,safePreview(body)),
    env.DB.prepare("UPDATE tickets SET status='awaiting_client',updated_at=CURRENT_TIMESTAMP,last_response_at=CURRENT_TIMESTAMP WHERE id=?1").bind(ticket.id),
    env.DB.prepare("INSERT INTO ticket_status_events(id,ticket_id,previous_status,next_status,actor_kind,actor_id) VALUES(?1,?2,?3,'awaiting_client','staff',?4)").bind(randomId('evt'),ticket.id,previous,admin.email),
    env.DB.prepare("UPDATE ticket_participants SET unread_count=unread_count+1 WHERE ticket_id=?1 AND kind='client'").bind(ticket.id),
    auditStatement(env,admin.email,'ticket.reply',ticket.id,{messageId})
  ]);
  const room=env.TICKET_ROOMS.get(env.TICKET_ROOMS.idFromName(publicId));
  await room.fetch('https://room/broadcast',{method:'POST',body:JSON.stringify({type:'message',message:{id:messageId,author_kind:'staff',body,created_at:new Date().toISOString()}})});
  const presence=await (await room.fetch('https://room/presence')).json<{client:number}>();
  await notifyClient(env,{ticketId:ticket.id,publicId,messageId,subject:ticket.subject,preview:safePreview(body),email:ticket.requester_email_normalized,clientOnline:presence.client>0});
  return json({id:messageId,clientOnline:presence.client>0},201);
}

export async function adminInternalNote(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,STAFF_ROLES),ticket=await getTicketRecord(env,publicId),data=await request.json<{body?:unknown}>(),body=clean(data.body,12000,true),id=randomId('note');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO ticket_internal_notes(id,ticket_id,staff_email,body) VALUES(?1,?2,?3,?4)').bind(id,ticket.id,admin.email,body),
    auditStatement(env,admin.email,'ticket.internal_note.added',ticket.id,{noteId:id})
  ]);
  return json({id},201);
}

export async function adminAssign(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,MANAGE_ROLES),ticket=await getTicketRecord(env,publicId),data=await request.json<{staffEmail?:unknown}>(),staffEmail=clean(data.staffEmail,254,true).toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(staffEmail))throw new HttpError(400,'Enter a valid staff email');
  const ownerEmails=new Set((env.ADMIN_OWNER_EMAILS??'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
  const staff=await env.DB.prepare('SELECT COUNT(*) AS count FROM staff_roles WHERE staff_email=?1').bind(staffEmail).first<{count:number}>();
  if((staff?.count??0)===0&&!ownerEmails.has(staffEmail))throw new HttpError(400,'That identity does not have a Sparaton staff role');
  const assignmentId=randomId('asg'),nextStatus=ticket.status==='new'||ticket.status==='open'?'assigned':ticket.status;
  const statements=[
    env.DB.prepare('UPDATE ticket_assignments SET active=0,ended_at=CURRENT_TIMESTAMP WHERE ticket_id=?1 AND active=1').bind(ticket.id),
    env.DB.prepare('INSERT INTO ticket_assignments(id,ticket_id,staff_email,assigned_by) VALUES(?1,?2,?3,?4)').bind(assignmentId,ticket.id,staffEmail,admin.email),
    env.DB.prepare("INSERT INTO ticket_participants(id,ticket_id,kind,participant_key) VALUES(?1,?2,'staff',?3) ON CONFLICT(ticket_id,kind,participant_key) DO NOTHING").bind(randomId('par'),ticket.id,staffEmail),
    auditStatement(env,admin.email,'ticket.assignment.changed',ticket.id,{assignmentId,staffEmail})
  ];
  if(nextStatus!==ticket.status){statements.push(env.DB.prepare('UPDATE tickets SET status=?1,updated_at=CURRENT_TIMESTAMP WHERE id=?2').bind(nextStatus,ticket.id),env.DB.prepare("INSERT INTO ticket_status_events(id,ticket_id,previous_status,next_status,actor_kind,actor_id) VALUES(?1,?2,?3,?4,'staff',?5)").bind(randomId('evt'),ticket.id,ticket.status,nextStatus,admin.email));}
  await env.DB.batch(statements);
  return json({assignedStaff:staffEmail,status:nextStatus});
}

export async function adminUpdateTicket(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,MANAGE_ROLES),ticket=await getTicketRecord(env,publicId),data=await request.json<{status?:unknown;priority?:unknown}>();
  const status=typeof data.status==='string'?data.status:'';const priority=typeof data.priority==='string'?data.priority:'';
  if(!status&&!priority)throw new HttpError(400,'No ticket change supplied');
  if(status&&!TICKET_STATUSES.includes(status as typeof TICKET_STATUSES[number]))throw new HttpError(400,'Invalid ticket status');
  if(priority&&!PRIORITIES.includes(priority as typeof PRIORITIES[number]))throw new HttpError(400,'Invalid ticket priority');
  if(status==='archived'&&!admin.roles.has('owner')&&!admin.roles.has('administrator'))throw new HttpError(403,'Only administrators may archive tickets');
  const nextStatus=status||ticket.status,nextPriority=priority||ticket.priority;
  await env.DB.batch([
    env.DB.prepare('UPDATE tickets SET status=?1,priority=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?3').bind(nextStatus,nextPriority,ticket.id),
    ...(nextStatus!==ticket.status?[env.DB.prepare("INSERT INTO ticket_status_events(id,ticket_id,previous_status,next_status,actor_kind,actor_id) VALUES(?1,?2,?3,?4,'staff',?5)").bind(randomId('evt'),ticket.id,ticket.status,nextStatus,admin.email)]:[]),
    auditStatement(env,admin.email,'ticket.updated',ticket.id,{previousStatus:ticket.status,status:nextStatus,previousPriority:ticket.priority,priority:nextPriority})
  ]);
  return json({status:nextStatus,priority:nextPriority});
}

export async function adminTag(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,STAFF_ROLES),ticket=await getTicketRecord(env,publicId),data=await request.json<{tag?:unknown;remove?:unknown}>(),tag=clean(data.tag,48,true).toLowerCase().replace(/\s+/g,'-');
  if(!/^[a-z0-9][a-z0-9-]{0,47}$/.test(tag))throw new HttpError(400,'Tag may contain letters, numbers, and hyphens');
  if(data.remove===true){await env.DB.prepare('DELETE FROM ticket_tags WHERE ticket_id=?1 AND tag=?2').bind(ticket.id,tag).run();}
  else{await env.DB.prepare('INSERT INTO ticket_tags(id,ticket_id,tag,created_by) VALUES(?1,?2,?3,?4) ON CONFLICT(ticket_id,tag) DO NOTHING').bind(randomId('tag'),ticket.id,tag,admin.email).run();}
  await auditStatement(env,admin.email,data.remove===true?'ticket.tag.removed':'ticket.tag.added',ticket.id,{tag}).run();
  return json({tag,removed:data.remove===true});
}

export async function adminTicketSocket(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,STAFF_ROLES);await getTicketRecord(env,publicId);
  const room=env.TICKET_ROOMS.get(env.TICKET_ROOMS.idFromName(publicId)),headers=new Headers(request.headers);headers.set('x-sparaton-role','staff');headers.set('x-sparaton-participant',admin.email);
  return room.fetch(new Request('https://room/connect',{headers}));
}

async function getTicketRecord(env:Env,publicId:string){
  const row=await env.DB.prepare('SELECT t.*,p.name AS project_name,s.name AS service_name FROM tickets t LEFT JOIN projects p ON p.id=t.related_project_id LEFT JOIN services s ON s.id=t.related_service_id WHERE t.public_id=?1').bind(publicId).first<Record<string,unknown>&{id:string;status:string;priority:string;subject:string;requester_email_normalized:string}>();
  if(!row)throw new HttpError(404,'Ticket not found');return row;
}
function clean(value:unknown,max:number,required:boolean){const result=typeof value==='string'?value.trim():'';if(required&&!result)throw new HttpError(400,'Required field missing');if(result.length>max)throw new HttpError(400,'Field is too long');return result;}
function safePreview(body:string){return body.replace(/\s+/g,' ').slice(0,240);}
function auditStatement(env:Env,email:string,action:string,ticketId:string,metadata:unknown){return env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json) VALUES(?1,?2,'staff',?3,'ticket',?4,?5)").bind(randomId('aud'),email,action,ticketId,JSON.stringify(metadata));}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
