# Sparaton implementation status

This is the production-readiness ledger for `Aspheral/Sparaton-Web`. Statuses describe the repository state, not whether account-specific Cloudflare, Resend, R2, DNS, or legal launch actions have been completed.

Legend:

- **IMPLEMENTED** — the engineering path exists and is covered by the repository's validation gates where practical.
- **PARTIAL** — useful implementation exists, but an identified engineering or production-verification gap remains.
- **BLOCKED** — engineering is prepared, but completion requires owner credentials, account configuration, legal confirmation, or real production infrastructure.
- **NOT IMPLEMENTED** — no production-capable implementation exists yet.

## Platform and CI

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Astro / Cloudflare monorepo retained | `apps/studios`, `apps/aspheral`, `apps/ilmp`, `apps/admin`, `workers/api`, shared packages. No competing rewrite was introduced. |
| IMPLEMENTED | Reproducible install | Tracked `package-lock.json`; CI uses `npm ci`. |
| IMPLEMENTED | Vitest / Playwright isolation | `vitest.config.ts` explicitly excludes `tests/e2e/**`; `playwright.config.ts` owns browser discovery. |
| IMPLEMENTED | Correct Playwright web server forwarding | Playwright starts Studios with `npm --workspace @sparaton/studios run dev -- --host 127.0.0.1 --port 4321`. |
| IMPLEMENTED | Separated CI responsibilities | `.github/workflows/ci.yml` separates D1 migration verification, static/type checks, unit/integration tests, production builds, and browser/E2E tests. |
| IMPLEMENTED | Browser matrix | Chromium, Firefox, WebKit, and Mobile Chromium remain configured. |
| IMPLEMENTED | Worker type-check isolation | `workers/api/tsconfig.json` scopes Worker TypeScript checks to Worker source without weakening Astro application checks. |
| PARTIAL | Final green CI on the second-pass final commit | GitHub Actions is the authority. Do not call the pass green until every job succeeds on the final ledger commit. |

## Ticket and communication system

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Canonical persisted ticket timeline | `workers/api/src/tickets.ts`, D1 ticket/message tables. |
| IMPLEMENTED | One active ticket per verified email | Application checks plus database-level invariant in migrations. |
| IMPLEMENTED | Hashed/expiring verification and access sessions | `workers/api/src/tickets.ts`, `workers/api/src/security.ts`; raw access tokens are not persisted. |
| IMPLEMENTED | Client realtime messaging | Durable Object `workers/api/src/ticket-room.ts`, client ticket UI, reconnect state. |
| IMPLEMENTED | Staff ticket detail workspace | `apps/admin/src/pages/tickets/[publicId].astro`, `apps/admin/public/ticket-workspace.js`. Complete conversation, requester/context, priority, status, assignment/transfer, notes, tags, status history, assignment history, audit and email-delivery history are exposed to authorized staff. |
| IMPLEMENTED | Assignment / transfer / status / priority / resolve / close / reopen paths | `workers/api/src/admin.ts` with server-side role checks and audit events. |
| IMPLEMENTED | Internal notes remain staff-only | Stored in `ticket_internal_notes`; returned only through Admin-authorized endpoints. Public/client APIs never merge notes into the client message timeline. |
| IMPLEMENTED | Realtime staff presence and replies | Admin ticket socket and Durable Object presence; workspace displays reconnect/online state. |
| IMPLEMENTED | Client-to-offline-staff email fallback | `workers/api/src/notifications.ts`; canonical message persists first, online staff suppress duplicate email, offline assigned staff receive notification when Resend is configured. |
| IMPLEMENTED | Staff-to-offline-client email fallback | `workers/api/src/notifications.ts`; canonical reply persists first, online client suppresses duplicate email, offline client receives a safe preview and ticket link. |
| IMPLEMENTED | Notification delivery history | `ticket_notification_deliveries` and Admin ticket history. Email failures do not roll back ticket messages. |
| PARTIAL | Canned responses | Backend/ticket workspace is operable without them, but a reusable canned-response editor/picker is not implemented. |

## Attachments

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Private R2 architecture | `workers/api/src/attachments.ts`, `Env.ATTACHMENTS`, private randomized keys. |
| IMPLEMENTED | Upload limits and validation | 10 MiB maximum; extension + MIME + content-signature inspection for allowed PDF/image/text types; executable/unrecognized content rejected. |
| IMPLEMENTED | Collision/path traversal resistance | Random storage identifiers; original filenames sanitized and retained as metadata only. |
| IMPLEMENTED | Authorized private retrieval | Separate client/staff authorization paths; internal attachments cannot be downloaded through client routes. |
| IMPLEMENTED | Safe downloads | `Content-Disposition: attachment`, `nosniff`, private/no-store semantics, D1 metadata and SHA-256. |
| IMPLEMENTED | Staff attachment workflow | Staff listing/upload/download and internal/client-visible selection in the ticket workspace. |
| IMPLEMENTED | Client attachment workflow | Private client listing/upload/download route and client ticket experience. |
| BLOCKED | Production R2 operation | Requires the owner-created R2 bucket and production Worker binding. No paid storage tier is enabled automatically. |

## Admin CMS

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Database-backed content workspace | `apps/admin/src/pages/content.astro`, `apps/admin/public/content-admin.js`. |
| IMPLEMENTED | People CRUD | D1-backed editor for display name, slug, role, biography, areas, image URL, availability, contact route, ordering, visibility and SEO. |
| IMPLEMENTED | Organizations CRUD | D1-backed editor for name, slug, kind, relationship label, description, subdomain, logo/contact, ordering, visibility and SEO. |
| IMPLEMENTED | Services CRUD | D1-backed editor for title, category, summary/body, scope, provider, organization, availability, supplied pricing text, inquiry CTA, ordering, visibility and SEO. |
| IMPLEMENTED | Projects CRUD | Generic D1 project model with status/feature flags, repository/release/docs fields, Markdown body, publication state and SEO. |
| IMPLEMENTED | Project metric editor | D1 upsert by project/key with label, value, qualifier, source/source URL, measured timestamp and measured/provisional/historical/target state. |
| IMPLEMENTED | Posts CRUD | Draft/published Markdown publishing with type, project/organization association and SEO. |
| IMPLEMENTED | Settings editor | D1-backed structured JSON settings for Owner/Administrator roles. |
| IMPLEMENTED | SEO controls | SEO title/description, canonical override, social title/description/image and robots index control are available on structured content. Admin itself remains forcibly noindex. |
| PARTIAL | Relationship-management ergonomics | Public data models and APIs support memberships, project credits and external links, but the second-pass CMS does not yet provide a dedicated visual relationship/social-link editor for all many-to-many relationships. |
| PARTIAL | Rich media library | Ticket attachments use R2 securely, but a general public CMS media-library/editor is not yet complete. |

## Public publishing and search quality

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Database-backed public project pages | `apps/studios/src/pages/projects/[slug].astro`, `workers/api/src/content.ts`. Draft/private projects are excluded. |
| IMPLEMENTED | Database-backed article pages | `apps/studios/src/pages/news/[slug].astro`; only published posts are exposed. |
| IMPLEMENTED | Database-backed person pages | `apps/studios/src/pages/people/[slug].astro`; respects public visibility. |
| IMPLEMENTED | Database-backed organization pages | `apps/studios/src/pages/organizations/[slug].astro`; respects public visibility. |
| IMPLEMENTED | Database-backed service pages | `apps/studios/src/pages/services/[slug].astro`; respects public visibility. |
| IMPLEMENTED | Public directories | `/projects`, `/people`, `/organizations`, existing services/news areas; failures render truthful unavailable/empty states rather than fake records. |
| IMPLEMENTED | Server rendering without client JS dependency | Dynamic detail pages retrieve structured API data server-side and render canonical HTML. |
| IMPLEMENTED | Real missing-content status | Dynamic routes return 404 for unpublished/missing data and 503 when the backing service is unavailable. |
| IMPLEMENTED | Dynamic sitemap | `apps/studios/src/pages/sitemap.xml.ts` derives URLs from public API collections and contains no manually duplicated dynamic-project/post list. |
| IMPLEMENTED | Database-backed RSS | `apps/studios/src/pages/rss.xml.ts` emits published post entries from the public content API. |
| IMPLEMENTED | Structured data | Studios organization plus page-appropriate Person, Article, SoftwareApplication/CreativeWork, Service and BreadcrumbList JSON-LD. Aspheral and Lattice Forge identify Sparaton Studios as the parent brand rather than reversing the hierarchy. |
| IMPLEMENTED | Canonical / OG / Twitter metadata | Page layouts and structured detail pages provide canonical and social metadata. |
| IMPLEMENTED | Original brand assets | Sparaton, Aspheral and ILMP SVG favicons/social preview art; Sparaton touch icon. |
| PARTIAL | Raster icon fallbacks | Modern SVG icon path is implemented. Additional raster fallback sizes can be generated at final production branding/export time. |

## GitHub project metadata

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Cached GitHub synchronization | `workers/api/src/github-sync.ts`, `project_github_metadata`, `integration_syncs`. |
| IMPLEMENTED | Truthful release handling | Latest release is stored/displayed only when GitHub reports an actual release; no fake Download CTA is generated. |
| IMPLEMENTED | Repository/default branch/languages/activity timestamp | Cached from GitHub and failure-tolerant. |
| IMPLEMENTED | Kay canonical repository | Kay continues to use `https://github.com/Aspheral/Kay-Chess`; it is not moved into the website repository. |
| IMPLEMENTED | External failure degradation | Sync failures update integration status/cache and do not make public project rendering depend on live GitHub availability. |
| BLOCKED | Higher authenticated GitHub API quota | Optional `GITHUB_TOKEN` must be provided as a secret if the owner wants authenticated API quota. Public unauthenticated sync remains possible within GitHub limits. |

## Analytics and operations

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Real Cloudflare analytics integration | `workers/api/src/analytics.ts` uses Cloudflare's GraphQL analytics API, not sample graphs. |
| IMPLEMENTED | Traffic ranges and dimensions | 24h / 7d / 30d; requests/visits, time data, popular routes, hostnames, referrers, countries, browser families and device categories where returned by Cloudflare. |
| IMPLEMENTED | Cached analytics | D1 `integration_cache` avoids wasteful repeated GraphQL queries. |
| IMPLEMENTED | Truthful unconfigured state | Admin clearly reports missing account/token/zone configuration. |
| IMPLEMENTED | Operations health surface | Admin overview/operations UI reports configuration state for D1/API, Durable Objects, email, analytics, attachment storage and GitHub sync plus synchronization/error information without exposing secrets. |
| BLOCKED | Real production traffic data | Requires production Cloudflare account/zone/API credentials and a deployed hostname receiving traffic. |

## Security and error handling

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Cloudflare Access + application roles | `workers/api/src/access.ts`, Admin same-origin proxy and server authorization. |
| IMPLEMENTED | Secure API failure envelope | Structured errors, no public stack traces/secrets; API request IDs are available for diagnosis. |
| IMPLEMENTED | CSP and security headers | Astro middleware on Studios, Aspheral, ILMP and Admin plus Worker response headers. No `unsafe-eval`; current CSP narrowly retains `unsafe-inline` for existing inline theme/JSON-LD behavior. |
| IMPLEMENTED | Transport/browser headers | HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, anti-framing controls. |
| IMPLEMENTED | Admin anti-indexing/cache controls | Admin middleware emits `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store`, in addition to page metadata. |
| IMPLEMENTED | Branded not-found surfaces | Studios, Aspheral, ILMP and Admin have explicit 404 experiences. |
| IMPLEMENTED | Public error vocabulary | Studios provides branded 400/401/403/404/429/500/503 surfaces; API errors remain structured JSON. |
| IMPLEMENTED | Realtime disconnect state | Ticket clients/admin display reconnecting state and retry rather than silently freezing. |
| IMPLEMENTED | Header regression tests | `tests/security.test.ts` verifies the middleware CSP/header baseline and Admin noindex/no-store behavior. |
| PARTIAL | CSP nonce/hash hardening | `unsafe-inline` is still required by the current inline Astro theme/JSON-LD scripts. Removing it entirely would require a nonce/hash rollout or moving every inline script without regressing no-flash theming. `unsafe-eval` is not used. |

## Database and migrations

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Normalized production schema | Organizations, people, memberships, links, projects, metrics, services, posts/authors, tickets/messages/participants/assignments/status/notes, sessions/verifications, media/attachments, roles, audit/settings/rate limiting. |
| IMPLEMENTED | Operability migration | `packages/database/migrations/0003_operability.sql` adds SEO fields, tags, notification deliveries, GitHub metadata/cache/sync and media hashing support. |
| IMPLEMENTED | Second-pass settings compatibility migration | `packages/database/migrations/0004_second_pass.sql` aligns settings key naming used by the Admin CMS. |
| IMPLEMENTED | Isolated migration verification | CI applies migrations to an isolated local/test D1 database; production databases are not used by CI. |
| PARTIAL | Production backup automation | Runbook/setup can be documented, but final backup validation depends on the actual Cloudflare production database/account. |

## Design and accessibility

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Existing editorial design retained | The first-pass visual language was refined rather than replaced; no template/architecture restart. |
| IMPLEMENTED | Shared light/dark system | Persisted system-aware themes across public sites and Admin. |
| IMPLEMENTED | Keyboard/reduced-motion/focus foundation | Shared UI styles retain skip navigation, focus treatment and reduced-motion handling. |
| IMPLEMENTED | Responsive ticket/CMS/public layouts | Second-pass operational screens include narrow-screen layout handling. |
| PARTIAL | Formal WCAG 2.2 AA audit | Automated/browser checks cover critical interactions, but a final manual assistive-technology/accessibility audit remains a pre-launch QA item. |

## External configuration blocked before public launch

The following are **BLOCKED** until the owner performs or authorizes the real account actions. The repository deliberately contains no fabricated values:

- Cloudflare account/zone setup and account-specific authoritative nameservers.
- GoDaddy nameserver change. This has **not** been performed.
- Production D1 creation/database ID and production migrations.
- Worker, Durable Object, R2 and site bindings to the real Cloudflare account.
- `sparaton.com`, `aspheral.sparaton.com`, `ilmp.sparaton.com`, `admin.sparaton.com`, API hostname and `www` redirect binding/HTTPS verification.
- Cloudflare Access application/AUD/team-domain and allowed staff identities.
- Resend domain verification and exact SPF/DKIM/DMARC records supplied by Resend.
- Production Resend API secret and ticket/session cryptographic secrets.
- Cloudflare Analytics API account/zone/token configuration.
- Optional authenticated GitHub token.
- Privacy/Terms retention, jurisdiction and legal-entity review.
- Final public staff titles/roster/contact information.
- Final verification of volatile Kay/ILMP claims immediately before launch.

The real domain must not be called live until the canonical HTTPS hostnames have actually been deployed and verified.

## Not implemented / deferred beyond this pass

- **NOT IMPLEMENTED:** Paid simultaneous-ticket override/payment flow. The schema/architecture leaves room for it; no payment is activated.
- **NOT IMPLEMENTED:** Full customer account system, billing history/invoices and saved briefs. These remain future account features by design.
- **NOT IMPLEMENTED:** General-purpose visual CMS relationship graph editor and complete reusable media library.

## Current validation gate

GitHub Actions is the source of truth. Before this pass is declared CI-green, the final `main` commit must complete all current jobs successfully:

1. Isolated D1 migrations
2. Static and type checks
3. Unit and integration tests
4. Production builds
5. Browser and E2E tests (Chromium, Firefox, WebKit, Mobile Chromium)

Do not infer success from earlier runs or from code inspection alone.
