import { HttpError, requireAdmin } from './access';
import type { Env } from './env';
import { randomId } from './security';

const EDIT_ROLES=['owner','administrator','editor'];
const DELETE_ROLES=['owner','administrator'];
const KINDS=['people','organizations','services','projects','posts'] as const;
type Kind=typeof KINDS[number];

export async function adminCmsList(request:Request,env:Env,kind:string):Promise<Response>{
  await requireAdmin(request,env,EDIT_ROLES);const valid=asKind(kind);const queries:Record<Kind,string>={
    people:'SELECT * FROM people ORDER BY sort_order,display_name',
    organizations:'SELECT * FROM organizations ORDER BY sort_order,name',
    services:'SELECT * FROM services ORDER BY sort_order,name',
    projects:'SELECT * FROM projects ORDER BY updated_at DESC,name',
    posts:'SELECT * FROM posts ORDER BY updated_at DESC,title'
  };
  return json({items:(await env.DB.prepare(queries[valid]).all()).results});
}

export async function adminCmsGet(request:Request,env:Env,kind:string,id:string):Promise<Response>{
  await requireAdmin(request,env,EDIT_ROLES);const valid=asKind(kind),table=tableFor(valid);const item=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?1`).bind(id).first<Record<string,unknown>>();if(!item)throw new HttpError(404,'Content item not found');
  const related:Record<string,unknown>={};
  if(valid==='people'){
    related.memberships=(await env.DB.prepare('SELECT m.*,o.name AS organization_name FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.person_id=?1 ORDER BY m.sort_order,o.name').bind(id).all()).results;
    related.projects=(await env.DB.prepare('SELECT pp.*,p.name AS project_name FROM project_people pp JOIN projects p ON p.id=pp.project_id WHERE pp.person_id=?1 ORDER BY pp.sort_order,p.name').bind(id).all()).results;
    related.links=(await env.DB.prepare("SELECT * FROM external_links WHERE owner_type='person' AND owner_id=?1 ORDER BY sort_order,label").bind(id).all()).results;
  }else if(valid==='organizations'){
    related.members=(await env.DB.prepare('SELECT m.*,p.display_name FROM memberships m JOIN people p ON p.id=m.person_id WHERE m.organization_id=?1 ORDER BY m.sort_order,p.display_name').bind(id).all()).results;
    related.projects=(await env.DB.prepare('SELECT id,slug,name,status,published_at FROM projects WHERE organization_id=?1 ORDER BY name').bind(id).all()).results;
    related.links=(await env.DB.prepare("SELECT * FROM external_links WHERE owner_type='organization' AND owner_id=?1 ORDER BY sort_order,label").bind(id).all()).results;
  }else if(valid==='projects'){
    related.metrics=(await env.DB.prepare('SELECT * FROM project_metrics WHERE project_id=?1 ORDER BY updated_at DESC,label').bind(id).all()).results;
    related.people=(await env.DB.prepare('SELECT pp.*,p.display_name FROM project_people pp JOIN people p ON p.id=pp.person_id WHERE pp.project_id=?1 ORDER BY pp.sort_order,p.display_name').bind(id).all()).results;
    related.links=(await env.DB.prepare("SELECT * FROM external_links WHERE owner_type='project' AND owner_id=?1 ORDER BY sort_order,label").bind(id).all()).results;
    related.github=await env.DB.prepare('SELECT * FROM project_github_metadata WHERE project_id=?1').bind(id).first();
  }else if(valid==='posts'){
    related.authors=(await env.DB.prepare('SELECT pa.*,p.display_name FROM post_authors pa JOIN people p ON p.id=pa.person_id WHERE pa.post_id=?1 ORDER BY pa.sort_order,p.display_name').bind(id).all()).results;
  }
  return json({item,related});
}

export async function adminCmsSave(request:Request,env:Env,kind:string):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),valid=asKind(kind),data=await request.json<Record<string,unknown>>();let id='';
  if(valid==='people')id=await savePerson(env,data);
  else if(valid==='organizations')id=await saveOrganization(env,data);
  else if(valid==='services')id=await saveService(env,data);
  else if(valid==='projects')id=await saveProject(env,data);
  else id=await savePost(env,data);
  await audit(env,admin.email,`cms.${valid}.saved`,valid,id,{slug:text(data.slug,120)});
  return json({id},201);
}

export async function adminCmsDelete(request:Request,env:Env,kind:string,id:string):Promise<Response>{
  const admin=await requireAdmin(request,env,DELETE_ROLES),valid=asKind(kind),table=tableFor(valid),row=await env.DB.prepare(`SELECT slug FROM ${table} WHERE id=?1`).bind(id).first<{slug:string}>();if(!row)throw new HttpError(404,'Content item not found');
  if(new URL(request.url).searchParams.get('confirm')!==row.slug)throw new HttpError(400,'Deletion requires the exact slug as confirmation');
  await env.DB.prepare(`DELETE FROM ${table} WHERE id=?1`).bind(id).run();await audit(env,admin.email,`cms.${valid}.deleted`,valid,id,{slug:row.slug});return json({deleted:true,id});
}

export async function adminSettings(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES);
  if(request.method==='GET')return json({settings:(await env.DB.prepare('SELECT setting_key,value_json,updated_by,updated_at FROM site_settings ORDER BY setting_key').all()).results});
  const data=await request.json<{key?:unknown;value?:unknown}>(),key=text(data.key,120,true);if(!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(key))throw new HttpError(400,'Invalid setting key');
  const value=JSON.stringify(data.value??null);if(value.length>50000)throw new HttpError(400,'Setting value is too large');
  await env.DB.prepare('INSERT INTO site_settings(setting_key,value_json,updated_by,updated_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').bind(key,value,admin.email).run();await audit(env,admin.email,'settings.updated','setting',key,{});return json({key,saved:true});
}

export async function adminMetric(request:Request,env:Env,projectId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),data=await request.json<Record<string,unknown>>(),metricKey=text(data.metricKey,80,true),status=text(data.status,24,true);
  if(!['measured','provisional','historical','target'].includes(status))throw new HttpError(400,'Invalid metric status');
  const id=text(data.id,120)||randomId('met');
  await env.DB.prepare('INSERT INTO project_metrics(id,project_id,metric_key,label,value,qualifier,status,source,source_url,measured_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,CURRENT_TIMESTAMP) ON CONFLICT(project_id,metric_key) DO UPDATE SET label=excluded.label,value=excluded.value,qualifier=excluded.qualifier,status=excluded.status,source=excluded.source,source_url=excluded.source_url,measured_at=excluded.measured_at,updated_at=CURRENT_TIMESTAMP').bind(id,projectId,metricKey,text(data.label,120,true),text(data.value,240,true),nullable(data.qualifier,500),status,nullable(data.source,500),nullable(data.sourceUrl,1000),nullable(data.measuredAt,64)).run();await audit(env,admin.email,'cms.project_metric.saved','project',projectId,{metricKey,status});return json({id,metricKey},201);
}

async function savePerson(env:Env,data:Record<string,unknown>){
  const id=text(data.id,120)||randomId('per'),slug=slugValue(data.slug),display=text(data.displayName,160,true);
  await env.DB.prepare('INSERT INTO people(id,slug,display_name,legal_name,biography,profile_image_url,availability,contact_route,is_public,role_text,areas_json,sort_order,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,display_name=excluded.display_name,legal_name=excluded.legal_name,biography=excluded.biography,profile_image_url=excluded.profile_image_url,availability=excluded.availability,contact_route=excluded.contact_route,is_public=excluded.is_public,role_text=excluded.role_text,areas_json=excluded.areas_json,sort_order=excluded.sort_order,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP').bind(id,slug,display,nullable(data.legalName,160),text(data.biography,20000),nullable(data.profileImageUrl,1000),nullable(data.availability,240),nullable(data.contactRoute,500),flag(data.isPublic,true),nullable(data.role,240),jsonArray(data.areas),integer(data.sortOrder),nullable(data.seoTitle,240),nullable(data.seoDescription,500),nullable(data.canonicalUrl,1000),nullable(data.socialTitle,240),nullable(data.socialDescription,500),nullable(data.socialImageUrl,1000),flag(data.robotsIndex,true)).run();
  if(Array.isArray(data.memberships)){const statements=[env.DB.prepare('DELETE FROM memberships WHERE person_id=?1').bind(id)];for(const item of data.memberships){const row=obj(item),orgId=text(row.organizationId,120),role=text(row.role,160);if(orgId&&role)statements.push(env.DB.prepare('INSERT INTO memberships(id,person_id,organization_id,role_label,is_public,sort_order) VALUES(?1,?2,?3,?4,?5,?6)').bind(randomId('mem'),id,orgId,role,flag(row.isPublic,true),integer(row.sortOrder)));}await env.DB.batch(statements);}
  await replaceLinks(env,'person',id,data.links);return id;
}
async function saveOrganization(env:Env,data:Record<string,unknown>){
  const id=text(data.id,120)||randomId('org'),slug=slugValue(data.slug);
  await env.DB.prepare('INSERT INTO organizations(id,slug,name,kind,relationship_label,description,subdomain,logo_url,contact_route,is_public,sort_order,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,kind=excluded.kind,relationship_label=excluded.relationship_label,description=excluded.description,subdomain=excluded.subdomain,logo_url=excluded.logo_url,contact_route=excluded.contact_route,is_public=excluded.is_public,sort_order=excluded.sort_order,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP').bind(id,slug,text(data.name,180,true),text(data.kind,80)||'organization',nullable(data.relationshipLabel,240),text(data.description,20000),nullable(data.subdomain,255),nullable(data.logoUrl,1000),nullable(data.contactRoute,500),flag(data.isPublic,true),integer(data.sortOrder),nullable(data.seoTitle,240),nullable(data.seoDescription,500),nullable(data.canonicalUrl,1000),nullable(data.socialTitle,240),nullable(data.socialDescription,500),nullable(data.socialImageUrl,1000),flag(data.robotsIndex,true)).run();await replaceLinks(env,'organization',id,data.links);return id;
}
async function saveService(env:Env,data:Record<string,unknown>){
  const id=text(data.id,120)||randomId('svc'),slug=slugValue(data.slug);
  await env.DB.prepare('INSERT INTO services(id,slug,name,summary,body_markdown,pricing_model,availability,organization_id,is_public,category,scope_text,provider_text,inquiry_cta,sort_order,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,summary=excluded.summary,body_markdown=excluded.body_markdown,pricing_model=excluded.pricing_model,availability=excluded.availability,organization_id=excluded.organization_id,is_public=excluded.is_public,category=excluded.category,scope_text=excluded.scope_text,provider_text=excluded.provider_text,inquiry_cta=excluded.inquiry_cta,sort_order=excluded.sort_order,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP').bind(id,slug,text(data.name,180,true),text(data.summary,2000,true),text(data.bodyMarkdown,30000),nullable(data.pricingModel,500),nullable(data.availability,240),nullable(data.organizationId,120),flag(data.isPublic,true),nullable(data.category,120),nullable(data.scope,4000),nullable(data.provider,500),text(data.inquiryCta,180)||'Request a quote',integer(data.sortOrder),nullable(data.seoTitle,240),nullable(data.seoDescription,500),nullable(data.canonicalUrl,1000),nullable(data.socialTitle,240),nullable(data.socialDescription,500),nullable(data.socialImageUrl,1000),flag(data.robotsIndex,true)).run();return id;
}
async function saveProject(env:Env,data:Record<string,unknown>){
  const id=text(data.id,120)||randomId('prj'),slug=slugValue(data.slug),published=flag(data.published,false)?new Date().toISOString():null;
  await env.DB.prepare('INSERT INTO projects(id,slug,organization_id,name,summary,body_markdown,status,featured,highlighted,pinned,experimental,repository_url,release_url,documentation_url,hero_media_id,seo_title,seo_description,published_at,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,organization_id=excluded.organization_id,name=excluded.name,summary=excluded.summary,body_markdown=excluded.body_markdown,status=excluded.status,featured=excluded.featured,highlighted=excluded.highlighted,pinned=excluded.pinned,experimental=excluded.experimental,repository_url=excluded.repository_url,release_url=excluded.release_url,documentation_url=excluded.documentation_url,hero_media_id=excluded.hero_media_id,seo_title=excluded.seo_title,seo_description=excluded.seo_description,published_at=CASE WHEN excluded.published_at IS NOT NULL THEN COALESCE(projects.published_at,excluded.published_at) ELSE NULL END,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP').bind(id,slug,nullable(data.organizationId,120),text(data.name,180,true),text(data.summary,2000,true),text(data.bodyMarkdown,50000),text(data.status,60)||'in-development',flag(data.featured),flag(data.highlighted),flag(data.pinned),flag(data.experimental),nullable(data.repositoryUrl,1000),nullable(data.releaseUrl,1000),nullable(data.documentationUrl,1000),nullable(data.heroMediaId,120),nullable(data.seoTitle,240),nullable(data.seoDescription,500),published,nullable(data.canonicalUrl,1000),nullable(data.socialTitle,240),nullable(data.socialDescription,500),nullable(data.socialImageUrl,1000),flag(data.robotsIndex,true)).run();
  if(Array.isArray(data.people)){const statements=[env.DB.prepare('DELETE FROM project_people WHERE project_id=?1').bind(id)];for(const item of data.people){const row=obj(item),personId=text(row.personId,120);if(personId)statements.push(env.DB.prepare('INSERT INTO project_people(project_id,person_id,credit_label,sort_order) VALUES(?1,?2,?3,?4)').bind(id,personId,text(row.credit,120)||'Creator',integer(row.sortOrder)));}await env.DB.batch(statements);}await replaceLinks(env,'project',id,data.links);return id;
}
async function savePost(env:Env,data:Record<string,unknown>){
  const id=text(data.id,120)||randomId('pst'),slug=slugValue(data.slug),status=text(data.status,24)||'draft';if(!['draft','published'].includes(status))throw new HttpError(400,'Invalid post status');
  const published=status==='published'?(text(data.publishedAt,64)||new Date().toISOString()):null;
  await env.DB.prepare('INSERT INTO posts(id,slug,type,title,summary,body_markdown,organization_id,project_id,hero_media_id,status,seo_title,seo_description,published_at,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,type=excluded.type,title=excluded.title,summary=excluded.summary,body_markdown=excluded.body_markdown,organization_id=excluded.organization_id,project_id=excluded.project_id,hero_media_id=excluded.hero_media_id,status=excluded.status,seo_title=excluded.seo_title,seo_description=excluded.seo_description,published_at=excluded.published_at,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP').bind(id,slug,text(data.type,80,true),text(data.title,240,true),text(data.summary,2000,true),text(data.bodyMarkdown,80000,true),nullable(data.organizationId,120),nullable(data.projectId,120),nullable(data.heroMediaId,120),status,nullable(data.seoTitle,240),nullable(data.seoDescription,500),published,nullable(data.canonicalUrl,1000),nullable(data.socialTitle,240),nullable(data.socialDescription,500),nullable(data.socialImageUrl,1000),flag(data.robotsIndex,true)).run();
  if(Array.isArray(data.authorIds)){const statements=[env.DB.prepare('DELETE FROM post_authors WHERE post_id=?1').bind(id)];data.authorIds.forEach((value,index)=>{const personId=text(value,120);if(personId)statements.push(env.DB.prepare('INSERT INTO post_authors(post_id,person_id,sort_order) VALUES(?1,?2,?3)').bind(id,personId,index));});await env.DB.batch(statements);}return id;
}
async function replaceLinks(env:Env,ownerType:'person'|'organization'|'project',ownerId:string,value:unknown){if(!Array.isArray(value))return;const statements=[env.DB.prepare('DELETE FROM external_links WHERE owner_type=?1 AND owner_id=?2').bind(ownerType,ownerId)];value.forEach((item,index)=>{const row=obj(item),url=text(row.url,1000),label=text(row.label,120);if(url&&label)statements.push(env.DB.prepare('INSERT INTO external_links(id,owner_type,owner_id,label,url,kind,sort_order) VALUES(?1,?2,?3,?4,?5,?6,?7)').bind(randomId('lnk'),ownerType,ownerId,label,url,text(row.kind,80)||'website',integer(row.sortOrder,index)));});await env.DB.batch(statements);}
async function audit(env:Env,email:string,action:string,entityType:string,entityId:string,metadata:unknown){await env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id,metadata_json) VALUES(?1,?2,'staff',?3,?4,?5,?6)").bind(randomId('aud'),email,action,entityType,entityId,JSON.stringify(metadata)).run();}
function asKind(value:string):Kind{if(!KINDS.includes(value as Kind))throw new HttpError(404,'Unknown content type');return value as Kind;}
function tableFor(kind:Kind){return ({people:'people',organizations:'organizations',services:'services',projects:'projects',posts:'posts'} as const)[kind];}
function obj(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function text(value:unknown,max:number,required=false){const result=typeof value==='string'?value.trim():'';if(required&&!result)throw new HttpError(400,'Required field missing');if(result.length>max)throw new HttpError(400,'Field is too long');return result;}
function nullable(value:unknown,max:number){return text(value,max)||null;}
function slugValue(value:unknown){const slug=text(value,120,true).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new HttpError(400,'Invalid slug');return slug;}
function flag(value:unknown,fallback=false){if(value===undefined)return fallback?1:0;return value===true||value===1||value==='1'?1:0;}
function integer(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.trunc(n):fallback;}
function jsonArray(value:unknown){return JSON.stringify(Array.isArray(value)?value.filter(item=>typeof item==='string').map(item=>item.slice(0,120)):[]);}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
