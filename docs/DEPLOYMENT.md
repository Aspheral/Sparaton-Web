# Production deployment

This document deliberately does not contain account-specific Cloudflare nameservers, tokens, D1 IDs, Access identities, or email verification records.

## 1. Add Sparaton to Cloudflare

1. In Cloudflare, choose **Add a domain / website**.
2. Enter `sparaton.com`.
3. Select the intended plan.
4. Let Cloudflare scan existing DNS records.
5. Review every imported record. Do not delete unrelated mail or verification records merely to simplify the zone.
6. Cloudflare will display the authoritative nameservers for this zone. Copy those exact values.

## 2. Change nameservers at GoDaddy

The domain remains registered at GoDaddy.

1. Open **GoDaddy Domain Portfolio**.
2. Select `sparaton.com`.
3. Open **DNS** / **Nameservers**.
4. Choose the option to change/customize nameservers.
5. Paste the nameserver hostnames Cloudflare assigned in the Cloudflare dashboard.
6. Save the change.
7. Return to Cloudflare and wait until the zone reports active.

Never substitute nameservers from a tutorial or another Cloudflare account. Do not perform this step until the owner explicitly authorizes the DNS cutover.

## 3. Create Cloudflare resources

Create or bind the resources named by the checked-in Worker configuration:

- D1 database `sparaton-production` and replace `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID` in `workers/api/wrangler.jsonc` with its real database ID;
- R2 bucket `sparaton-private-attachments`, bound as `ATTACHMENTS`;
- Durable Object binding `TICKET_ROOMS` for `TicketRoom`;
- the `sparaton-api` Worker;
- Worker/Pages deployments for Studios, Aspheral, ILMP, and Admin;
- a Cloudflare Access application for `admin.sparaton.com`;
- Access protection for administrative API requests, with the Admin application acting as the authenticated same-origin proxy.

Do not create or use a production resource for CI migration tests. CI uses `workers/api/wrangler.test.jsonc` and a local isolated `sparaton-test` D1 database.

Apply all D1 migrations before accepting tickets. R2 is private application storage; do not expose the bucket through a public custom domain.

## 4. Production hostnames

Attach deployments to:

```text
sparaton.com
aspheral.sparaton.com
ilmp.sparaton.com
admin.sparaton.com
api.sparaton.com
```

The `api` hostname is an implementation host. It does not replace the user-facing canonical root.

## 5. Canonical redirect

Create a Cloudflare Redirect Rule:

```text
Incoming hostname: www.sparaton.com
Target: https://sparaton.com${uri}
Status: 301 Permanent Redirect
Preserve path: yes
Preserve query string: yes
```

Verify with an HTTP client that both a root request and a nested `www` URL receive a single permanent redirect to the equivalent `https://sparaton.com` URL.

## 6. TLS

After DNS is active:

1. confirm Cloudflare certificates cover every active hostname;
2. use **Full (strict)** whenever the origin/deployment path supports it;
3. enable **Always Use HTTPS**;
4. verify there is no redirect loop;
5. load every production hostname in a clean browser profile;
6. confirm no mixed content is requested;
7. verify the response CSP/HSTS/nosniff/referrer/permissions policies in production before announcing the site.

## 7. Worker secrets and non-secret configuration

Configure the required secrets/values without committing them:

```text
RESEND_API_KEY
TICKET_TOKEN_PEPPER
SESSION_SIGNING_SECRET
CLOUDFLARE_ACCESS_TEAM_DOMAIN
CLOUDFLARE_ACCESS_AUD
ADMIN_OWNER_EMAILS
```

Optional integrations:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
GITHUB_TOKEN
```

The Analytics token should be scoped only to the zone/analytics permissions needed by the GraphQL integration. GitHub metadata synchronization can use unauthenticated public API access at lower rate limits, but a token is recommended for reliable scheduled refreshes. Never expose these values in Astro public environment variables.

## 8. Cloudflare Access

Create an Access application for `admin.sparaton.com` and restrict it to approved staff identities. Record the exact Access application AUD and team domain in Worker configuration/secrets.

Cloudflare Access is not the only authorization layer. The Worker also enforces application roles (`Owner`, `Administrator`, `Editor`, `Support`, `Creator`). The Admin application proxies same-origin `/api/*` requests and WebSocket upgrades and forwards the validated Access assertion to the API Worker. Keep server-side role checks enabled even when the Access policy is restrictive.

## 9. Resend DNS

After adding `sparaton.com` in Resend:

1. copy every DNS record Resend asks for;
2. add each record to the Cloudflare zone using the exact name/type/value displayed by Resend;
3. follow Resend's proxy/DNS-only guidance for those records;
4. wait for Resend to report the domain verified;
5. confirm SPF and DKIM status;
6. add an appropriate DMARC policy after reviewing existing mail infrastructure and rollout requirements;
7. send verification, client-reply fallback, and staff-reply fallback tests to external mailboxes.

Do not invent TXT values or replace an existing SPF record without merging it correctly.

## 10. D1 migrations

From a clean configured checkout:

```bash
npm ci
npm --workspace @sparaton/api run db:migrate:remote
```

Inspect the migration result. Then create the initial staff-role records or use the owner bootstrap allowlist only for the intended initial identities. Never run destructive test data against the production D1 database.

## 11. R2 attachments

After creating `sparaton-private-attachments`:

1. confirm `ATTACHMENTS` is bound to the API Worker;
2. keep the bucket private and application-authorized;
3. upload one allowed client-visible file and one internal-only staff file;
4. verify a client can retrieve only the client-visible file;
5. verify an authenticated staff user can retrieve both;
6. verify rejected extensions, mismatched MIME/magic bytes, and files larger than 10 MiB fail without leaving orphaned metadata;
7. establish an R2 lifecycle/retention policy only after the real privacy and retention policy is approved.

## 12. Analytics

The Admin traffic workspace is configuration-gated. To enable it, provide the real Cloudflare zone ID and a scoped API token. Then verify the 24-hour, 7-day, and 30-day views return the expected hostnames and routes. If credentials are absent or the API fails, the production UI must continue to show an explicit unavailable/configuration-required state rather than sample traffic.

## 13. GitHub metadata synchronization

The API Worker has a scheduled trigger for project metadata refresh. After deployment:

1. ensure projects use canonical `https://github.com/owner/repository` URLs;
2. optionally configure `GITHUB_TOKEN` for higher/reliable API rate limits;
3. trigger or wait for a synchronization and inspect `integration_syncs` / Admin operations health;
4. verify projects without a GitHub Release do not receive a fabricated Download link.

## 14. Search setup

After public launch:

- add and verify `sparaton.com` in Google Search Console;
- submit `https://sparaton.com/sitemap.xml`;
- add public subdomains as separate properties if separate reporting is useful;
- add the site to Bing Webmaster Tools;
- verify robots, canonical tags, JSON-LD, and social preview metadata from production responses;
- verify `admin.sparaton.com` and private ticket paths remain non-indexable.

## 15. Smoke test before announcing

Verify:

- `https://sparaton.com` returns 200 over HTTPS;
- `https://www.sparaton.com/example?x=1` permanently redirects to `https://sparaton.com/example?x=1`;
- Aspheral and ILMP hosts return their own sites;
- Admin requires Access authentication;
- an unauthorized admin API mutation returns 401/403;
- a new inquiry sends verification;
- verification opens the correct private ticket;
- a second inquiry from the same email returns the existing conversation through a fresh verification email;
- client replies persist after refresh;
- assignment/transfer/status/resolve/close/reopen operations persist and appear in history;
- internal notes never appear in the client API or client timeline;
- client and staff realtime delivery works;
- offline client and assigned-staff notification fallbacks work without duplicating mail for actively present recipients;
- client-visible and internal attachment authorization works;
- Analytics reports real configured data or a truthful unavailable state;
- GitHub synchronization degrades gracefully when GitHub is unavailable;
- public pages contain no production secrets or stack traces.

## 16. Adding future subdomains

Deploy the new app/service, add the DNS/custom-domain binding in Cloudflare, configure its canonical host, and register its organization/subdomain relationship. Do not move the registrar merely to add a subdomain.
