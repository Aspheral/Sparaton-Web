type PublicPost = { slug:string; title:string; summary:string; published_at:string|null };
const escapeXml=(value:string)=>value.replace(/[<>&'\"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]??char));

export const GET=async()=>{
  let posts:PublicPost[]=[];
  try {
    const response=await fetch('https://api.sparaton.com/v1/content/posts');
    if(response.ok){
      const payload=await response.json() as {posts?:PublicPost[]};
      posts=payload.posts??[];
    }
  } catch {}

  const items=posts.map(post=>`<item><title>${escapeXml(post.title)}</title><link>https://sparaton.com/news/${encodeURIComponent(post.slug)}</link><guid>https://sparaton.com/news/${encodeURIComponent(post.slug)}</guid><description>${escapeXml(post.summary)}</description>${post.published_at?`<pubDate>${new Date(post.published_at).toUTCString()}</pubDate>`:''}</item>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Sparaton Studios</title><link>https://sparaton.com</link><description>News and development from Sparaton Studios and its ecosystem.</description>${items}</channel></rss>`,{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':'public, max-age=300'}});
};
