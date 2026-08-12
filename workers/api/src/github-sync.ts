import { HttpError, requireAdmin } from './access';
import type { Env } from './env';

const MANAGE_ROLES=['owner','administrator','editor','creator'];

type RepoInfo={default_branch:string;pushed_at:string|null;html_url:string};
type ReleaseInfo={tag_name:string;name:string|null;html_url:string;published_at:string|null};

export async function adminSyncGithub(request:Request,env:Env,slug?:string):Promise<Response>{
  await requireAdmin(request,env,MANAGE_ROLES);
  if(slug){const project=await env.DB.prepare('SELECT id,repository_url FROM projects WHERE slug=?1').bind(slug).first<{id:string;repository_url:string|null}>();if(!project)throw new HttpError(404,'Project not found');if(!project.repository_url)throw new HttpError(400,'Project has no GitHub repository');return json(await syncOne(env,project.id,project.repository_url));}
  const result=await syncAllGithubProjects(env);return json(result);
}

export async function syncAllGithubProjects(env:Env){
  const projects=await env.DB.prepare("SELECT id,repository_url FROM projects WHERE repository_url LIKE 'https://github.com/%'").all<{id:string;repository_url:string}>();
  const results=[] as Array<{projectId:string;status:string}>;
  for(const project of projects.results){try{await syncOne(env,project.id,project.repository_url);results.push({projectId:project.id,status:'ok'});}catch{results.push({projectId:project.id,status:'failed'});}}
  const failed=results.filter(item=>item.status==='failed').length;
  await env.DB.prepare("INSERT INTO integration_syncs(integration,last_attempt_at,last_success_at,last_error,metadata_json,updated_at) VALUES('github',CURRENT_TIMESTAMP,CASE WHEN ?1=0 THEN CURRENT_TIMESTAMP ELSE NULL END,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(integration) DO UPDATE SET last_attempt_at=CURRENT_TIMESTAMP,last_success_at=CASE WHEN ?1=0 THEN CURRENT_TIMESTAMP ELSE integration_syncs.last_success_at END,last_error=?2,metadata_json=?3,updated_at=CURRENT_TIMESTAMP").bind(failed,failed?`${failed} project sync(s) failed`:null,JSON.stringify({total:results.length,failed})).run();
  return{total:results.length,failed,results};
}

async function syncOne(env:Env,projectId:string,repositoryUrl:string){
  const fullName=parseRepository(repositoryUrl);if(!fullName)throw new HttpError(400,'Repository URL is not a supported GitHub repository');
  const headers:Record<string,string>={'accept':'application/vnd.github+json','user-agent':'Sparaton-Web'};if(env.GITHUB_TOKEN)headers.authorization=`Bearer ${env.GITHUB_TOKEN}`;
  try{
    const repo=await githubJson<RepoInfo>(`https://api.github.com/repos/${fullName}`,headers);
    const releaseResponse=await fetch(`https://api.github.com/repos/${fullName}/releases/latest`,{headers});
    let release:ReleaseInfo|null=null;if(releaseResponse.ok)release=await releaseResponse.json<ReleaseInfo>();else if(releaseResponse.status!==404)throw new Error(`GitHub releases returned ${releaseResponse.status}`);
    const languages=await githubJson<Record<string,number>>(`https://api.github.com/repos/${fullName}/languages`,headers);
    await env.DB.prepare("INSERT INTO project_github_metadata(project_id,repository_full_name,default_branch,latest_release_tag,latest_release_name,latest_release_url,latest_release_at,languages_json,pushed_at,sync_status,sync_error,synced_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,'ok',NULL,CURRENT_TIMESTAMP) ON CONFLICT(project_id) DO UPDATE SET repository_full_name=excluded.repository_full_name,default_branch=excluded.default_branch,latest_release_tag=excluded.latest_release_tag,latest_release_name=excluded.latest_release_name,latest_release_url=excluded.latest_release_url,latest_release_at=excluded.latest_release_at,languages_json=excluded.languages_json,pushed_at=excluded.pushed_at,sync_status='ok',sync_error=NULL,synced_at=CURRENT_TIMESTAMP").bind(projectId,fullName,repo.default_branch,release?.tag_name??null,release?.name??null,release?.html_url??null,release?.published_at??null,JSON.stringify(languages),repo.pushed_at).run();
    return{projectId,repository:fullName,defaultBranch:repo.default_branch,latestRelease:release?{tag:release.tag_name,url:release.html_url,publishedAt:release.published_at}:null,languages,synced:true};
  }catch(error){const message=error instanceof Error?error.message.slice(0,500):'GitHub synchronization failed';await env.DB.prepare("INSERT INTO project_github_metadata(project_id,repository_full_name,sync_status,sync_error,synced_at) VALUES(?1,?2,'failed',?3,CURRENT_TIMESTAMP) ON CONFLICT(project_id) DO UPDATE SET repository_full_name=excluded.repository_full_name,sync_status='failed',sync_error=excluded.sync_error,synced_at=CURRENT_TIMESTAMP").bind(projectId,fullName,message).run();throw error;}
}
function parseRepository(url:string){try{const parsed=new URL(url);if(parsed.hostname.toLowerCase()!=='github.com')return null;const parts=parsed.pathname.replace(/\.git$/,'').split('/').filter(Boolean);if(parts.length!==2)return null;return `${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;}catch{return null;}}
async function githubJson<T>(url:string,headers:Record<string,string>){const response=await fetch(url,{headers});if(!response.ok)throw new Error(`GitHub API returned ${response.status}`);return response.json<T>();}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
