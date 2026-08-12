import { HttpError, requireAdmin } from './access';
import type { Env } from './env';
import { randomId } from './security';

const ROLES=['owner','administrator','editor'];

export async function adminSettings(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,ROLES);
  if(request.method==='GET'){
    const rows=await env.DB.prepare('SELECT setting_key AS key,value_json,updated_at,updated_by FROM site_settings ORDER BY setting_key').all();
    return json({items:rows.results});
  }
  const data=await request.json<{key?:unknown;value?:unknown}>(),key=typeof data.key==='string'?data.key.trim():'';
  if(!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(key))throw new HttpError(400,'Invalid setting key');
  const valueJson=JSON.stringify(data.value??null);if(valueJson.length>50000)throw new HttpError(400,'Setting value is too large');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO site_settings(setting_key,value_json,updated_by,updated_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').bind(key,valueJson,admin.email),
    env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json) VALUES(?1,?2,'staff','setting.upsert','setting',?3,'{}')").bind(randomId('aud'),admin.email,key)
  ]);
  return json({key});
}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
