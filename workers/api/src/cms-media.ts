import { HttpError, requireAdmin } from './access';
import type { Env } from './env';
import { randomId, randomToken } from './security';

const EDIT_ROLES = ['owner', 'administrator', 'editor'];
const DELETE_ROLES = ['owner', 'administrator'];
export const MAX_CONTENT_MEDIA_BYTES = 15 * 1024 * 1024;
const TYPES: Record<string, { mime: string; kind: 'png' | 'jpg' | 'gif' | 'webp' }> = {
  png: { mime: 'image/png', kind: 'png' },
  jpg: { mime: 'image/jpeg', kind: 'jpg' },
  jpeg: { mime: 'image/jpeg', kind: 'jpg' },
  gif: { mime: 'image/gif', kind: 'gif' },
  webp: { mime: 'image/webp', kind: 'webp' }
};

type MediaRow = { id:string; storage_key:string; original_filename:string; mime_type:string; byte_size:number; width:number; height:number; sha256:string; alt_text:string; caption:string|null; focal_x:number|null; focal_y:number|null; uploaded_by:string; created_at:string; updated_at:string };

export async function adminMediaList(request: Request, env: Env): Promise<Response> {
  await requireAdmin(request, env, EDIT_ROLES);
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const mime = (url.searchParams.get('mime') ?? '').trim().slice(0, 80);
  let sql = 'SELECT * FROM content_media WHERE 1=1';
  const values: string[] = [];
  if (q) { values.push(`%${q.replace(/[%_]/g, '\\$&')}%`); sql += ` AND (original_filename LIKE ?${values.length} ESCAPE '\\' OR alt_text LIKE ?${values.length} ESCAPE '\\' OR COALESCE(caption,'') LIKE ?${values.length} ESCAPE '\\')`; }
  if (mime) { values.push(`${mime}%`); sql += ` AND mime_type LIKE ?${values.length}`; }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const rows = (await env.DB.prepare(sql).bind(...values).all<MediaRow>()).results;
  const items = await Promise.all(rows.map(async row => ({ ...publicFields(row), usage: await findUsage(env, row.id) })));
  return json({ items, configured: Boolean(env.CMS_MEDIA) });
}

export async function adminMediaUpload(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env, EDIT_ROLES);
  if (!env.CMS_MEDIA) throw new HttpError(503, 'Public CMS media storage is not configured');
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'An image file is required');
  if (file.size <= 0 || file.size > MAX_CONTENT_MEDIA_BYTES) throw new HttpError(413, `CMS images must be no larger than ${MAX_CONTENT_MEDIA_BYTES / 1024 / 1024} MiB`);
  const original = safeFilename(file.name);
  const extension = fileExtension(original);
  const rule = TYPES[extension];
  if (!rule || file.type.toLowerCase() !== rule.mime) throw new HttpError(415, 'Only validated PNG, JPEG, GIF, and WebP images are allowed');
  const bytes = await file.arrayBuffer();
  const dimensions = inspectImage(new Uint8Array(bytes), rule.kind);
  if (!dimensions) throw new HttpError(415, 'Image contents do not match the declared type or dimensions could not be validated');
  if (dimensions.width > 20000 || dimensions.height > 20000 || dimensions.width * dimensions.height > 120_000_000) throw new HttpError(413, 'Image dimensions exceed the CMS safety limit');
  const sha256 = await digest(bytes);
  const existing = await env.DB.prepare('SELECT * FROM content_media WHERE sha256=?1').bind(sha256).first<MediaRow>();
  if (existing) return json({ item: publicFields(existing), deduplicated: true }, 200);
  const id = randomId('cmed');
  const storageKey = `cms/${sha256.slice(0, 2)}/${randomToken(24)}.${extension === 'jpeg' ? 'jpg' : extension}`;
  await env.CMS_MEDIA.put(storageKey, bytes, { httpMetadata: { contentType: rule.mime }, customMetadata: { mediaId: id, sha256 } });
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO content_media(id,storage_key,original_filename,mime_type,byte_size,width,height,sha256,alt_text,caption,focal_x,focal_y,uploaded_by) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)').bind(id, storageKey, original, rule.mime, file.size, dimensions.width, dimensions.height, sha256, field(form.get('altText'), 500), nullable(form.get('caption'), 1000), focal(form.get('focalX')), focal(form.get('focalY')), admin.email),
      auditStatement(env, request, admin.email, 'cms.media.uploaded', id, { mime: rule.mime, bytes: file.size, width: dimensions.width, height: dimensions.height, sha256 })
    ]);
  } catch (error) {
    await env.CMS_MEDIA.delete(storageKey);
    throw error;
  }
  const row = await env.DB.prepare('SELECT * FROM content_media WHERE id=?1').bind(id).first<MediaRow>();
  return json({ item: publicFields(row!), deduplicated: false }, 201);
}

export async function adminMediaUpdate(request: Request, env: Env, id: string): Promise<Response> {
  const admin = await requireAdmin(request, env, EDIT_ROLES);
  const current = await env.DB.prepare('SELECT id FROM content_media WHERE id=?1').bind(id).first();
  if (!current) throw new HttpError(404, 'Media asset not found');
  const data = await request.json<Record<string, unknown>>();
  await env.DB.batch([
    env.DB.prepare('UPDATE content_media SET alt_text=?2,caption=?3,focal_x=?4,focal_y=?5,updated_at=CURRENT_TIMESTAMP WHERE id=?1').bind(id, field(data.altText, 500), nullable(data.caption, 1000), focal(data.focalX), focal(data.focalY)),
    auditStatement(env, request, admin.email, 'cms.media.updated', id, { fields: ['altText', 'caption', 'focalX', 'focalY'] })
  ]);
  const row = await env.DB.prepare('SELECT * FROM content_media WHERE id=?1').bind(id).first<MediaRow>();
  return json({ item: publicFields(row!), usage: await findUsage(env, id) });
}

export async function adminMediaDelete(request: Request, env: Env, id: string): Promise<Response> {
  const admin = await requireAdmin(request, env, DELETE_ROLES);
  if (!env.CMS_MEDIA) throw new HttpError(503, 'Public CMS media storage is not configured');
  const row = await env.DB.prepare('SELECT * FROM content_media WHERE id=?1').bind(id).first<MediaRow>();
  if (!row) throw new HttpError(404, 'Media asset not found');
  const usage = await findUsage(env, id);
  if (usage.length) throw new HttpError(409, 'This media asset is still referenced by published or editable content');
  await env.CMS_MEDIA.delete(row.storage_key);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM content_media WHERE id=?1').bind(id),
    auditStatement(env, request, admin.email, 'cms.media.deleted', id, { filename: row.original_filename, sha256: row.sha256 })
  ]);
  return json({ deleted: true, id });
}

export async function publicMedia(env: Env, id: string): Promise<Response> {
  if (!env.CMS_MEDIA) throw new HttpError(503, 'Public media storage is not configured');
  const row = await env.DB.prepare('SELECT storage_key,mime_type,byte_size,sha256 FROM content_media WHERE id=?1').bind(id).first<{storage_key:string;mime_type:string;byte_size:number;sha256:string}>();
  if (!row) throw new HttpError(404, 'Media asset not found');
  const object = await env.CMS_MEDIA.get(row.storage_key);
  if (!object) throw new HttpError(404, 'Media data is unavailable');
  const headers = new Headers({
    'content-type': row.mime_type,
    'content-length': String(row.byte_size),
    'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
    'etag': object.httpEtag || `\"${row.sha256}\"`
  });
  return new Response(object.body, { headers });
}

function publicFields(row: MediaRow) { return { id: row.id, filename: row.original_filename, mimeType: row.mime_type, byteSize: row.byte_size, width: row.width, height: row.height, sha256: row.sha256, altText: row.alt_text, caption: row.caption, focalX: row.focal_x, focalY: row.focal_y, uploadedBy: row.uploaded_by, createdAt: row.created_at, updatedAt: row.updated_at, url: `/v1/media/${encodeURIComponent(row.id)}` }; }
async function findUsage(env: Env, id: string): Promise<Record<string, unknown>[]> {
  const explicit = (await env.DB.prepare('SELECT owner_type AS ownerType,owner_id AS ownerId,field_name AS fieldName FROM content_media_usage WHERE media_id=?1 ORDER BY owner_type,owner_id').bind(id).all()).results as Record<string, unknown>[];
  const directQueries = [
    ['project','hero_media_id','SELECT id,name FROM projects WHERE hero_media_id=?1'],
    ['post','hero_media_id','SELECT id,title AS name FROM posts WHERE hero_media_id=?1']
  ] as const;
  for (const [ownerType, fieldName, sql] of directQueries) for (const row of (await env.DB.prepare(sql).bind(id).all<{id:string;name:string}>()).results) explicit.push({ ownerType, ownerId: row.id, fieldName, name: row.name });
  const needle = `%/v1/media/${id}%`;
  for (const [ownerType, fieldName, sql] of [
    ['person','profile_image_url','SELECT id,display_name AS name FROM people WHERE profile_image_url LIKE ?1'],
    ['organization','logo_url','SELECT id,name FROM organizations WHERE logo_url LIKE ?1'],
    ['person','social_image_url','SELECT id,display_name AS name FROM people WHERE social_image_url LIKE ?1'],
    ['organization','social_image_url','SELECT id,name FROM organizations WHERE social_image_url LIKE ?1'],
    ['project','social_image_url','SELECT id,name FROM projects WHERE social_image_url LIKE ?1'],
    ['post','social_image_url','SELECT id,title AS name FROM posts WHERE social_image_url LIKE ?1'],
    ['service','social_image_url','SELECT id,name FROM services WHERE social_image_url LIKE ?1']
  ] as const) for (const row of (await env.DB.prepare(sql).bind(needle).all<{id:string;name:string}>()).results) explicit.push({ ownerType, ownerId: row.id, fieldName, name: row.name });
  return explicit;
}

function inspectImage(bytes: Uint8Array, kind: 'png'|'jpg'|'gif'|'webp'): {width:number;height:number}|null {
  if (kind === 'png') { if (!starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) || bytes.length < 24) return null; return { width: u32be(bytes,16), height: u32be(bytes,20) }; }
  if (kind === 'gif') { const sig = ascii(bytes,0,6); if ((sig !== 'GIF87a' && sig !== 'GIF89a') || bytes.length < 10) return null; return { width: u16le(bytes,6), height: u16le(bytes,8) }; }
  if (kind === 'jpg') return jpegDimensions(bytes);
  if (ascii(bytes,0,4) !== 'RIFF' || ascii(bytes,8,4) !== 'WEBP' || bytes.length < 30) return null;
  const chunk = ascii(bytes,12,4);
  if (chunk === 'VP8X') return { width: 1 + u24le(bytes,24), height: 1 + u24le(bytes,27) };
  if (chunk === 'VP8L' && bytes[20] === 0x2f) return { width: 1 + (bytes[21]! | ((bytes[22]! & 0x3f) << 8)), height: 1 + ((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10)) };
  if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: u16le(bytes,26) & 0x3fff, height: u16le(bytes,28) & 0x3fff };
  return null;
}
function jpegDimensions(bytes: Uint8Array) { if (!starts(bytes,[0xff,0xd8,0xff])) return null; let i=2; while (i+9<bytes.length) { if (bytes[i]!==0xff) { i++; continue; } const marker=bytes[i+1]!; if (marker===0xd8||marker===0xd9) { i+=2; continue; } const length=(bytes[i+2]!<<8)|bytes[i+3]!; if (length<2||i+length+2>bytes.length) return null; if ((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)) return { height:(bytes[i+5]!<<8)|bytes[i+6]!, width:(bytes[i+7]!<<8)|bytes[i+8]! }; i+=2+length; } return null; }
function starts(bytes:Uint8Array, signature:number[]) { return signature.every((value,index)=>bytes[index]===value); }
function ascii(bytes:Uint8Array,start:number,length:number) { return String.fromCharCode(...bytes.slice(start,start+length)); }
function u16le(bytes:Uint8Array,offset:number) { return bytes[offset]! | (bytes[offset+1]!<<8); }
function u24le(bytes:Uint8Array,offset:number) { return bytes[offset]! | (bytes[offset+1]!<<8) | (bytes[offset+2]!<<16); }
function u32be(bytes:Uint8Array,offset:number) { return (((bytes[offset]!<<24)>>>0) + (bytes[offset+1]!<<16) + (bytes[offset+2]!<<8) + bytes[offset+3]!) >>> 0; }
function fileExtension(name:string){const index=name.lastIndexOf('.');return index<0?'':name.slice(index+1).toLowerCase();}
function safeFilename(name:string){const cleaned=name.normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g,'_').trim().slice(0,180);return cleaned||'image';}
function field(value:unknown,max:number){return (typeof value==='string'?value.trim():'').slice(0,max);}
function nullable(value:unknown,max:number){return field(value,max)||null;}
function focal(value:unknown){if(value===null||value===undefined||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>1)throw new HttpError(400,'Focal point values must be between 0 and 1');return n;}
async function digest(buffer:ArrayBuffer){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));return [...hash].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function auditStatement(env:Env,request:Request,email:string,action:string,id:string,metadata:unknown){return env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json,request_id) VALUES(?1,?2,'staff',?3,'content_media',?4,?5,?6)").bind(randomId('aud'),email,action,id,JSON.stringify(metadata),request.headers.get('x-sparaton-request-id'));}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
