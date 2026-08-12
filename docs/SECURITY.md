# Security model

## Trust boundaries

Public visitors are untrusted. Client-side validation is convenience only. Ticket creation and every mutation are validated in the Worker.

The admin hostname is protected twice: Cloudflare Access identifies an approved identity, then the API loads application roles from D1 (with an optional bootstrap owner allowlist). A hidden URL is never considered authentication.

## Ticket credentials

Verification and access tokens use cryptographically secure random values. Raw tokens are sent to the user and never stored. D1 stores keyed HMAC-SHA-256 hashes. Verification links expire and are one-time use. Ticket sessions expire and can be revoked.

Ticket public IDs are random locators, not authentication. Possessing a public ID alone is insufficient.

## CSRF

Client message writes require a session-bound CSRF value that can only be obtained by reading the authenticated ticket endpoint. Cross-origin reads are blocked by the API's allowlist CORS policy.

Admin browser writes use a same-origin proxy and require the non-simple `x-requested-with: sparaton-admin` header. Cross-site HTML forms cannot add that header. The proxy forwards the Cloudflare Access assertion to the administrative API.

## XSS

Public/editorial templates escape values by default. Ticket messages are rendered through `textContent`, not injected HTML. Markdown publication must pass through a controlled renderer/sanitizer before arbitrary HTML extensions are enabled.

## SQL injection

D1 input values are bound with prepared statements. Dynamic query fragments in the ticket inbox are limited to developer-controlled clauses; user input remains bound.

## Cookies

Ticket session cookies are `Secure`, `HttpOnly`, and `SameSite=Lax`, with the domain scoped to the Sparaton zone so the API and ticket frontend can share the session. Do not put secrets in JavaScript-readable cookies.

## Attachments

The schema supports attachments, but public upload handling is not enabled until storage, MIME sniffing, extension allowlists, byte limits, malware-risk handling, and download disposition behavior are fully configured. This is safer than shipping an upload field that accepts untrusted bytes without a storage security policy.

## Headers

The Worker sets nosniff, a strict-origin referrer policy, a restrictive Permissions Policy, and frame denial. Public site deployment should add a Content Security Policy after final third-party origins are known. Do not weaken CSP merely to silence an integration error.

## Logging

Audit events record sensitive staff actions without storing raw authentication tokens. Avoid logging ticket bodies, secrets, complete access tokens, or attachment contents.

## Abuse controls

Ticket creation includes:

- server validation;
- honeypot field;
- email verification;
- request-length limits in field validation;
- one-active-ticket policy;
- database-backed rate events keyed by a hash of IP/email context.

Cloudflare Turnstile should remain an escalation option for suspicious traffic rather than a mandatory puzzle for every visitor.

## Dependency and CI policy

Run dependency auditing regularly. Keep lockfiles reviewed. Dependabot or Renovate may be enabled after choosing the preferred update workflow. Production changes should pass checks/build/tests before deployment.

## Responsible disclosure

The public Responsible Disclosure page describes how to report a security concern without promising a bounty or legal safe harbor that has not been formally approved.
