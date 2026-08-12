import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './env';

export type AdminIdentity = { email:string; roles:Set<string> };

export async function requireAdmin(request:Request, env:Env, allowedRoles:string[]):Promise<AdminIdentity>{
  if (!env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || !env.CLOUDFLARE_ACCESS_AUD) throw new HttpError(503,'Admin authentication is not configured');
  const token=request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new HttpError(401,'Cloudflare Access authentication required');
  const issuer=`https://${env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`.replace(/\/$/,'');
  const jwks=createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload }=await jwtVerify(token,jwks,{ issuer, audience:env.CLOUDFLARE_ACCESS_AUD });
  const email=typeof payload.email==='string'?payload.email.toLowerCase():'';
  if (!email) throw new HttpError(403,'Authenticated identity has no email');
  const ownerEmails=new Set((env.ADMIN_OWNER_EMAILS??'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));
  const rows=await env.DB.prepare('SELECT role FROM staff_roles WHERE staff_email = ?1').bind(email).all<{role:string}>();
  const roles=new Set(rows.results.map(row=>row.role));
  if (ownerEmails.has(email)) roles.add('owner');
  if (!allowedRoles.some(role=>roles.has(role))) throw new HttpError(403,'Insufficient role');
  return { email, roles };
}

export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
