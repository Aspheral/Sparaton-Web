import { requireAdmin } from './access';
import type { Env } from './env';

export async function adminAuditLog(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,['owner','administrator']);
  const url=new URL(request.url),action=(url.searchParams.get('action')??'').trim().slice(0,120),actor=(url.searchParams.get('actor')??'').trim().toLowerCase().slice(0,200),target=(url.searchParams.get('target')??'').trim().slice(0,200),q=(url.searchParams.get('q')??'').trim().slice(0,120);
  const clauses:string[]=[];const values:string[]=[];
  if(action){values.push(`${action}%`);clauses.push(`action LIKE ?${values.length}`);}
  if(actor){values.push(`%${actor}%`);clauses.push(`LOWER(COALESCE(actor_email,'')) LIKE ?${values.length}`);}
  if(target){values.push(`%${target}%`);clauses.push(`(entity_type LIKE ?${values.length} OR COALESCE(entity_id,'') LIKE ?${values.length})`);}
  if(q){values.push(`%${q}%`);clauses.push(`(action LIKE ?${values.length} OR entity_type LIKE ?${values.length} OR COALESCE(entity_id,'') LIKE ?${values.length} OR COALESCE(metadata_json,'') LIKE ?${values.length})`);}
  const sql=`SELECT id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json,request_id,created_at FROM audit_events ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY created_at DESC LIMIT 250`;
  const rows=(await env.DB.prepare(sql).bind(...values).all()).results;
  return new Response(JSON.stringify({items:rows}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
