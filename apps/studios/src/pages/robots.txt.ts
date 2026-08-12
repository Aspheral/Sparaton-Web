export const GET=()=>new Response('User-agent: *\nAllow: /\nDisallow: /tickets/\nSitemap: https://sparaton.com/sitemap.xml\n',{headers:{'content-type':'text/plain; charset=utf-8'}});
