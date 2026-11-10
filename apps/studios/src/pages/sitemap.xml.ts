// Only announce the approved public homepage while Sparaton is in prelaunch.
// Add other URLs when their content is approved, indexable, and linked from the site.
const canonicalUrl = 'https://sparaton.com/';

export const GET = () => {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${canonicalUrl}</loc></url>
</urlset>`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=900'
    }
  });
};
