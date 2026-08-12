# Sparaton implementation status

This file tracks production readiness. A checked item means the code path exists in the repository, not that external production credentials or DNS have been configured.

## Implemented in repository

- [x] Monorepo with shared UI, content, types, database, and email packages.
- [x] Sparaton Studios public Astro application.
- [x] Aspheral Softworks Astro application.
- [x] ILMP / Lattice Forge Astro application.
- [x] Private Admin Astro application with `noindex` metadata.
- [x] Original Sparaton SVG mark and shared editorial design tokens.
- [x] System-aware light/dark theme with persisted manual preference.
- [x] Responsive public layouts, focus states, skip navigation, and reduced-motion behavior.
- [x] Structured organization/service/project types.
- [x] Kay Chess represented through the generic project model.
- [x] Qualified Kay metrics rather than hardcoded universal-strength claims.
- [x] D1 schema and migrations for people, organizations, projects, metrics, services, posts, tickets, messages, participants, assignments, status history, internal notes, sessions, verifications, attachments, staff roles, audit events, settings, and rate limiting.
- [x] Database-level one-active-ticket invariant.
- [x] Genuine ticket creation with validation, honeypot, rate limiting, and persisted messages.
- [x] Email-verification token flow with raw-token non-persistence.
- [x] Expiring, hashed ticket-access sessions.
- [x] Secure/HttpOnly/SameSite ticket session cookie.
- [x] Session-bound CSRF protection on client ticket writes.
- [x] Durable Object WebSocket ticket room using hibernation-compatible socket acceptance.
- [x] Realtime client timeline updates and reconnect behavior.
- [x] Staff reply persistence and realtime delivery.
- [x] Offline visitor email fallback for staff replies when Resend is configured.
- [x] Staff internal notes stored separately from the client timeline.
- [x] Cloudflare Access JWT validation plus application-level staff roles.
- [x] Same-origin Admin API proxy so Access identity is not assumed to cross hostnames automatically.
- [x] Audit events for sensitive staff actions already implemented by the current admin mutation paths.
- [x] Admin overview using real D1 ticket counts.
- [x] Admin ticket inbox/search API.
- [x] Admin project/post publishing API and initial editors.
- [x] Truthful analytics-unconfigured state.
- [x] Public post/project API endpoints.
- [x] News archive.
- [x] robots.txt, sitemap.xml, RSS, canonical metadata, Organization structured data, basic Open Graph metadata.
- [x] Privacy, Terms, Accessibility, and Responsible Disclosure launch-draft pages.
- [x] GoDaddy to Cloudflare deployment documentation without fabricated account-specific values.
- [x] Security documentation and human launch checklist.
- [x] Unit tests for content/ticket helpers/token primitives.
- [x] Playwright matrix configured for Chromium, Firefox, WebKit, and mobile Chromium.
- [x] GitHub Actions CI with preserved strict-check diagnostics.

## Partially implemented, requires another engineering pass

- [ ] Full staff ticket detail workspace: assignment, transfer, priority changes, status transitions, reopen/resolve controls, notes UI, history UI, and canned-response UI.
- [ ] Offline notification to assigned staff when a client sends a message and no assigned staff WebSocket is online.
- [ ] Full CRUD admin interfaces for People, Organizations, Services, Project Metrics, SEO, Settings, and social/contact destinations.
- [ ] Public article detail rendering for published Markdown and project-related article navigation.
- [ ] Dynamic sitemap entries for database-published projects/posts.
- [ ] Cloudflare Analytics API query implementation. Current state is intentionally 'not configured' rather than fake graphs.
- [ ] Secure attachment upload pipeline. Schema exists, but upload UI is intentionally disabled until storage, MIME sniffing, size/type policy, and download handling are complete.
- [ ] GitHub metadata refresh/cache worker for releases/activity/language.
- [ ] Per-project generic public route backed by D1, beyond the initial Kay art-directed page.
- [ ] Expanded structured data: Person, Article, SoftwareApplication/CreativeWork, BreadcrumbList.
- [ ] Full social preview image/mark assets and favicon wiring.
- [ ] Custom 404/error pages across every site.
- [ ] Strong production CSP after final third-party origins are known.
- [ ] Operational usage/limit dashboard for free-tier services.
- [ ] Database backup automation/runbook validation against the final Cloudflare account.

## External configuration required before production launch

- [ ] Cloudflare zone and account credentials.
- [ ] Cloudflare-assigned authoritative nameservers copied into GoDaddy.
- [ ] D1 database created and real database ID placed in deployment configuration.
- [ ] Worker and four site deployments created/bound to production hostnames.
- [ ] `www.sparaton.com` permanent redirect rule enabled and verified.
- [ ] Cloudflare Access application/AUD/team-domain values configured for Admin.
- [ ] Initial Admin allowlist/roles confirmed.
- [ ] Resend sending domain verified with its exact DNS records.
- [ ] Production Resend API key configured as a Worker secret.
- [ ] Ticket/session secret values generated and configured as Worker secrets.
- [ ] Privacy/Terms reviewed for the real legal entity, jurisdiction, retention policy, and business practices.
- [ ] Public staff titles/roster/contact details confirmed.
- [ ] Final current Kay and ILMP claims rechecked immediately before launch.

## Current validation gate

GitHub Actions is the source of truth for build/test status. Do not mark the release green until the `verify` and browser jobs pass on the final commit. CI deliberately preserves `strict-checks.log` as an artifact so Astro/TypeScript diagnostics can be repaired rather than bypassed.
