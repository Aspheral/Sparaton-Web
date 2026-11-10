# Sparaton search appearance and indexing

The approved public identity is **Sparaton**, an independent manga production studio. Use the brand spelling consistently. Do **not** add misleading competitor names, unrelated lookalike keywords, fabricated awards, fake reviews, an unverified location, or unapproved social profiles.

## What the homepage supplies

- Search title: `Sparaton | Independent Manga Production Studio`
- Meta description: `Sparaton is an independent manga production studio developing original stories, characters, and worlds. Meet our creators and contact the studio.`
- Canonical: `https://sparaton.com/`
- Google-compatible square PNG favicon at `/favicon.png`, using the original Sparaton mark
- 1200 × 630 PNG social-sharing image at `/og/sparaton.png`, using the original mark
- Open Graph/Twitter metadata and `WebSite` + `Organization` JSON-LD
- A prelaunch sitemap containing only `https://sparaton.com/`, advertised by `/robots.txt`

**Robots rule:** The Astro homepage sets `index,follow,max-image-preview:large` only when its request hostname is exactly `sparaton.com`. Every other hostname (local dev, preview, staging and currently `www`) receives `noindex,follow`. This deliberately prevents a temporary preview from competing with the canonical production site. Do not remove preview `noindex` just to make the preview appear in Google.

## Before submitting to search engines

1. Approve the final content and finish the independent manga site's production hosting.
2. Connect `sparaton.com` (and redirect `www.sparaton.com` to it) through the chosen hosting platform. Do not touch MX, SPF, DKIM, DMARC, or Zoho verification records. If nameservers change, replicate **all** DNS records first.
3. Verify `https://sparaton.com/` serves this actual HTML over HTTPS, returns **200**, and contains `index,follow` rather than `noindex`.
4. Fetch `https://sparaton.com/favicon.png`, `https://sparaton.com/og/sparaton.png`, `https://sparaton.com/robots.txt`, and `https://sparaton.com/sitemap.xml`. Confirm PNG dimensions, correct content types, and valid XML.
5. Test the homepage with Google's Rich Results Test and URL Inspection. Rich results, knowledge panels, and rankings are **not guaranteed** by metadata.
6. Add a **Domain property** in [Google Search Console](https://search.google.com/search-console), verify domain ownership (commonly a new DNS TXT record), and submit `https://sparaton.com/sitemap.xml`. Preserve existing DNS records while adding verification.
7. Use URL Inspection to request indexing of the homepage once it is public. Monitor `Pages` and `Performance` for coverage and real search queries.
8. Register the domain in [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit the same sitemap, or use its supported Search Console import.
9. Review the actual branded search results after crawling and improve real content as Sparaton publishes more stories. Expect recrawling/indexing to take time.

## Brand and similar-sounding queries

Search engines decide whether a spelling, misspelling, or similar-sounding query is related to Sparaton. Explicitly name **Sparaton** and its category naturally in visible copy, titles, and structured data. Build legitimate links and publish distinctive original manga content over time. Avoid adding other companies' names or fake `alternateName` values to manipulate ranking.

## Maintenance

- When a published manga title gets a real page, give it its own accurate title, description, image, canonical URL and sitemap entry.
- Keep privacy/legal policies truthful before publishing them.
- Don't announce unapproved release dates or team profiles.
- Search snippets may differ from the provided meta description; Google may select on-page text.
- Never claim this deployment is indexed or guaranteed to rank merely because the metadata is present.
