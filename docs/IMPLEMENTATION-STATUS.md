# Sparaton implementation status

This is the production-readiness ledger for `Aspheral/Sparaton-Web` after the third production engineering pass. Statuses describe the repository state. They do **not** imply that real Cloudflare resources, Resend credentials, DNS, legal policy, or the canonical Sparaton hostnames have been provisioned or verified.

Legend:

- **IMPLEMENTED** — a production-capable engineering path exists and is exercised by repository validation where practical.
- **PARTIAL** — useful implementation exists, but a known engineering, policy, or real-environment verification gap remains.
- **BLOCKED** — engineering is prepared, but completion requires owner credentials, account configuration, legal confirmation, or authorized real infrastructure.
- **NOT IMPLEMENTED** — no production-capable implementation exists.

## Third-pass CI baseline

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | First fully green third-pass baseline | `45fad6c28738b5a0981bc4f73332ab324458c7d4`, GitHub Actions run `31556186299` / #80. |
| IMPLEMENTED | Reproducible install | Tracked `package-lock.json`; all CI jobs use `npm ci`. |
| IMPLEMENTED | Vitest / Playwright isolation | `vitest.config.ts` excludes `tests/e2e/**`; `playwright.config.ts` owns E2E discovery. |
| IMPLEMENTED | Separated CI responsibilities | `.github/workflows/ci.yml` has independent static/type, unit/integration, isolated D1 migration, production-build, and browser/E2E jobs. |
| IMPLEMENTED | Four-browser matrix | Chromium, Firefox, WebKit, and Mobile Chromium all execute. Playwright now starts Studios, Aspheral, ILMP, and Admin for cross-site QA. |
| IMPLEMENTED | Browser failure artifacts | Failed browser jobs retain traces, screenshots, video, HTML report, and test results for seven days. |
| IMPLEMENTED | WebKit local-TLS regression fixed at root | Shared environment-aware CSP/HSTS policy does not upgrade local HTTP to a nonexistent HTTPS origin; production HTTPS keeps HSTS and `upgrade-insecure-requests`. `tests/security-policy.test.ts` and E2E coverage guard this behavior. |
| IMPLEMENTED | Static error-page type invariant | `apps/studios/src/pages/errors/[code].astro` narrows to an explicit supported-code union and typed copy record; no non-null assertion is used to hide the invariant. |

GitHub Actions remains the final authority. The final completion report must use the workflow run for the final ledger commit, not infer success from an earlier SHA.

## Ticket and communication system

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Canonical persisted ticket timeline | D1 ticket/message state in `workers/api/src/tickets.ts`; email and realtime are transports around the canonical record. |
| IMPLEMENTED | One active ticket per verified email | Application enforcement plus database invariant. Existing active conversations receive a fresh verification path instead of a second active ticket. |
| IMPLEMENTED | Hashed/expiring verification and access sessions | `workers/api/src/security.ts`, `workers/api/src/tickets.ts`; raw session/verification tokens are not persisted. |
| IMPLEMENTED | Realtime client/staff conversation | Durable Object `workers/api/src/ticket-room.ts`; both client and staff surfaces report reconnecting state instead of silently freezing. |
| IMPLEMENTED | Staff ticket workspace | `apps/admin/src/pages/tickets/[publicId].astro`, `apps/admin/public/ticket-workspace.js`; complete client/staff timeline, requester/context, assignment, transfer, status/priority, tags, internal notes, history, audit, attachments, notification state, and presence. |
| IMPLEMENTED | Assignment / transfer / resolve / close / reopen | `workers/api/src/admin.ts` with server-side role checks and status history. Closed/archived reply restrictions remain enforced. |
| IMPLEMENTED | Internal-note privacy | Notes live in `ticket_internal_notes` and are returned only by Admin-authorized routes. They are never merged into the client message API or email fallback. |
| IMPLEMENTED | Offline notification state machine | `workers/api/src/notifications.ts`; messages persist first, online recipients suppress duplicate fallback mail, offline recipients receive safe previews when email is configured, and delivery failures do not remove canonical messages. |
| IMPLEMENTED | Staging email suppression | `EMAIL_DELIVERY_MODE=disabled` blocks notification and initial verification delivery. Staging cannot accidentally send real email merely because a Resend key is present. |
| IMPLEMENTED | Canned response CRUD and picker | `workers/api/src/canned-responses.ts`, Admin Operations editor, and ticket composer picker. Selecting a template only inserts editable draft text and never sends automatically. |
| PARTIAL | Organization/team-scoped canned-response audience enforcement | Templates store visibility, optional organization, and optional team metadata. The current staff GET path does not yet derive a staff organization/team identity model to hide out-of-scope templates automatically. Global staff templates are fully operable. |
| IMPLEMENTED | Public contact failure clarity | `apps/studios/src/pages/contact.astro` gives explicit persisted/not-persisted states for success, existing-ticket, rate-limit, verification-provider, and network failures. |

## Private ticket attachments

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Private R2 architecture | `workers/api/src/attachments.ts`, `Env.ATTACHMENTS`; randomized keys and private-by-default ticket attachment semantics. |
| IMPLEMENTED | Validation and limits | 10 MiB maximum, extension/MIME/content inspection, safe filenames, SHA-256 metadata, and rejection of unrecognized/executable content. |
| IMPLEMENTED | Authorized retrieval | Separate client/staff authorization paths; internal staff attachments cannot be read through client routes. |
| IMPLEMENTED | Safe download semantics | Attachment disposition, `nosniff`, private/no-store behavior, D1 metadata, collision/path-traversal resistance. |
| IMPLEMENTED | Client and staff attachment UI | Both ticket surfaces can list/upload/download within their authorization boundary. Staff can choose client-visible or internal. |
| BLOCKED | Real production ticket R2 operation | Requires owner-created production R2 bucket/binding and Cloudflare account configuration. |

## Admin CMS and relationship management

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Database-backed CMS | `apps/admin/src/pages/content.astro`, `apps/admin/public/content-admin.js`, Worker content endpoints. |
| IMPLEMENTED | People / Organizations / Services / Projects / Posts / Settings CRUD | Structured D1-backed forms and authorized mutation paths are present. |
| IMPLEMENTED | Project metric editor | Label/value/qualifier/source/source URL/measured timestamp and measured/provisional/historical/target state. |
| IMPLEMENTED | SEO controls | Structured title/description/canonical/social metadata/robots controls. Admin remains forcibly non-indexable independently of content fields. |
| IMPLEMENTED | Visual relationship management | `apps/admin/src/pages/operations.astro`, `apps/admin/public/operations.js`, `workers/api/src/relationships.ts`, migration `0005_third_pass.sql`. |
| IMPLEMENTED | People relationships | Organization memberships, per-membership role, public membership state, primary organization flag, project credits, external/social links, ordering. |
| IMPLEMENTED | Organization relationships | Members/roles, projects/credit labels, associated organizations/relationship labels, external/social links, ordering. |
| IMPLEMENTED | Project relationships | Creators/contributors/credit labels, organizations/credit labels, related projects/relationship labels, external links, ordering. |
| IMPLEMENTED | Duplicate/destructive relationship safety | Relationship updates are deduplicated and applied as D1 batches to join tables; deleting join state does not delete unrelated people/organizations/projects. Foreign keys define owned join cleanup. |

## General public CMS media library

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Public-media model is separate from ticket attachments | `content_media` / `content_media_usage` and `Env.CMS_MEDIA` use a distinct logical/storage path from private ticket `media`/`attachments` and `Env.ATTACHMENTS`. |
| IMPLEMENTED | Authorized upload and library UI | `workers/api/src/cms-media.ts`, Admin Operations media library. Search/filter, upload, metadata edit, URL copy/select workflow, and guarded deletion are available to authorized staff. |
| IMPLEMENTED | Server-side image safety | 15 MiB maximum; PNG/JPEG/GIF/WebP only; extension + MIME + signature/structure checks; server-side dimensions and pixel/dimension caps; randomized storage keys. |
| IMPLEMENTED | Media metadata | SHA-256, dimensions, byte size, MIME, original filename, alt text, caption, focal point, uploader, timestamps. |
| IMPLEMENTED | Hash deduplication | Identical uploads reuse the existing asset record by unique SHA-256. |
| IMPLEMENTED | Usage/deletion protection | Usage records plus direct content-field lookups prevent deletion while an asset is referenced. |
| IMPLEMENTED | Public delivery | Public CMS media endpoint emits explicit image MIME, `nosniff`, cache policy, ETag and sandboxed CSP. |
| BLOCKED | Real staging/production CMS-media R2 operation | Requires owner-created `CMS_MEDIA` R2 buckets and bindings. The repository does not fabricate bucket IDs/account values. |

## Public publishing, metadata, and content integrity

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Database-backed public projects/posts/people/organizations/services | Server-rendered detail and directory routes use structured API data, exclude drafts/private records, and return real 404/503 states. |
| IMPLEMENTED | Dynamic sitemap and RSS | Sitemap derives from actual public content collections; RSS derives from published posts. Ticket/Admin URLs are excluded. |
| IMPLEMENTED | Structured data | Page-appropriate Organization, Person, Article, BreadcrumbList, SoftwareApplication/CreativeWork and Service schemas. Sparaton Studios remains the root parent brand. |
| IMPLEMENTED | Canonical / OG / Twitter metadata | Public layouts and dynamic content routes emit canonical and social metadata. |
| IMPLEMENTED | Web manifests and icon metadata | Public brand sites advertise their own manifests and theme colors. Admin advertises no public manifest. |
| IMPLEMENTED | Raster brand fallback generation | `scripts/generate-brand-assets.mjs` deterministically exports 16×16, 32×32, 180×180, 192×192 and 512×512 PNGs from original Sparaton/Aspheral/ILMP geometry during clean production builds. SVG remains preferred. |
| IMPLEMENTED | Repository content-integrity sweep | Repository search found no lorem ipsum, fake testimonials/customers/downloads, or hard-coded queried Kay Elo/ILMP benchmark claims in the audited tree. This is a code/content audit, not external verification of every future CMS record. |
| BLOCKED | Final volatile claim verification | Any Kay rating, ILMP benchmark, release/download number, staff title or similar volatile claim must be re-verified immediately before real launch. |

## GitHub metadata and Cloudflare analytics

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Cached GitHub metadata synchronization | `workers/api/src/github-sync.ts`, `project_github_metadata`, integration cache/sync state. Release data is displayed only when GitHub reports a real release. |
| IMPLEMENTED | Kay canonical repository | Kay remains associated with `https://github.com/Aspheral/Kay-Chess`. |
| IMPLEMENTED | External failure degradation | GitHub API failure updates sync state/cache without breaking public project pages. |
| BLOCKED | Optional authenticated GitHub quota | Requires owner-provided `GITHUB_TOKEN`; unauthenticated behavior remains the fallback. |
| IMPLEMENTED | Real Cloudflare Analytics API integration | `workers/api/src/analytics.ts` uses Cloudflare GraphQL, with 24h/7d/30d ranges, request/visit/time/path/hostname/referrer/country/browser/device data where available, and D1 caching. |
| IMPLEMENTED | Truthful unconfigured analytics state | Admin reports missing credentials instead of fabricating traffic. |
| BLOCKED | Real production traffic | Requires deployed hostnames plus Cloudflare account/zone/API credentials and actual traffic. |

## Privacy, retention, backup, and recovery

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Requester lookup | Owner/Administrator privacy tooling can find ticket records by normalized verified requester email. |
| IMPLEMENTED | Requester export | Export includes appropriate requester ticket/message/client-attachment/session/verification data while excluding raw token hashes and internal staff notes. |
| IMPLEMENTED | Session closure and expired-record cleanup | Authorized tools can revoke requester sessions and delete already-expired verification/session records. No invented legal grace period is hard-coded. |
| IMPLEMENTED | Policy-gated anonymization foundation | Anonymization requires the email twice, no active ticket, and explicit retention settings with `legalConfirmed` + `allowAnonymization`. Canonical message bodies and audit/security evidence are retained rather than blindly erased. |
| PARTIAL | Automated retention execution | Retention settings exist for verification/session/attachment/audit categories, but attachment/audit expiry is deliberately not auto-applied until owner/legal policy is confirmed. |
| BLOCKED | Final legal retention periods | The repository intentionally supplies no invented legal period. Owner/legal review must choose policy values and permissible deletion/anonymization behavior. |
| IMPLEMENTED | D1 backup/export tooling | `scripts/backup-d1.mjs` wraps explicit read-only staging/production remote export. |
| IMPLEMENTED | Guarded D1 restore tooling | `scripts/restore-d1.mjs` is dry-by-default, requires explicit restore confirmation, and adds a second shell guard for production. |
| IMPLEMENTED | Recovery runbook | `docs/BACKUP-RECOVERY.md` covers pre-migration backups, migration failure, accidental deletion, ticket corruption, application rollback with advanced schema, and disaster-recovery checks. |
| BLOCKED | Real production backup/restore rehearsal | Requires the actual owner Cloudflare production database, credentials, and explicit authorization. No production database was modified in this pass. |

## Audit quality and operations visibility

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Mutation audit trail foundation | Ticket assignment/status/tags/internal notes, content CRUD/publication, settings, relationship changes, media changes, canned responses, and privacy operations emit audit events with actor/action/target/timestamp. New third-pass paths add useful non-secret metadata. |
| IMPLEMENTED | Audit search/filter UI | Admin Operations supports action/actor/target/free-text filtering and displays metadata/request IDs where recorded. |
| IMPLEMENTED | Request correlation for new third-pass mutations | Relationship/media/canned/privacy paths write `audit_events.request_id`, populated from the Worker-generated request ID. |
| PARTIAL | Uniform request-ID/metadata richness on legacy mutations | Some pre-third-pass content/ticket/settings audit helpers still emit correct actor/action/target/timestamp events without the newer request-ID column or equally rich metadata. No secrets are recorded. |
| IMPLEMENTED | Operations health surface | Admin reports database/DO/email/analytics/attachments/GitHub configuration and sync/error state without displaying credentials or inventing provider quota. |

## Security and CSP

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Cloudflare Access + application roles | `workers/api/src/access.ts`, same-origin Admin proxy/headers and server-side role checks. |
| IMPLEMENTED | Request IDs / safe failure envelope | API errors return structured request IDs and do not expose stack traces, SQL, Access JWT contents, or provider secrets. |
| IMPLEMENTED | Shared transport-aware security policy | `packages/ui/src/security.ts` is used by Studios, Aspheral, ILMP and Admin middleware. Production HTTPS gets HSTS/upgrade; local HTTP does not. |
| IMPLEMENTED | Public script CSP nonces | Studios, Aspheral and ILMP no-flash theme/bootstrap, JSON-LD and inline script behavior use per-request nonces. `unsafe-eval` is not permitted. |
| IMPLEMENTED | Non-canonical/staging anti-indexing | Non-canonical public host origins receive `X-Robots-Tag: noindex, nofollow, noarchive`; Admin is always noindex/noarchive/no-store. |
| IMPLEMENTED | Header regression coverage | Unit and E2E tests verify local-vs-production transport policy, nonce policy, Admin cache/indexing policy, and WebKit navigation. |
| PARTIAL | Complete removal of `unsafe-inline` | `style-src 'unsafe-inline'` remains because the established Astro visual system still uses inline style blocks/attributes. Admin also retains a narrowly scoped inline-script allowance for its current no-flash bootstrap. No `unsafe-eval` is used. Full removal requires a deliberate style/bootstrap migration without visual/theme regression. |

## Accessibility, responsive QA, and performance

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Shared accessibility foundation | Skip links, visible focus styles, semantic headings, labels, reduced-motion handling and live regions are present in the shared/public/Admin surfaces. |
| IMPLEMENTED | Automated cross-site accessibility checks | `tests/e2e/quality.spec.ts` exercises semantic entry points, skip targets, accessible contact-form controls, and keyboard focus. Intentionally `aria-hidden` anti-bot fields are excluded from the accessibility tree rather than falsely labeled. |
| IMPLEMENTED | Automated responsive containment QA | Representative Studios, Aspheral, ILMP and Admin routes are exercised at 320, 768 and 1280 CSS-pixel widths for horizontal overflow/content containment, in every configured browser project. |
| PARTIAL | Formal assistive-technology review | No claim of completed human VoiceOver/NVDA/screen-reader certification is made. A real manual assistive-technology review remains pre-launch QA. |
| IMPLEMENTED | Static-friendly public performance architecture | Public QA asserts no Astro hydration islands on representative editorial routes and a small first-party script surface; public pages remain SSR/static-friendly rather than becoming a SPA. |
| IMPLEMENTED | Core Web Vitals engineering targets | `docs/PRODUCTION-QA.md` records p75 targets of LCP ≤ 2.5 s, CLS ≤ 0.10, INP ≤ 200 ms and public hydration/cache discipline. |
| PARTIAL | Real staging/production Lighthouse and field CWV | No fabricated Lighthouse/RUM score is recorded. Real measurements require a deployed staging/production hostname and representative content/network conditions. |
| PARTIAL | Human visual QA | Automated responsive/overflow checks are implemented, but final human inspection of production typography, final imagery, color contrast and real long-form CMS content remains a staging/pre-launch task. |

## Staging and deployment safety

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Separate staging Worker configuration | `workers/api/wrangler.staging.jsonc` uses distinct staging Worker/D1/R2 names, placeholder staging origins, `DEPLOYMENT_ENV=staging`, and email disabled by default. |
| IMPLEMENTED | Production/staging configuration validator | `scripts/validate-deployment-config.mjs` checks D1, DO, R2, environment/origins, owner placeholders and optional secret presence without printing secret values. It rejects obvious staging/production resource confusion. |
| IMPLEMENTED | Explicit deployment workflow | `scripts/deploy.mjs` performs configuration validation, clean install/check/test/build and Worker deployment; production requires explicit confirmation and optional smoke URL must use HTTPS. |
| IMPLEMENTED | Migration/deploy separation | Remote production D1 migrations are intentionally **not** silently run by the deploy script. Backup and migration are explicit controlled operator actions. |
| IMPLEMENTED | Staging indexing/email safeguards | Non-canonical hosts are noindex; staging email mode defaults disabled and is enforced in ticket verification and fallback notification code. |
| BLOCKED | Genuine Cloudflare staging deployment | Requires owner-created staging D1/R2/DO resources, Access setup, secrets, and assigned preview hostnames. No real staging resources were fabricated or deployed. |

## Repository safety

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Dependency/security maintenance scaffolding | `.github/dependabot.yml` covers npm and GitHub Actions; `.github/CODEOWNERS` keeps the repository owner visible on changes. |
| IMPLEMENTED | Branch/security recommendations | `docs/REPOSITORY-SAFETY.md` documents required CI checks, force-push/deletion protection, secret scanning/push protection, vulnerability alerts and owner-bypass considerations. |
| BLOCKED | Applying branch protection/repository rules | Deliberately left as an explicit owner action so this engineering pass does not silently lock the owner out of `main`. |

## Database and migrations

| Status | Requirement | Implementation |
| --- | --- | --- |
| IMPLEMENTED | Normalized production schema | Existing organization/content/ticket/role/audit/cache schema retained. |
| IMPLEMENTED | Operability migration | `0003_operability.sql`. |
| IMPLEMENTED | Settings compatibility migration | `0004_second_pass.sql`. |
| IMPLEMENTED | Third-pass migration | `0005_third_pass.sql` adds primary memberships, project/organization and related-project joins, public CMS media/usage, canned-response metadata, audit request IDs, and privacy-operation records. |
| IMPLEMENTED | Isolated migration validation | CI applies the full migration chain to a deliberately isolated local/test D1 database, never a real production database. |

## Production configuration blockers

The following remain **BLOCKED** until the owner explicitly provisions/authorizes real infrastructure. The repository deliberately contains placeholders rather than invented values:

- Cloudflare account/zone configuration and assigned authoritative nameservers.
- Real production and staging D1 databases/IDs; explicit remote production migrations.
- Durable Object bindings in the real account.
- Private ticket `ATTACHMENTS` R2 bucket and public `CMS_MEDIA` R2 bucket for staging/production.
- `sparaton.com`, `www.sparaton.com`, `aspheral.sparaton.com`, `ilmp.sparaton.com`, `admin.sparaton.com`, API and staging hostname bindings and independent HTTPS verification.
- Cloudflare Access application/audience/team-domain plus allowed staff identities.
- Resend domain verification, sender DNS records and production API secret.
- Ticket/session cryptographic secrets.
- Cloudflare Analytics account/zone/token configuration.
- Optional authenticated GitHub token.
- Owner/legal privacy, retention, jurisdiction and legal-entity confirmation.
- Final public staff titles/roster/contact details and verification of volatile Kay/ILMP/release/benchmark claims.
- GoDaddy nameserver change. It has **not** been performed and is intentionally outside this pass.

The real domain must not be described as live until the canonical HTTPS hostnames have actually been deployed and independently verified.

## Deferred / not implemented

- **NOT IMPLEMENTED:** paid simultaneous-ticket override/payment flow.
- **NOT IMPLEMENTED:** full customer account/billing/invoice/saved-brief system.
- **PARTIAL:** organization/team enforcement for canned-response visibility, pending a staff team/organization identity model.
- **PARTIAL:** uniform request-ID enrichment on every legacy audit mutation.
- **PARTIAL:** complete CSP removal of `unsafe-inline` for existing inline styles/Admin bootstrap.
- **PARTIAL:** automatic attachment/audit retention execution, intentionally awaiting owner/legal policy.
- **PARTIAL:** human screen-reader and final staging visual QA.
- **PARTIAL/BLOCKED:** live Lighthouse/field Core Web Vitals measurement until a real staging or production hostname exists.

## Validation gate

The required final repository gate remains:

1. `npm ci`
2. `npm run check`
3. `npm test`
4. isolated D1 migrations
5. `npm run build`
6. `npm run test:e2e`
7. Chromium, Firefox, WebKit and Mobile Chromium must all execute without skipped browser projects.

The code-bearing parent immediately before this ledger update had already achieved a fully green required GitHub Actions run (`31558180203`, #95). This ledger commit is documentation-only relative to that parent, but its own GitHub Actions run must also be green before the third pass is reported complete.
