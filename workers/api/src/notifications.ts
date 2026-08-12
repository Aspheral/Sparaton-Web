import { ResendEmailProvider, staffTicketNotificationEmail, ticketReplyEmail } from '@sparaton/email';
import type { Env } from './env';
import { randomId } from './security';

type DeliveryStatus = 'sent'|'failed'|'skipped_online'|'skipped_unconfigured';

export async function notifyAssignedStaff(env:Env,input:{ ticketId:string; publicId:string; messageId:string; subject:string; preview:string; requesterName:string; staffOnline:boolean }):Promise<void>{
  const assignments=await env.DB.prepare('SELECT staff_email FROM ticket_assignments WHERE ticket_id=?1 AND active=1 ORDER BY created_at DESC').bind(input.ticketId).all<{staff_email:string}>();
  for(const assignment of assignments.results){
    if(input.staffOnline){await record(env,input.ticketId,input.messageId,'staff',assignment.staff_email,'skipped_online');continue;}
    if(env.EMAIL_DELIVERY_MODE==='disabled'||!env.RESEND_API_KEY){await record(env,input.ticketId,input.messageId,'staff',assignment.staff_email,'skipped_unconfigured');continue;}
    const provider=new ResendEmailProvider(env.RESEND_API_KEY);
    try{
      const sent=await provider.send({...staffTicketNotificationEmail({from:env.EMAIL_FROM_TICKETS,to:assignment.staff_email,subject:input.subject,preview:input.preview,requesterName:input.requesterName,adminUrl:`${env.ADMIN_ORIGIN}/tickets/${encodeURIComponent(input.publicId)}`}),idempotencyKey:`staff-${input.messageId}-${assignment.staff_email}`});
      await record(env,input.ticketId,input.messageId,'staff',assignment.staff_email,'sent',sent.id);
    }catch(error){await record(env,input.ticketId,input.messageId,'staff',assignment.staff_email,'failed',undefined,error);}
  }
}

export async function notifyClient(env:Env,input:{ ticketId:string; publicId:string; messageId:string; subject:string; preview:string; email:string; clientOnline:boolean }):Promise<void>{
  if(input.clientOnline){await record(env,input.ticketId,input.messageId,'client',input.email,'skipped_online');return;}
  if(env.EMAIL_DELIVERY_MODE==='disabled'||!env.RESEND_API_KEY){await record(env,input.ticketId,input.messageId,'client',input.email,'skipped_unconfigured');return;}
  const provider=new ResendEmailProvider(env.RESEND_API_KEY);
  try{
    const sent=await provider.send({...ticketReplyEmail({from:env.EMAIL_FROM_TICKETS,to:input.email,subject:input.subject,preview:input.preview,ticketUrl:`${env.STUDIOS_ORIGIN}/tickets/${encodeURIComponent(input.publicId)}`}),idempotencyKey:`client-${input.messageId}`});
    await record(env,input.ticketId,input.messageId,'client',input.email,'sent',sent.id);
  }catch(error){await record(env,input.ticketId,input.messageId,'client',input.email,'failed',undefined,error);}
}

async function record(env:Env,ticketId:string,messageId:string,kind:'client'|'staff',recipient:string,status:DeliveryStatus,providerId?:string,error?:unknown){
  const errorText=error instanceof Error?error.message.slice(0,500):error?String(error).slice(0,500):null;
  await env.DB.prepare("INSERT INTO ticket_notification_deliveries(id,ticket_id,message_id,recipient_kind,recipient_key,status,provider_message_id,error_text,attempted_at,completed_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").bind(randomId('ntf'),ticketId,messageId,kind,recipient,status,providerId??null,errorText).run();
}
