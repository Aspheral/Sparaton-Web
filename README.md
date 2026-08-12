# Sparaton Web

Production web platform for Sparaton Studios and its first-party sub-sites.

Canonical public host: `https://sparaton.com`

Initial hosts:

- `sparaton.com` — Sparaton Studios
- `aspheral.sparaton.com` — Aspheral Softworks
- `ilmp.sparaton.com` — ILMP / Lattice Forge
- `admin.sparaton.com` — private operations workspace
- `api.sparaton.com` — Workers API and ticket realtime endpoint

The repository intentionally keeps code, editable content, configuration, and secrets separate. No production secret belongs in Git.

## Architecture

```text
apps/
  studios/       public Sparaton site
  aspheral/      Aspheral Softworks
  ilmp/          ILMP / Lattice Forge
  admin/         Access-protected admin application
packages/
  content/       versioned seed/editorial content
  database/      D1 migrations and database helpers
  email/         email provider abstraction and templates
  types/         shared domain types
  ui/            shared design tokens, CSS, and brand mark
workers/
  api/            D1, ticket API, Durable Object realtime, admin API
```

Public sites use Astro server rendering on Cloudflare. Interactive behavior is kept to small browser scripts. Ticket realtime uses a Durable Object per public ticket ID and the WebSocket Hibernation API. D1 is the durable source of truth for every ticket message; WebSockets are delivery, not persistence.

## Requirements

- Node.js 22 or a currently supported Node release
- npm 10+
- a Cloudflare account
- a Cloudflare D1 database
- Resend, once ticket email is enabled
- Cloudflare Access for the admin host
- the owned `sparaton.com` domain

## Local setup

```bash
npm install
cp .env.example .env
npm run check
npm test
npm run build
```

Run a site:

```bash
npm run dev:studios
npm run dev:aspheral
npm run dev:ilmp
npm run dev:admin
npm run dev:api
```

The Worker uses Wrangler secrets rather than `.env` in production.

## Database

Create a D1 database in the Cloudflare dashboard or with Wrangler, copy its database ID into `workers/api/wrangler.jsonc`, then run:

```bash
npm --workspace @sparaton/api run db:migrate:local
npm --workspace @sparaton/api run db:migrate:remote
```

Migrations are append-only. Do not edit an already-applied production migration to change history. Add a new numbered migration.

The initial schema includes normalized organization, people, membership, project, metric, service, publishing, ticket, message, assignment, status-history, note, verification, session, attachment, staff-role, audit, settings, and rate-limit data.

## Ticket flow

1. A visitor submits the Sparaton inquiry form.
2. The Worker validates input, honeypot, rate limit, and the one-active-ticket rule.
3. A cryptographically random verification token is generated. Only its keyed hash is stored.
4. Resend sends the verification link.
5. Verification creates a separate random access session. Only its hash is stored in D1.
6. The session is carried by a Secure, HttpOnly, SameSite cookie scoped to `.sparaton.com`.
7. The private ticket page loads the persisted timeline and receives a session-bound CSRF token.
8. Messages are written to D1 first, then broadcast through the ticket Durable Object.
9. When staff replies and no client WebSocket is present, Resend sends a safe preview and secure ticket link.

If verification email cannot be sent for a newly created ticket, that ticket is archived immediately rather than leaving a user trapped behind an inaccessible active ticket.

## One active ticket policy

The application treats `new`, `open`, `assigned`, `awaiting_staff`, and `awaiting_client` as active. When a matching normalized email already has one, a new conversation is not created. Instead a fresh verification link for the existing conversation is sent.

The database model leaves room for a future policy/entitlement layer for simultaneous tickets. No payment feature or fee is enabled in this release.

## Admin access

`admin.sparaton.com` must be protected by Cloudflare Access before launch. The app also performs application-level role checks in the API.

Supported roles:

- Owner
- Administrator
- Editor
- Support
- Creator

Browser admin requests go to a same-origin `/api/*` proxy. The proxy requires a custom request header to block cross-site form CSRF, obtains the Access assertion on the protected admin host, and forwards it to the role-enforced API. Do not change the admin UI back to direct browser calls to `api.sparaton.com`.

Seed the first owner either with `ADMIN_OWNER_EMAILS` as a temporary bootstrap allowlist or by inserting an `owner` record into `staff_roles`. Remove unnecessary bootstrap emails after roles are established.

## Resend

Set these Worker secrets/variables:

```text
RESEND_API_KEY
EMAIL_FROM_NOTIFICATIONS=notifications@sparaton.com
EMAIL_FROM_TICKETS=tickets@sparaton.com
```

Verify the Sparaton sending domain inside Resend first. Add exactly the DNS records Resend displays. Do not guess SPF or DKIM values.

The provider is abstracted through `packages/email`. Replace the implementation there if Sparaton changes providers later.

## Secrets

Generate high-entropy values for:

```text
TICKET_TOKEN_PEPPER
SESSION_SIGNING_SECRET
```

Store production values with Wrangler secrets, not in `wrangler.jsonc` and not in GitHub.

Example:

```bash
cd workers/api
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TICKET_TOKEN_PEPPER
npx wrangler secret put SESSION_SIGNING_SECRET
```

## Publishing

The admin API can create/update projects, project metrics, and posts. Metrics are first-class records with a label, value, qualifier, status, source, and update time. This is why changing a Kay Elo estimate does not require finding strings in page components.

Published posts are exposed through the content API and the public News archive. Draft content is not returned by public endpoints.

## Kay Chess

Kay is represented through the same project model as any other Aspheral project. Current seed metrics are intentionally qualified as local/provisional where appropriate. NPS is presented as diagnostic throughput rather than a playing-strength proxy. A release/download CTA is not emitted unless release data exists.

Repository: `https://github.com/Aspheral/Kay-Chess`

## ILMP

The ILMP site uses implementation-backed language for Container 2.0 and the Image/Animate/Video model-family split. Benchmark victories are not asserted unless backed by measured source data.

## Adding a new project

Use the admin Project editor once deployed, or insert/import a project through an authenticated admin API. Add metrics independently. Do not add project-specific component branches unless the presentation genuinely requires art direction beyond the generic project model.

## Adding a creator or organization

Create the person/organization in D1, then memberships and relationships. Public contact should normally route into Sparaton tickets rather than exposing private email addresses.

## Adding a new Sparaton sub-site

1. Add an Astro app under `apps/<site>`.
2. Depend on `@sparaton/ui` rather than copying the design system.
3. Give the app its own canonical `site` in `astro.config.mjs`.
4. Add the hostname to Cloudflare after deployment.
5. Add the organization/subdomain relationship to D1.
6. Update cross-site navigation only where the new destination is public.
7. Add the host to Search Console/Bing tools when appropriate.

Subdomains are architecture, not a hardcoded routing switch in the Sparaton root application.

## Analytics

The admin dashboard never fabricates traffic. Until Cloudflare analytics credentials/query integration is configured, Site Traffic explicitly shows an unconfigured state. When enabled, keep analytics reads server-side and expose only the dashboard aggregates staff need.

## Tests

```bash
npm test
npm run check
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
```

Playwright projects cover Chromium, Firefox, and WebKit. Critical production ticket tests should additionally run against an isolated D1/Worker test environment before DNS cutover.

## Backups

Before destructive schema work or major migration:

1. export or backup D1 using the current Cloudflare-supported mechanism;
2. verify the backup exists outside the running database;
3. record the migration/commit SHA;
4. run the migration in staging/local D1 first;
5. test ticket reads/writes and publishing after migration.

Never commit a production database export.

## Production deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Domain ownership remains at GoDaddy. DNS authority moves to the Cloudflare nameservers Cloudflare assigns to the zone.

## Security

See [`docs/SECURITY.md`](docs/SECURITY.md). Report suspected vulnerabilities through the Responsible Disclosure route once the site is live.

## Launch status

See [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md). Public DNS, Cloudflare credentials, Resend domain verification, legal review, and the initial staff allowlist require human confirmation before a legitimate production cutover.
