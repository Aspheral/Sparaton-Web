import { requireAdmin } from './access';
import type { Env } from './env';

const STAFF_ROLES=['owner','administrator','editor','support','creator'];
type RangeKey='24h'|'7d'|'30d';
const RANGE_MS:Record<RangeKey,number>={'24h':24*60*60*1000,'7d':7*24*60*60*1000,'30d':30*24*60*60*1000};

type Group={count:number;sum?:{visits?:number};dimensions?:Record<string,string|null>};
type AnalyticsZone={series:Group[];paths:Group[];hosts:Group[];countries:Group[];devices:Group[];referrers:Group[];userAgents:Group[]};

export async function adminAnalytics(request:Request,env:Env):Promise<Response>{
  await requireAdmin(request,env,STAFF_ROLES);
  const raw=new URL(request.url).searchParams.get('range')??'7d';const range=(raw==='24h'||raw==='30d'?raw:'7d') as RangeKey;
  if(!env.CLOUDFLARE_API_TOKEN||!env.CLOUDFLARE_ZONE_ID)return json({configured:false,reason:'Cloudflare Analytics requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.',range});
  const cacheKey=`analytics:${range}`,cached=await env.DB.prepare('SELECT value_json FROM integration_cache WHERE cache_key=?1 AND expires_at>CURRENT_TIMESTAMP').bind(cacheKey).first<{value_json:string}>();
  if(cached){try{return json({...JSON.parse(cached.value_json),cached:true});}catch{}}
  const end=new Date(),start=new Date(end.getTime()-RANGE_MS[range]);
  try{
    const zone=await queryCloudflare(env,start.toISOString(),end.toISOString());
    const requests=zone.series.reduce((sum,row)=>sum+(row.count??0),0),visits=zone.series.reduce((sum,row)=>sum+(row.sum?.visits??0),0);
    const data={
      configured:true,range,cached:false,generatedAt:end.toISOString(),requests,visits,
      series:zone.series.map(row=>({at:row.dimensions?.datetimeHour??'',requests:row.count,visits:row.sum?.visits??0})),
      popularRoutes:mapDimension(zone.paths,'clientRequestPath'),
      hostnames:mapDimension(zone.hosts,'clientRequestHTTPHost'),
      countries:mapDimension(zone.countries,'clientCountryName'),
      devices:mapDimension(zone.devices,'clientDeviceType'),
      referrers:mapDimension(zone.referrers,'clientRefererHost'),
      browsers:deriveBrowsers(zone.userAgents)
    };
    const expires=new Date(Date.now()+5*60*1000).toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO integration_cache(cache_key,value_json,expires_at,updated_at) VALUES(?1,?2,?3,CURRENT_TIMESTAMP) ON CONFLICT(cache_key) DO UPDATE SET value_json=excluded.value_json,expires_at=excluded.expires_at,updated_at=CURRENT_TIMESTAMP").bind(cacheKey,JSON.stringify(data),expires),
      env.DB.prepare("INSERT INTO integration_syncs(integration,last_attempt_at,last_success_at,last_error,metadata_json,updated_at) VALUES('cloudflare-analytics',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,?1,CURRENT_TIMESTAMP) ON CONFLICT(integration) DO UPDATE SET last_attempt_at=CURRENT_TIMESTAMP,last_success_at=CURRENT_TIMESTAMP,last_error=NULL,metadata_json=excluded.metadata_json,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify({range}))
    ]);
    return json(data);
  }catch(error){
    const message=error instanceof Error?error.message.slice(0,500):'Analytics request failed';
    await env.DB.prepare("INSERT INTO integration_syncs(integration,last_attempt_at,last_error,updated_at) VALUES('cloudflare-analytics',CURRENT_TIMESTAMP,?1,CURRENT_TIMESTAMP) ON CONFLICT(integration) DO UPDATE SET last_attempt_at=CURRENT_TIMESTAMP,last_error=excluded.last_error,updated_at=CURRENT_TIMESTAMP").bind(message).run();
    return json({configured:true,range,error:'Cloudflare Analytics is configured but currently unavailable.'},502);
  }
}

async function queryCloudflare(env:Env,start:string,end:string):Promise<AnalyticsZone>{
  const query=`query SparatonTraffic($zoneTag: string, $start: Time, $end: Time) { viewer { zones(filter: { zoneTag: $zoneTag }) {
    series: httpRequestsAdaptiveGroups(limit: 1000, orderBy: [datetimeHour_ASC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count sum { visits } dimensions { datetimeHour } }
    paths: httpRequestsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count dimensions { clientRequestPath clientRequestHTTPHost } }
    hosts: httpRequestsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count dimensions { clientRequestHTTPHost } }
    countries: httpRequestsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count dimensions { clientCountryName } }
    devices: httpRequestsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count dimensions { clientDeviceType } }
    referrers: httpRequestsAdaptiveGroups(limit: 20, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count dimensions { clientRefererHost } }
    userAgents: httpRequestsAdaptiveGroups(limit: 100, orderBy: [count_DESC], filter: { datetime_geq: $start, datetime_lt: $end, requestSource: "eyeball" }) { count dimensions { userAgent } }
  } } }`;
  const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({query,variables:{zoneTag:env.CLOUDFLARE_ZONE_ID,start,end}})});
  if(!response.ok)throw new Error(`Cloudflare Analytics returned ${response.status}`);
  const result=await response.json<{data?:{viewer?:{zones?:AnalyticsZone[]}};errors?:Array<{message?:string}>}>();
  if(result.errors?.length)throw new Error(result.errors.map(item=>item.message??'GraphQL error').join('; '));
  const zone=result.data?.viewer?.zones?.[0];if(!zone)throw new Error('Cloudflare Analytics returned no zone data');return zone;
}
function mapDimension(rows:Group[],key:string){return rows.map(row=>({label:row.dimensions?.[key]||'(unknown)',requests:row.count??0}));}
function deriveBrowsers(rows:Group[]){const totals=new Map<string,number>();for(const row of rows){const ua=(row.dimensions?.userAgent??'').toLowerCase();let family='Other';if(ua.includes('edg/'))family='Edge';else if(ua.includes('firefox/'))family='Firefox';else if(ua.includes('chrome/')||ua.includes('crios/'))family='Chrome';else if(ua.includes('safari/')&&!ua.includes('chrome/'))family='Safari';totals.set(family,(totals.get(family)??0)+(row.count??0));}return [...totals].map(([label,requests])=>({label,requests,derived:true})).sort((a,b)=>b.requests-a.requests);}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
