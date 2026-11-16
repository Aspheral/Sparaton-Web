# Sparaton bootstrap: first public page

This folder is a **temporary, minimal production site** whose root path displays exactly:

> Hello, World!

It deliberately stays separate from `apps/studios` and the KISS design draft. We can replace this static Worker later with the main Astro-based studio without losing our source code or disturbing the email provider.

## Deploy to Cloudflare Workers

Requirements: a Cloudflare account with access to the `sparaton.com` zone, Node.js 22+, and permission to deploy Workers.

From a checkout of this branch:

```sh
cd apps/bootstrap
npx wrangler login
npx wrangler deploy
```

The deployment first creates the `sparaton-bootstrap` Worker, typically with an assigned `*.workers.dev` URL. **Verify the public Worker URL displays `Hello, World!` before redirecting the domain.** The Worker requires no database, API keys, environment variables, or payment processing.

## Domain cutover checklist: do not skip

The domain registrar remains GoDaddy. Hosting on Cloudflare does not require transferring the registration.

1. In **GoDaddy > DNS**, export or carefully record the complete current DNS zone: every record, name, type, priority, TTL and value. Include existing HTTPS/CAA/DNSSEC configuration, if any.
2. Create the `sparaton.com` zone in **Cloudflare**. Review its DNS imports against the GoDaddy records before making changes.
3. Confirm `aspheral@sparaton.com`, `pascshadow@sparaton.com`, and `support@sparaton.com` sending/receiving status in Zoho. Preserve the existing MX records `mx.zoho.com` priority 10, `mx2.zoho.com` priority 20, `mx3.zoho.com` priority 50; **copy their exact current authoritative values**, not these descriptions alone.
4. Preserve the **single** existing root SPF TXT (`v=spf1 include:zohomail.com ~all`, unless since changed); **all** DKIM key/selector TXT records (including the full, real `zmail._domainkey` value); Zoho verification TXT; `_dmarc` TXT; and any other verification or service records. Do not proxy mail DNS records. Do not modify DMARC policy during the website cutover.
5. Verify there are no DNSSEC/DS record conflicts before changing authority. Never delete DNSSEC without checking whether it is enabled and whether Cloudflare's setup requires a DS update.
6. **Only after** the Cloudflare DNS zone is complete, change the GoDaddy **nameservers** to the **exact pair Cloudflare assigned your zone**. These are account-specific; do not copy generic nameservers from a tutorial.
7. Once Cloudflare reports the zone **Active**, go to **Workers & Pages > sparaton-bootstrap > Settings > Domains & Routes > Add > Custom Domain**, then add **`sparaton.com`**. Resolve any conflicting *website* A/CNAME records in Cloudflare as instructed. **Do not delete MX/TXT email records.** Alternatively, after the zone is active, configure a `custom_domain: true` route in `wrangler.jsonc` and deploy.
8. Verify `https://sparaton.com/` returns 200, HTTPS certificate is valid, and the text is exactly `Hello, World!`. Verify `www` handling separately if needed.
9. Re-test external mail to and from Zoho accounts and support alias. Check MX/SPF/DKIM/DMARC against the authoritative DNS and run a fresh delivery test.
10. After public KISS/SEO launch, retire this bootstrap Worker and remove the temporary `noindex` directive from the **replacement** homepage.

**Do not attach a Custom Domain until the zone is active and mail records have been preserved.** Do not change only the nameservers and assume automatic DNS imports are complete. No change to DNS has been made by adding this code.

## Why Cloudflare for the future studio?

The main repository already uses Astro 7 + `@astrojs/cloudflare` for server-side rendered sites, and Cloudflare Workers for APIs. Serve static manga cover art via Cloudflare's static assets or R2 and use a database for publication metadata only when needed. Subdomains and separate Workers can isolate the API, editorial UI, and admin backend as the studio grows.

This deployment is intentionally `noindex`, to avoid Google indexing a temporary Hello World placeholder. The public manga site will replace it after the design, accessibility, legal and SEO reviews.
