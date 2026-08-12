import { HttpError, requireAdmin } from './access';
import { authorizeTicket } from './tickets';
import type { Env } from './env';
import { randomId, randomToken } from './security';

export const MAX_ATTACHMENT_BYTES=10*1024*1024;
const STAFF_ROLES=['owner','administrator','editor','support','creator'];
const TYPES:Record<string,{mimes:string[];kind:'pdf'|'png'|'jpg'|'gif'|'webp'|'text'}>={
  pdf:{mimes:['application/pdf'],kind:'pdf'},
  png:{mimes:['image/png'],kind:'png'},
  jpg:{mimes:['image/jpeg'],kind:'jpg'},
  jpeg:{mimes:['image/jpeg'],kind:'jpg'},
  gif:{mimes:['image/gif'],kind:'gif'},
  webp:{mimes:['image/webp'],kind:'webp'},
  txt:{mimes:['text/plain'],kind:'text'},
  md:{mimes:['text/markdown','text/plain'],kind:'text'}
};

export async function uploadClientAttachment(request:Request,env:Env,publicId:string):Promise<Response>{
  const auth=await authorizeTicket(request,env,publicId);
  if(request.headers.get('x-sparaton-csrf')!==auth.csrf)throw new HttpError(403,'Invalid request token');
  return storeAttachment(request,env,{ticketId:auth.ticketId,publicId,visibility:'client',uploadedBy:'client',actorKind:'client'});
}

export async function uploadAdminAttachment(request:Request,env:Env,publicId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,STAFF_ROLES);
  const ticket=await env.DB.prepare('SELECT id FROM tickets WHERE public_id=?1').bind(publicId).first<{id:string}>();if(!ticket)throw new HttpError(404,'Ticket not found');
  const form=await request.clone().formData();const requested=form.get('visibility');const visibility=requested==='internal'?'internal':'client';
  return storeAttachment(request,env,{ticketId:ticket.id,publicId,visibility,uploadedBy:admin.email,actorKind:'staff'});
}

export async function getClientAttachment(request:Request,env:Env,publicId:string,attachmentId:string):Promise<Response>{
  const auth=await authorizeTicket(request,env,publicId);
  return serveAttachment(env,auth.ticketId,attachmentId,false);
}

export async function getAdminAttachment(request:Request,env:Env,publicId:string,attachmentId:string):Promise<Response>{
  await requireAdmin(request,env,STAFF_ROLES);
  const ticket=await env.DB.prepare('SELECT id FROM tickets WHERE public_id=?1').bind(publicId).first<{id:string}>();if(!ticket)throw new HttpError(404,'Ticket not found');
  return serveAttachment(env,ticket.id,attachmentId,true);
}

async function storeAttachment(request:Request,env:Env,context:{ticketId:string;publicId:string;visibility:'client'|'internal';uploadedBy:string;actorKind:'client'|'staff'}):Promise<Response>{
  if(!env.ATTACHMENTS)throw new HttpError(503,'Private attachment storage is not configured');
  const form=await request.formData(),value=form.get('file');
  if(!(value instanceof File))throw new HttpError(400,'A file is required');
  if(value.size<=0||value.size>MAX_ATTACHMENT_BYTES)throw new HttpError(413,`Attachments must be no larger than ${MAX_ATTACHMENT_BYTES/1024/1024} MiB`);
  const original=safeFilename(value.name),extension=fileExtension(original),rule=TYPES[extension];
  if(!rule||!rule.mimes.includes(value.type.toLowerCase()))throw new HttpError(415,'This attachment type is not allowed');
  const bytes=await value.arrayBuffer();
  if(!inspect(new Uint8Array(bytes),rule.kind))throw new HttpError(415,'File contents do not match the declared attachment type');
  const sha256=await digest(bytes),mediaId=randomId('med'),attachmentId=randomId('att'),storageKey=`tickets/${context.ticketId}/${randomToken(24)}.${extension}`;
  await env.ATTACHMENTS.put(storageKey,bytes,{httpMetadata:{contentType:value.type},customMetadata:{ticketId:context.ticketId,sha256}});
  try{
    await env.DB.batch([
      env.DB.prepare('INSERT INTO media(id,storage_key,mime_type,byte_size,sha256,uploaded_by) VALUES(?1,?2,?3,?4,?5,?6)').bind(mediaId,storageKey,value.type,value.size,sha256,context.uploadedBy),
      env.DB.prepare('INSERT INTO attachments(id,ticket_id,media_id,original_filename,visibility) VALUES(?1,?2,?3,?4,?5)').bind(attachmentId,context.ticketId,mediaId,original,context.visibility),
      env.DB.prepare('INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(randomId('aud'),context.actorKind==='staff'?context.uploadedBy:null,context.actorKind,'ticket.attachment.uploaded','ticket',context.ticketId,JSON.stringify({attachmentId,visibility:context.visibility,mime:value.type,bytes:value.size,sha256}))
    ]);
  }catch(error){await env.ATTACHMENTS.delete(storageKey);throw error;}
  return json({id:attachmentId,filename:original,mimeType:value.type,byteSize:value.size,visibility:context.visibility},201);
}

async function serveAttachment(env:Env,ticketId:string,attachmentId:string,allowInternal:boolean):Promise<Response>{
  if(!env.ATTACHMENTS)throw new HttpError(503,'Private attachment storage is not configured');
  const row=await env.DB.prepare('SELECT a.original_filename,a.visibility,m.storage_key,m.mime_type,m.byte_size FROM attachments a JOIN media m ON m.id=a.media_id WHERE a.id=?1 AND a.ticket_id=?2').bind(attachmentId,ticketId).first<{original_filename:string;visibility:string;storage_key:string;mime_type:string;byte_size:number}>();
  if(!row||(!allowInternal&&row.visibility!=='client'))throw new HttpError(404,'Attachment not found');
  const object=await env.ATTACHMENTS.get(row.storage_key);if(!object)throw new HttpError(404,'Attachment data is unavailable');
  const filename=encodeURIComponent(row.original_filename).replace(/['()]/g,escape);
  const headers=new Headers({'content-type':row.mime_type,'content-disposition':`attachment; filename*=UTF-8''${filename}`,'x-content-type-options':'nosniff','cache-control':'private, no-store','content-length':String(row.byte_size)});
  if(object.httpEtag)headers.set('etag',object.httpEtag);
  return new Response(object.body,{headers});
}

function fileExtension(name:string){const index=name.lastIndexOf('.');return index<0?'':name.slice(index+1).toLowerCase();}
function safeFilename(name:string){const cleaned=name.normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g,'_').trim().slice(0,180);return cleaned||'attachment';}
function inspect(bytes:Uint8Array,kind:string){
  if(kind==='pdf')return starts(bytes,[0x25,0x50,0x44,0x46,0x2d]);
  if(kind==='png')return starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(kind==='jpg')return starts(bytes,[0xff,0xd8,0xff]);
  if(kind==='gif')return ascii(bytes,0,6)==='GIF87a'||ascii(bytes,0,6)==='GIF89a';
  if(kind==='webp')return ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,4)==='WEBP';
  if(kind==='text'){if(bytes.some(byte=>byte===0))return false;try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return true;}catch{return false;}}
  return false;
}
function starts(bytes:Uint8Array,signature:number[]){return signature.every((value,index)=>bytes[index]===value);}
function ascii(bytes:Uint8Array,start:number,length:number){return String.fromCharCode(...bytes.slice(start,start+length));}
async function digest(buffer:ArrayBuffer){const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));return [...hash].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
