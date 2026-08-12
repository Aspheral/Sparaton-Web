import type { Env } from './env';
import { HttpError } from './access';
import { adminInternalNote, adminOverview, adminReply, adminTickets } from './admin';
import { publicPosts, publicProjects, upsertMetric, upsertPost, upsertProject } from './content';
import { connectTicketSocket, createTicket, getTicket, postClientMessage, verifyTicket } from './tickets';
export { TicketRoom } from './ticket-room';

const securityHeaders={'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()','x-frame-options':'DENY'};
export default {async fetch(request:Request,env:Env):Promise<Response>{if(request.method==='OPTIONS')return cors(new Response(null,{status:204}),request,env);try{const url=new URL(request.url),p=url.pathname;let response:Response;
if(request.method==='GET'&&p==='/health')response=Response.json({ok:true});
else if(request.method==='GET'&&p==='/v1/content/posts')response=await publicPosts(env);
else if(request.method==='GET'&&p==='/v1/content/projects')response=await publicProjects(env);
else if(request.method==='POST'&&p==='/v1/tickets')response=await createTicket(request,env);
else if(request.method==='GET'&&p==='/v1/tickets/verify')response=await verifyTicket(request,env);
else if(request.method==='GET'&&/^\/v1\/tickets\/[^/]+$/.test(p))response=await getTicket(request,env,p.split('/')[3]!);
else if(request.method==='POST'&&/^\/v1\/tickets\/[^/]+\/messages$/.test(p))response=await postClientMessage(request,env,p.split('/')[3]!);
else if(request.method==='GET'&&/^\/v1\/tickets\/[^/]+\/socket$/.test(p))response=await connectTicketSocket(request,env,p.split('/')[3]!);
else if(request.method==='GET'&&p==='/v1/admin/overview')response=await adminOverview(request,env);
else if(request.method==='GET'&&p==='/v1/admin/tickets')response=await adminTickets(request,env);
else if(request.method==='POST'&&p==='/v1/admin/projects')response=await upsertProject(request,env);
else if(request.method==='POST'&&/^\/v1\/admin\/projects\/[^/]+\/metrics$/.test(p))response=await upsertMetric(request,env,p.split('/')[4]!);
else if(request.method==='POST'&&p==='/v1/admin/posts')response=await upsertPost(request,env);
else if(request.method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/reply$/.test(p))response=await adminReply(request,env,p.split('/')[4]!);
else if(request.method==='POST'&&/^\/v1\/admin\/tickets\/[^/]+\/notes$/.test(p))response=await adminInternalNote(request,env,p.split('/')[4]!);
else response=new Response('Not found',{status:404});for(const [k,v]of Object.entries(securityHeaders))response.headers.set(k,v);return cors(response,request,env);}catch(error){const status=error instanceof HttpError?error.status:500;const message=error instanceof HttpError?error.message:'Unexpected server error';console.error(error);const response=Response.json({error:message},{status});for(const [k,v]of Object.entries(securityHeaders))response.headers.set(k,v);return cors(response,request,env);}}};
function cors(response:Response,request:Request,env:Env){const origin=request.headers.get('origin');if(origin&&[env.STUDIOS_ORIGIN,env.ADMIN_ORIGIN,'https://aspheral.sparaton.com','https://ilmp.sparaton.com'].includes(origin)){response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','Origin');response.headers.set('access-control-allow-credentials','true');response.headers.set('access-control-allow-headers','content-type');response.headers.set('access-control-allow-methods','GET,POST,PATCH,DELETE,OPTIONS');}return response;}
