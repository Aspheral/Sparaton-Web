const API='https://api.sparaton.com';
const staticUrls=['/','/projects','/people','/organizations','/services','/news','/contact','/privacy','/terms','/accessibility','/responsible-disclosure'];
export const GET=async()=>{
  const dynamic:string[]=[];
  await Promise.all([
    collect('/v1/content/projects','projects','projects',dynamic),
    collect('/v1/content/posts','posts','news',dynamic),
    collect('/v1/content/people','items','people',dynamic),
    collect('/v1/content/organizations','items','organizations',dynamic),
    collect('/v1/content/services','items','services',dynamic)
  ]);
  const urls=[...staticUrls,...dynamic];
  const body=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(path=>`<url><loc>${xml(`https://sparaton.com${path}`)}</loc></url>`).join('')}</urlset>`;
  return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300, s-maxage=900'}});
};
async function collect(endpoint:string,key:string,prefix:string,target:string[]){try{const response=await fetch(`${API}${endpoint}`);if(!response.ok)return;const data=await response.json() as Record<string,unknown>;const items=Array.isArray(data[key])?data[key] as Array<Record<string,unknown>>:[];for(const item of items){if(typeof item.slug==='string')target.push(`/${prefix}/${encodeURIComponent(item.slug)}`);}}catch{}}
function xml(value:string){return value.replace(/[<>&'"]/g,char=>({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[char]??char));}
