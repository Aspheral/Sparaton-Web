import type { Env } from './env';
import { HttpError } from './access';
import { adminAssign, adminInternalNote, adminOverview, adminReply, adminTag, adminTicketDetail, adminTicketSocket, adminTickets, adminUpdateTicket } from './admin';
import { adminCollection, deleteContent, publicContentDetail, publicDirectory, publicPosts, publicProjects, upsertMetric, upsertOrganization, upsertPerson, upsertPost, upsertProject, upsertService } from './content';
import { connectTicketSocket, createTicket, getTicket, postClientMessage, verifyTicket } from './tickets';
import { getAdminAttachment, getClientAttachment, listAdminAttachments, listClientAttachments, uploadAdminAttachment, uploadClientAttachment } from './attachments';
import { adminAnalytics } from './analytics';
import { adminSyncGithub, syncAllGithubProjects } from './github-sync';
import { adminSettings } from './settings';
import { adminRelationships } from './relationships';
import { adminMediaDelete, adminMediaList, adminMediaUpdate, adminMediaUpload, publicMedia } from './cms-media';
import { adminCannedResponses, adminDeleteCannedResponse } from './canned-responses';
import { adminPrivacyAnonymize, adminPrivacyCleanup, adminPrivacyCloseSessions, adminPrivacyExport, adminPrivacyLookup, adminRetentionSettings } from './privacy';
import { adminAuditLog } from './audit-log';
export { TicketRoom } from './ticket-room';

const securityHeaders:Record<string,string>={
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'x-content-type-options':'nosniff',
  'referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
const ADMIN_MUTATIONS=new Set(['POST','PUT','PATCH','DELETE']);

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    if(request.method==='OPTIONS')return cors(withSecurity(new Response(null,{status:204})),request,env);
    const requestId=crypto.randomUUID();
    const headers=new Headers(request.headers);headers.set('x-sparaton-request-id',requestId);const routedRequest=new Request(request,{headers});
    try{
      const url=new URL(request.url),p=url.pathname,method=request.method.toUpperCase();let response:Response;
      if(p.startsWith('/v1/admin/')&&ADMIN_MUTATIONS.has(method)&&request.headers.get('x-requested-with')!=='sparaton-admin')throw new HttpError(403,'Invalid admin request origin');
      if(method==='GET'&&p==='/health')response=Response.json({ok:true,requestId});
      else if(method==='GET'&&p==='/v1/content/posts')response=await publicPosts(env);
      else if(method==='GET'&&p==='/v1/content/projects')response=await publicProjects(env);
      else if(method==='GET'&&/^\/v1\/content\/(projects|posts|people|organizations|services)\/[^/]+$/.test(p)){const [, , ,kind,slug]=p.split('/');response=await publicContentDetail(env,kind!,decodeURIComponent(slug!));}
      else if(method==='GET'&&/^\/v1\/content\/(people|organizations|services)$/.test(p))response=await publicDirectory(env,p.split('/')[3]!);
      else if(method==='GET'&&/^\/v1\/media\/[^/]+$/.test(p))response=await publicMedia(env,decodeURIComponent(p.split('/')[3]!));
      else if(method==='POST'&&p==='/v1/tickets')response=await createTicket(routedRequest,env);
      else if(method==='GET'&&p==='/v1/tickets/verify')response=await verifyTicket(routedRequest,env);
      else if(method==='GET'&&/^\/v1\/tickets\/[^/]+$/.test(p))response=await getTicket(routedRequest,env,p.split('/')[3]!);
      else if(method==='POST'&&/^\/v1\/tickets\/[^/]+\/messages$/.test(p))response=await postClientMessage(routedRequest,env,p.split('/')[3]!);
      else if(method==='GET'&&/^\/v1\/tickets\/[^/]+\/socket$/.test(p))response=await connectTicketSocket(routedRequest,env,p.split('/')[3]!);
      else if(method==='GET'&&/^\/v1\/tickets\/[^/]+\/attachments$/.test(p))response=await listClientAttachments(routedRequest,env,p.split('/')[3]!);
      else if(method==='POST'&&/^\/v1\/tickets\/[^/]+\/attachments$/.test(p))response=await uploadClientAttachment(routedRequest,env,p.split('/')[3]!);
      else if(method==='GET'&&/^\/v1\/tickets\/[^/]+\/attachments\/[^/]+$/.test(p))response=await getClientAttachment(routedRequest,env,p.split('/')[3]!,p.split('/')[5]!);
      else if(method==='GET'&&p==='/v1/admin/overview')response=await adminOverview(routedRequest,env);
      else if(method==='GET'&&p==='/v1/admin/tickets')response=await adminTickets(routedRequest,env);
      else if(method==='GET'&&/^\/v1\/admin\/tickets\/[^/]+$/.test(p))response=await adminTicketDetail(routedRequest,env,p.split('/')[4]!);
      else if(method==='GET'&&/^\/v1\/admin\/tickets\/[^/]+\/socket$/.test(p))response=await adminTicketSocket(routedRequest,env,p.split('/')[4]!);
      else if(method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/reply$/.test(p))response=await adminReply(routedRequest,env,p.split('/')[4]!);
      else if(method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/notes$/.test(p))response=await adminInternalNote(routedRequest,env,p.split('/')[4]!);
      else if(method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/assign$/.test(p))response=await adminAssign(routedRequest,env,p.split('/')[4]!);
      else if(method==='PATCH'&&/^\/v1\/admin\/tickets\/[^/]+$/.test(p))response=await adminUpdateTicket(routedRequest,env,p.split('/')[4]!);
      else if(method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/tags$/.test(p))response=await adminTag(routedRequest,env,p.split('/')[4]!);
      else if(method==='GET'&&/^\/v1\/admin\/tickets\/[^/]+\/attachments$/.test(p))response=await listAdminAttachments(routedRequest,env,p.split('/')[4]!);
      else if(method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/attachments$/.test(p))response=await uploadAdminAttachment(routedRequest,env,p.split('/')[4]!);
      else if(method==='GET'&&/^\/v1\/admin\/tickets\/[^/]+\/attachments\/[^/]+$/.test(p))response=await getAdminAttachment(routedRequest,env,p.split('/')[4]!,p.split('/')[6]!);
      else if((method==='GET'||method==='POST')&&p==='/v1/admin/canned-responses')response=await adminCannedResponses(routedRequest,env);
      else if(method==='DELETE'&&/^\/v1\/admin\/canned-responses\/[^/]+$/.test(p))response=await adminDeleteCannedResponse(routedRequest,env,decodeURIComponent(p.split('/')[4]!));
      else if(method==='GET'&&p==='/v1/admin/analytics')response=await adminAnalytics(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/github/sync')response=await adminSyncGithub(routedRequest,env);
      else if(method==='POST'&&/^\/v1\/admin\/github\/sync\/[^/]+$/.test(p))response=await adminSyncGithub(routedRequest,env,decodeURIComponent(p.split('/')[5]!));
      else if((method==='GET'||method==='POST')&&p==='/v1/admin/settings')response=await adminSettings(routedRequest,env);
      else if((method==='GET'||method==='PUT')&&/^\/v1\/admin\/relationships\/(people|organizations|projects)\/[^/]+$/.test(p))response=await adminRelationships(routedRequest,env,p.split('/')[4]!,decodeURIComponent(p.split('/')[5]!));
      else if(method==='GET'&&p==='/v1/admin/media')response=await adminMediaList(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/media')response=await adminMediaUpload(routedRequest,env);
      else if(method==='PATCH'&&/^\/v1\/admin\/media\/[^/]+$/.test(p))response=await adminMediaUpdate(routedRequest,env,decodeURIComponent(p.split('/')[4]!));
      else if(method==='DELETE'&&/^\/v1\/admin\/media\/[^/]+$/.test(p))response=await adminMediaDelete(routedRequest,env,decodeURIComponent(p.split('/')[4]!));
      else if(method==='GET'&&p==='/v1/admin/privacy/requesters')response=await adminPrivacyLookup(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/privacy/export')response=await adminPrivacyExport(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/privacy/sessions/close')response=await adminPrivacyCloseSessions(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/privacy/cleanup')response=await adminPrivacyCleanup(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/privacy/anonymize')response=await adminPrivacyAnonymize(routedRequest,env);
      else if((method==='GET'||method==='PUT')&&p==='/v1/admin/privacy/retention')response=await adminRetentionSettings(routedRequest,env);
      else if(method==='GET'&&p==='/v1/admin/audit')response=await adminAuditLog(routedRequest,env);
      else if(method==='GET'&&/^\/v1\/admin\/(people|organizations|services|projects|posts)$/.test(p))response=await adminCollection(routedRequest,env,p.split('/')[3]!);
      else if(method==='POST'&&p==='/v1/admin/people')response=await upsertPerson(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/organizations')response=await upsertOrganization(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/services')response=await upsertService(routedRequest,env);
      else if(method==='POST'&&p==='/v1/admin/projects')response=await upsertProject(routedRequest,env);
      else if(method==='POST'&&/^\/v1\/admin\/projects\/[^/]+\/metrics$/.test(p))response=await upsertMetric(routedRequest,env,p.split('/')[4]!);
      else if(method==='POST'&&p==='/v1/admin/posts')response=await upsertPost(routedRequest,env);
      else if(method==='DELETE'&&/^\/v1\/admin\/(people|organizations|services|projects|posts)\/[^/]+$/.test(p))response=await deleteContent(routedRequest,env,p.split('/')[3]!,decodeURIComponent(p.split('/')[4]!));
      else response=Response.json({error:'Not found',requestId},{status:404});
      response.headers.set('x-request-id',requestId);return cors(withSecurity(response),request,env);
    }catch(error){
      const status=error instanceof HttpError?error.status:500,message=error instanceof HttpError?error.message:'Unexpected server error';
      if(!(error instanceof HttpError))console.error('request-failed',{requestId,error});
      return cors(withSecurity(Response.json({error:message,requestId},{status,headers:{'cache-control':'no-store'}})),request,env);
    }
  },
  async scheduled(_controller:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(syncAllGithubProjects(env));}
};

function withSecurity(response:Response){for(const[k,v]of Object.entries(securityHeaders))response.headers.set(k,v);return response;}
function cors(response:Response,request:Request,env:Env){const origin=request.headers.get('origin');if(origin&&[env.STUDIOS_ORIGIN,env.ADMIN_ORIGIN,'https://aspheral.sparaton.com','https://ilmp.sparaton.com'].includes(origin)){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','Origin');response.headers.set('access-control-allow-credentials','true');response.headers.set('access-control-allow-headers','content-type, x-sparaton-csrf, x-requested-with');response.headers.set('access-control-allow-methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');}return response;}
