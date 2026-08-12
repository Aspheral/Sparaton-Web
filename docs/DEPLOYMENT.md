# Production deployment

This document deliberately does not contain account-specific Cloudflare nameservers, tokens, D1 IDs, or email verification records.

## 1. Add Sparaton to Cloudflare

1. In Cloudflare, choose **Add a domain / website**.
2. Enter `sparaton.com`.
3. Select the intended plan.
4. Let Cloudflare scan existing DNS records.
5. Review every imported record. Do not delete unrelated mail or verification records merely to simplify the zone.
6. Cloudflare will display two authoritative nameservers for this zone. Copy those exact values.

## 2. Change nameservers at GoDaddy

The domain remains registered at GoDaddy.

1. Open **GoDaddy Domain Portfolio**.
2. Select `sparaton.com`.
3. Open **DNS** / **Nameservers**.
4. Choose the option to change/customize nameservers.
5. Paste the two nameserver hostnames Cloudflare assigned in the Cloudflare dashboard.
6. Save the change.
7. Return to Cloudflare and wait until the zone reports active.

Never substitute nameservers from a tutorial or another Cloudflare account.

## 3. Create Cloudflare resources

Create:

- one D1 database named `sparaton-db` (or choose a final name and update config);
- the `sparaton-api` Worker;
- Worker/Pages deployments for Studios, Aspheral, ILMP, and Admin;
- a Cloudflare Access application for `admin.sparaton.com`;
- Access protection for administrative API requests, with the admin application acting as the authenticated proxy;
- optional Cloudflare Web Analytics / analytics API configuration.

Copy the actual D1 database ID into `workers/api/wrangler.jsonc` where `REPLACE_WITH_D1_DATABASE_ID` appears.

Apply migrations before accepting tickets.

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

1. confirm Universal SSL/certificates cover the active hosts;
2. use **Full (strict)** whenever the origin/deployment path supports it;
3. enable **Always Use HTTPS**;
4. verify there is no redirect loop;
5. load every production hostname in a clean browser profile;
6. confirm no mixed content is requested.

## 7. Worker secrets

Configure, at minimum:

```text
RESEND_API_KEY
TICKET_TOKEN_PEPPER
SESSION_SIGNING_SECRET
CLOUDFLARE_ACCESS_TEAM_DOMAIN
CLOUDFLARE_ACCESS_AUD
ADMIN_OWNER_EMAILS   # bootstrap only if needed
```

Use the exact Access application AUD displayed by Cloudflare. Use the exact team domain for the Access organization.

## 8. Cloudflare Access

Create an Access application for `admin.sparaton.com` and restrict it to the approved staff identities. The application itself is not the only authorization layer. Staff roles are also checked by the Worker.

The Admin application proxies same-origin `/api/*` calls and forwards its Access JWT assertion to the Worker. Keep the API role checks enabled even if the Access policy is restrictive.

## 9. Resend DNS

After adding `sparaton.com` in Resend:

1. copy every DNS record Resend asks for;
2. add it to the Cloudflare zone using the exact name/type/value displayed;
3. follow Resend's proxy/DNS-only guidance for those records;
4. wait for Resend to report the domain verified;
5. confirm SPF and DKIM status;
6. add an appropriate DMARC policy after reviewing existing mail infrastructure and rollout requirements;
7. send verification and ticket-reply tests to external mailboxes.

Do not invent TXT values or replace existing SPF without merging it correctly.

## 10. D1 migration

From a configured checkout:

```bash
npm install
npm --workspace @sparaton/api run db:migrate:remote
```

Inspect the result. Then create the initial staff role records or bootstrap owner allowlist.

## 11. Search setup

After public launch:

- add and verify `sparaton.com` in Google Search Console;
- submit `https://sparaton.com/sitemap.xml`;
- add the public subdomains if separate property reporting is desired;
- add the site to Bing Webmaster Tools;
- verify robots and canonical tags from the production responses;
- do not index `admin.sparaton.com`.

## 12. Smoke test before announcing

Verify:

- `https://sparaton.com` returns 200;
- `https://www.sparaton.com/example?x=1` permanently redirects to `https://sparaton.com/example?x=1`;
- Aspheral and ILMP hosts return their own sites;
- Admin requires Access authentication;
- an unauthorized admin API mutation returns 401/403;
- a new inquiry sends verification;
- verification opens the correct private ticket;
- a second inquiry from the same email returns the existing conversation path through a new verification email;
- client reply persists after refresh;
- staff reply appears live when the client is connected;
- staff reply sends email when the client is offline;
- internal notes never appear in the public ticket response;
- closing/reopening rules work as configured;
- public pages contain no production secrets or stack traces.

## 13. Adding future subdomains

Deploy the new app/service, add the DNS/custom-domain binding in Cloudflare, configure its canonical host, and register its organization/subdomain relationship. Do not move the registrar merely to add a subdomain.
