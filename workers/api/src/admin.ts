import type { Env } from './env';
import { HttpError, requireAdmin } from './access';
import { randomId } from './security';
import { ticketReplyEmail, ResendEmailProvider } from '@sparaton/email';

export async function adminOverview(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,['owner','administrator','editor','support','creator']);
  const [open,waiting,recent]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM tickets WHERE status IN ('new','open','assigned','awaiting_staff','awaiting_client')").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM tickets WHERE status='awaiting_staff'").first(),
    env.DB.prepare('SELECT public_id,requester_name,subject,status,priority,updated_at FROM tickets ORDER BY updated_at DESC LIMIT 10').all()
  ]);
  return json({tickets:{open:(open as {count?:number}|null)?.count??0,waiting:(waiting as {count?:number}|null)?.count??0,recent:recent.results},analytics:{configured:false,reason:'Cloudflare analytics credentials and query integration are not configured yet'}});
}

export async function adminTickets(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,['owner','administrator','support']); const url=new URL(request.url); const status=url.searchParams.get('status'); const search=url.searchParams.get('q')?.trim();
  let sql='SELECT public_id,requester_name,requester_email_normalized,subject,status,priority,created_at,updated_at,last_response_at FROM tickets'; const args:string[]=[]; const where:string[]=[];
  if(status){where.push(`status=?${args.length+1}`);args.push(status);} if(search){where.push(`(subject LIKE ?${args.length+1} OR requester_name LIKE ?${args.length+1} OR requester_email_normalized LIKE ?${args.length+1})`);args.push(`%${search}%`);} if(where.length)sql+=` WHERE ${where.join(' AND ')}`; sql+=' ORDER BY updated_at DESC LIMIT 100';
  const rows=await env.DB.prepare(sql).bind(...args).all(); return json({tickets:rows.results});
}

export async function adminReply(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,['owner','administrator','support']); const data=await request.json<{body?:unknown}>(); const body=typeof data.body==='string'?data.body.trim():''; if(!body||body.length>12000)throw new HttpError(400,'Invalid message');
  const ticket=await env.DB.prepare('SELECT id,requester_email_normalized,subject FROM tickets WHERE public_id=?1').bind(publicId).first<{id:string;requester_email_normalized:string;subject:string}>(); if(!ticket)throw new HttpError(404,'Ticket not found'); const id=randomId('msg');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO ticket_messages(id,ticket_id,author_kind,author_id,body,safe_email_preview) VALUES(?1,?2,\'staff\',?3,?4,?5)').bind(id,ticket.id,admin.email,body,safePreview(body)),
    env.DB.prepare('UPDATE tickets SET status=\'awaiting_client\',updated_at=CURRENT_TIMESTAMP,last_response_at=CURRENT_TIMESTAMP WHERE id=?1').bind(ticket.id),
    env.DB.prepare('UPDATE ticket_participants SET unread_count=unread_count+1 WHERE ticket_id=?1 AND kind=\'client\'').bind(ticket.id),
    audit(env,admin.email,'ticket.reply','ticket',ticket.id,{messageId:id})
  ]);
  const room=env.TICKET_ROOMS.get(env.TICKET_ROOMS.idFromName(publicId)); await room.fetch('https://room/broadcast',{method:'POST',body:JSON.stringify({type:'message',message:{id,author_kind:'staff',body,created_at:new Date().toISOString()}})}); const presence=await (await room.fetch('https://room/presence')).json<{clients:number}>();
  if(presence.clients===0&&env.RESEND_API_KEY){const provider=new ResendEmailProvider(env.RESEND_API_KEY);await provider.send({...ticketReplyEmail({from:env.EMAIL_FROM_TICKETS,to:ticket.requester_email_normalized,subject:ticket.subject,preview:safePreview(body),ticketUrl:`${env.STUDIOS_ORIGIN}/tickets/${publicId}`}),idempotencyKey:`reply-${id}`});}
  return json({id,clientOnline:presence.clients>0},201);
}

export async function adminInternalNote(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,['owner','administrator','support']); const data=await request.json<{body?:unknown}>();const body=typeof data.body==='string'?data.body.trim():'';if(!body||body.length>12000)throw new HttpError(400,'Invalid note'); const ticket=await env.DB.prepare('SELECT id FROM tickets WHERE public_id=?1').bind(publicId).first<{id:string}>();if(!ticket)throw new HttpError(404,'Ticket not found');const id=randomId('note');
  await env.DB.batch([env.DB.prepare('INSERT INTO ticket_internal_notes(id,ticket_id,staff_email,body) VALUES(?1,?2,?3,?4)').bind(id,ticket.id,admin.email,body),audit(env,admin.email,'ticket.note','ticket',ticket.id,{noteId:id})]); return json({id},201);
}

function audit(env:Env,actor:string,action:string,entityType:string,entityId:string,metadata:unknown){return env.DB.prepare('INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json) VALUES(?1,?2,\'staff\',?3,?4,?5,?6)').bind(randomId('aud'),actor,action,entityType,entityId,JSON.stringify(metadata));}
function safePreview(v:string){return v.replace(/\s+/g,' ').slice(0,240);}function json(v:unknown,status=200){return new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
