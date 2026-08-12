import type { Env } from './env';
import { requireAdmin, HttpError } from './access';
import { randomId } from './security';

const EDIT_ROLES=['owner','administrator','editor','creator'];
const ADMIN_ROLES=['owner','administrator'];
const METRIC_STATUSES=['measured','provisional','historical','target'] as const;

export async function publicPosts(env:Env){
  const rows=await env.DB.prepare("SELECT slug,type,title,summary,organization_id,project_id,published_at,updated_at,seo_title,seo_description,social_title,social_description,social_image_url FROM posts WHERE status='published' AND robots_index=1 ORDER BY published_at DESC LIMIT 100").all();
  return json({posts:rows.results});
}

export async function publicProjects(env:Env){
  const rows=await env.DB.prepare("SELECT p.id,p.slug,p.name,p.summary,p.status,p.featured,p.highlighted,p.pinned,p.experimental,p.repository_url,p.release_url,p.documentation_url,p.updated_at,p.seo_title,p.seo_description,p.social_title,p.social_description,p.social_image_url,o.slug AS organization_slug,o.name AS organization_name,g.default_branch,g.latest_release_tag,g.latest_release_name,g.latest_release_url,g.latest_release_at,g.languages_json,g.pushed_at,g.sync_status,g.synced_at FROM projects p LEFT JOIN organizations o ON o.id=p.organization_id LEFT JOIN project_github_metadata g ON g.project_id=p.id WHERE p.published_at IS NOT NULL AND p.status!='private' AND p.robots_index=1 ORDER BY p.featured DESC,p.highlighted DESC,p.updated_at DESC").all();
  return json({projects:rows.results});
}

export async function publicContentDetail(env:Env,kind:string,slug:string):Promise<Response>{
  const normalized=slugValue(slug);
  if(kind==='projects'){
    const item=await env.DB.prepare("SELECT p.*,o.slug AS organization_slug,o.name AS organization_name,g.repository_full_name,g.default_branch,g.latest_release_tag,g.latest_release_name,g.latest_release_url,g.latest_release_at,g.languages_json,g.pushed_at,g.sync_status,g.sync_error,g.synced_at FROM projects p LEFT JOIN organizations o ON o.id=p.organization_id LEFT JOIN project_github_metadata g ON g.project_id=p.id WHERE p.slug=?1 AND p.published_at IS NOT NULL AND p.status!='private'").bind(normalized).first<Record<string,unknown>&{id:string}>();
    if(!item)throw new HttpError(404,'Project not found');
    const [metrics,people,posts,links]=await Promise.all([
      env.DB.prepare('SELECT metric_key,label,value,qualifier,status,source,source_url,measured_at,updated_at FROM project_metrics WHERE project_id=?1 ORDER BY updated_at DESC').bind(item.id).all(),
      env.DB.prepare('SELECT pe.slug,pe.display_name,pp.credit_label FROM project_people pp JOIN people pe ON pe.id=pp.person_id WHERE pp.project_id=?1 AND pe.is_public=1 ORDER BY pp.sort_order,pe.display_name').bind(item.id).all(),
      env.DB.prepare("SELECT slug,type,title,summary,published_at FROM posts WHERE project_id=?1 AND status='published' ORDER BY published_at DESC LIMIT 20").bind(item.id).all(),
      env.DB.prepare("SELECT label,url,kind FROM external_links WHERE owner_type='project' AND owner_id=?1 ORDER BY sort_order,label").bind(item.id).all()
    ]);
    return json({item:{...item,metrics:metrics.results,people:people.results,posts:posts.results,links:links.results}});
  }
  if(kind==='posts'){
    const item=await env.DB.prepare("SELECT p.*,o.slug AS organization_slug,o.name AS organization_name,pr.slug AS project_slug,pr.name AS project_name FROM posts p LEFT JOIN organizations o ON o.id=p.organization_id LEFT JOIN projects pr ON pr.id=p.project_id WHERE p.slug=?1 AND p.status='published'").bind(normalized).first<Record<string,unknown>&{id:string}>();
    if(!item)throw new HttpError(404,'Post not found');
    const authors=await env.DB.prepare('SELECT pe.slug,pe.display_name FROM post_authors pa JOIN people pe ON pe.id=pa.person_id WHERE pa.post_id=?1 AND pe.is_public=1 ORDER BY pa.sort_order,pe.display_name').bind(item.id).all();
    return json({item:{...item,authors:authors.results}});
  }
  if(kind==='people'){
    const item=await env.DB.prepare('SELECT * FROM people WHERE slug=?1 AND is_public=1').bind(normalized).first<Record<string,unknown>&{id:string}>();
    if(!item)throw new HttpError(404,'Person not found');
    const [memberships,projects,links]=await Promise.all([
      env.DB.prepare('SELECT o.slug,o.name,m.role_label FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.person_id=?1 AND m.is_public=1 AND o.is_public=1 ORDER BY m.sort_order,o.name').bind(item.id).all(),
      env.DB.prepare('SELECT p.slug,p.name,p.summary,pp.credit_label FROM project_people pp JOIN projects p ON p.id=pp.project_id WHERE pp.person_id=?1 AND p.published_at IS NOT NULL AND p.status!=\'private\' ORDER BY pp.sort_order,p.name').bind(item.id).all(),
      env.DB.prepare("SELECT label,url,kind FROM external_links WHERE owner_type='person' AND owner_id=?1 ORDER BY sort_order,label").bind(item.id).all()
    ]);
    return json({item:{...item,memberships:memberships.results,projects:projects.results,links:links.results}});
  }
  if(kind==='organizations'){
    const item=await env.DB.prepare('SELECT * FROM organizations WHERE slug=?1 AND is_public=1').bind(normalized).first<Record<string,unknown>&{id:string}>();
    if(!item)throw new HttpError(404,'Organization not found');
    const [members,projects,links]=await Promise.all([
      env.DB.prepare('SELECT pe.slug,pe.display_name,m.role_label FROM memberships m JOIN people pe ON pe.id=m.person_id WHERE m.organization_id=?1 AND m.is_public=1 AND pe.is_public=1 ORDER BY m.sort_order,pe.display_name').bind(item.id).all(),
      env.DB.prepare("SELECT slug,name,summary,status FROM projects WHERE organization_id=?1 AND published_at IS NOT NULL AND status!='private' ORDER BY featured DESC,updated_at DESC").bind(item.id).all(),
      env.DB.prepare("SELECT label,url,kind FROM external_links WHERE owner_type='organization' AND owner_id=?1 ORDER BY sort_order,label").bind(item.id).all()
    ]);
    return json({item:{...item,members:members.results,projects:projects.results,links:links.results}});
  }
  if(kind==='services'){
    const item=await env.DB.prepare('SELECT s.*,o.slug AS organization_slug,o.name AS organization_name FROM services s LEFT JOIN organizations o ON o.id=s.organization_id WHERE s.slug=?1 AND s.is_public=1').bind(normalized).first();
    if(!item)throw new HttpError(404,'Service not found');return json({item});
  }
  throw new HttpError(404,'Content type not found');
}

export async function publicDirectory(env:Env,kind:string):Promise<Response>{
  if(kind==='people')return json({items:(await env.DB.prepare('SELECT slug,display_name,biography,role_text,areas_json,profile_image_url,availability,sort_order FROM people WHERE is_public=1 ORDER BY sort_order,display_name').all()).results});
  if(kind==='organizations')return json({items:(await env.DB.prepare('SELECT slug,name,kind,relationship_label,description,subdomain,logo_url,sort_order FROM organizations WHERE is_public=1 ORDER BY sort_order,name').all()).results});
  if(kind==='services')return json({items:(await env.DB.prepare('SELECT slug,name,summary,category,scope_text,provider_text,availability,pricing_model,inquiry_cta,sort_order FROM services WHERE is_public=1 ORDER BY sort_order,name').all()).results});
  throw new HttpError(404,'Directory not found');
}

export async function adminCollection(request:Request,env:Env,kind:string):Promise<Response>{
  await requireAdmin(request,env,EDIT_ROLES);
  if(kind==='people')return json({items:(await env.DB.prepare('SELECT * FROM people ORDER BY sort_order,display_name').all()).results});
  if(kind==='organizations')return json({items:(await env.DB.prepare('SELECT * FROM organizations ORDER BY sort_order,name').all()).results});
  if(kind==='services')return json({items:(await env.DB.prepare('SELECT * FROM services ORDER BY sort_order,name').all()).results});
  if(kind==='projects')return json({items:(await env.DB.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()).results});
  if(kind==='posts')return json({items:(await env.DB.prepare('SELECT * FROM posts ORDER BY updated_at DESC').all()).results});
  if(kind==='settings')return json({items:(await env.DB.prepare('SELECT key,value_json,updated_at FROM site_settings ORDER BY key').all()).results});
  throw new HttpError(404,'Collection not found');
}

export async function upsertPerson(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),d=await request.json<Record<string,unknown>>(),id=text(d.id,80,false)||randomId('per'),slug=slugValue(d.slug),displayName=text(d.displayName,180,true);
  const areas=jsonArray(d.areas,30,80),isPublic=boolInt(d.isPublic,true),sortOrder=intValue(d.sortOrder,0,-10000,10000),seo=seoFields(d);
  await env.DB.prepare(`INSERT INTO people(id,slug,display_name,biography,profile_image_url,availability,contact_route,is_public,role_text,areas_json,sort_order,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,display_name=excluded.display_name,biography=excluded.biography,profile_image_url=excluded.profile_image_url,availability=excluded.availability,contact_route=excluded.contact_route,is_public=excluded.is_public,role_text=excluded.role_text,areas_json=excluded.areas_json,sort_order=excluded.sort_order,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP`).bind(id,slug,displayName,text(d.biography,12000,false),nullable(d.profileImageUrl,600),nullable(d.availability,160),nullable(d.contactRoute,300),isPublic,nullable(d.role,180),JSON.stringify(areas),sortOrder,...seo).run();
  await audit(env,admin.email,'person.upsert','person',id);return json({id,slug});
}

export async function upsertOrganization(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),d=await request.json<Record<string,unknown>>(),id=text(d.id,80,false)||randomId('org'),slug=slugValue(d.slug),name=text(d.name,180,true),seo=seoFields(d);
  await env.DB.prepare(`INSERT INTO organizations(id,slug,name,kind,relationship_label,description,subdomain,logo_url,contact_route,is_public,sort_order,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,kind=excluded.kind,relationship_label=excluded.relationship_label,description=excluded.description,subdomain=excluded.subdomain,logo_url=excluded.logo_url,contact_route=excluded.contact_route,is_public=excluded.is_public,sort_order=excluded.sort_order,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP`).bind(id,slug,name,text(d.kind,40,false)||'organization',nullable(d.relationshipLabel,180),text(d.description,20000,false),nullable(d.subdomain,253),nullable(d.logoUrl,600),nullable(d.contactRoute,300),boolInt(d.isPublic,true),intValue(d.sortOrder,0,-10000,10000),...seo).run();
  await audit(env,admin.email,'organization.upsert','organization',id);return json({id,slug});
}

export async function upsertService(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),d=await request.json<Record<string,unknown>>(),id=text(d.id,80,false)||randomId('svc'),slug=slugValue(d.slug),name=text(d.name,180,true),seo=seoFields(d);
  await env.DB.prepare(`INSERT INTO services(id,slug,name,summary,body_markdown,pricing_model,availability,organization_id,is_public,category,scope_text,provider_text,inquiry_cta,sort_order,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,name=excluded.name,summary=excluded.summary,body_markdown=excluded.body_markdown,pricing_model=excluded.pricing_model,availability=excluded.availability,organization_id=excluded.organization_id,is_public=excluded.is_public,category=excluded.category,scope_text=excluded.scope_text,provider_text=excluded.provider_text,inquiry_cta=excluded.inquiry_cta,sort_order=excluded.sort_order,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,updated_at=CURRENT_TIMESTAMP`).bind(id,slug,name,text(d.summary,1600,true),text(d.bodyMarkdown,60000,false),nullable(d.pricingText,1000),nullable(d.availability,160),nullable(d.organizationId,80),boolInt(d.isPublic,true),nullable(d.category,120),nullable(d.scope,3000),nullable(d.provider,300),text(d.inquiryCta,180,false)||'Request a quote',intValue(d.sortOrder,0,-10000,10000),...seo).run();
  await audit(env,admin.email,'service.upsert','service',id);return json({id,slug});
}

export async function upsertProject(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),data=await request.json<Record<string,unknown>>(),id=text(data.id,80,false)||randomId('prj'),slug=slugValue(data.slug),name=text(data.name,180,true),summary=text(data.summary,1000,true),status=text(data.status,40,true),published=Boolean(data.published),seo=seoFields(data);
  await env.DB.prepare(`INSERT INTO projects(id,slug,organization_id,name,summary,body_markdown,status,featured,highlighted,pinned,experimental,repository_url,release_url,documentation_url,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,published_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,CASE WHEN ?22=1 THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,organization_id=excluded.organization_id,name=excluded.name,summary=excluded.summary,body_markdown=excluded.body_markdown,status=excluded.status,featured=excluded.featured,highlighted=excluded.highlighted,pinned=excluded.pinned,experimental=excluded.experimental,repository_url=excluded.repository_url,release_url=excluded.release_url,documentation_url=excluded.documentation_url,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,published_at=CASE WHEN ?22=1 THEN COALESCE(projects.published_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP`).bind(id,slug,nullable(data.organizationId,80),name,summary,text(data.bodyMarkdown,100000,false),status,boolInt(data.featured,false),boolInt(data.highlighted,false),boolInt(data.pinned,false),boolInt(data.experimental,false),nullable(data.repositoryUrl,500),nullable(data.releaseUrl,500),nullable(data.documentationUrl,500),...seo,published?1:0).run();
  await audit(env,admin.email,'project.upsert','project',id);return json({id,slug});
}

export async function upsertMetric(request:Request,env:Env,projectId:string):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),d=await request.json<Record<string,unknown>>(),key=slugValue(d.key),label=text(d.label,120,true),value=text(d.value,240,true),qualifier=text(d.qualifier,500,false),status=text(d.status,30,true);
  if(!METRIC_STATUSES.includes(status as typeof METRIC_STATUSES[number]))throw new HttpError(400,'Invalid metric status');
  const id=randomId('met');await env.DB.prepare(`INSERT INTO project_metrics(id,project_id,metric_key,label,value,qualifier,status,source,source_url,measured_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,CURRENT_TIMESTAMP) ON CONFLICT(project_id,metric_key) DO UPDATE SET label=excluded.label,value=excluded.value,qualifier=excluded.qualifier,status=excluded.status,source=excluded.source,source_url=excluded.source_url,measured_at=excluded.measured_at,updated_at=CURRENT_TIMESTAMP`).bind(id,projectId,key,label,value,qualifier||null,status,nullable(d.source,500),nullable(d.sourceUrl,600),nullable(d.measuredAt,80)).run();
  await audit(env,admin.email,'project.metric.upsert','project',projectId);return json({key});
}

export async function upsertPost(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,EDIT_ROLES),d=await request.json<Record<string,unknown>>(),id=text(d.id,80,false)||randomId('pst'),slug=slugValue(d.slug),title=text(d.title,220,true),summary=text(d.summary,1000,true),body=text(d.bodyMarkdown,100000,true),type=text(d.type,40,true),published=Boolean(d.published),seo=seoFields(d);
  await env.DB.prepare(`INSERT INTO posts(id,slug,type,title,summary,body_markdown,organization_id,project_id,status,seo_title,seo_description,canonical_url,social_title,social_description,social_image_url,robots_index,published_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,CASE WHEN ?9=1 THEN 'published' ELSE 'draft' END,?10,?11,?12,?13,?14,?15,?16,CASE WHEN ?9=1 THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,type=excluded.type,title=excluded.title,summary=excluded.summary,body_markdown=excluded.body_markdown,organization_id=excluded.organization_id,project_id=excluded.project_id,status=excluded.status,seo_title=excluded.seo_title,seo_description=excluded.seo_description,canonical_url=excluded.canonical_url,social_title=excluded.social_title,social_description=excluded.social_description,social_image_url=excluded.social_image_url,robots_index=excluded.robots_index,published_at=CASE WHEN ?9=1 THEN COALESCE(posts.published_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP`).bind(id,slug,type,title,summary,body,nullable(d.organizationId,80),nullable(d.projectId,80),published?1:0,...seo).run();
  await audit(env,admin.email,'post.upsert','post',id);return json({id,slug,status:published?'published':'draft'});
}

export async function upsertSetting(request:Request,env:Env):Promise<Response>{
  const admin=await requireAdmin(request,env,ADMIN_ROLES),d=await request.json<Record<string,unknown>>(),key=text(d.key,120,true);
  if(!/^[a-z0-9][a-z0-9._-]*$/.test(key))throw new HttpError(400,'Invalid setting key');
  const value=d.value??null;const valueJson=JSON.stringify(value);if(valueJson.length>20000)throw new HttpError(400,'Setting value is too large');
  await env.DB.prepare('INSERT INTO site_settings(key,value_json,updated_at,updated_by) VALUES(?1,?2,CURRENT_TIMESTAMP,?3) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by').bind(key,valueJson,admin.email).run();
  await audit(env,admin.email,'setting.upsert','setting',key);return json({key});
}

export async function deleteContent(request:Request,env:Env,kind:string,id:string):Promise<Response>{
  const admin=await requireAdmin(request,env,ADMIN_ROLES);const tables:Record<string,string>={people:'people',organizations:'organizations',services:'services',projects:'projects',posts:'posts'};const table=tables[kind];if(!table)throw new HttpError(404,'Content type not found');
  const result=await env.DB.prepare(`DELETE FROM ${table} WHERE id=?1`).bind(id).run();if(!result.meta.changes)throw new HttpError(404,'Content item not found');await audit(env,admin.email,`${kind}.delete`,kind,id);return json({deleted:true});
}

async function audit(env:Env,email:string,action:string,type:string,id:string){await env.DB.prepare("INSERT INTO audit_events(id,actor_email,actor_kind,action,entity_type,entity_id) VALUES(?1,?2,'staff',?3,?4,?5)").bind(randomId('aud'),email,action,type,id).run();}
function text(v:unknown,max:number,required:boolean){const s=typeof v==='string'?v.trim():'';if(required&&!s)throw new HttpError(400,'Missing required field');if(s.length>max)throw new HttpError(400,'Field too long');return s;}
function nullable(v:unknown,max:number){const s=text(v,max,false);return s||null;}
function slugValue(v:unknown){const s=text(v,120,true).toLowerCase();if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))throw new HttpError(400,'Invalid slug');return s;}
function boolInt(v:unknown,fallback:boolean){return (typeof v==='boolean'?v:fallback)?1:0;}
function intValue(v:unknown,fallback:number,min:number,max:number){const n=typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):fallback;if(!Number.isInteger(n)||n<min||n>max)throw new HttpError(400,'Invalid numeric value');return n;}
function jsonArray(v:unknown,maxItems:number,maxLength:number){if(!Array.isArray(v))return[];if(v.length>maxItems)throw new HttpError(400,'Too many list items');return v.map(item=>text(item,maxLength,true));}
function seoFields(d:Record<string,unknown>):[string|null,string|null,string|null,string|null,string|null,string|null,number]{return[nullable(d.seoTitle,220),nullable(d.seoDescription,500),nullable(d.canonicalUrl,600),nullable(d.socialTitle,220),nullable(d.socialDescription,500),nullable(d.socialImageUrl,600),boolInt(d.robotsIndex,true)];}
function json(v:unknown,status=200){return new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
