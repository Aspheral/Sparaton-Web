# Staging and Deployment Safety

Sparaton has three deliberately distinct operating contexts: local development, staging/preview, and production. The engineering repository is prepared for staging, but no real Cloudflare resources, DNS, nameservers, or production secrets are provisioned by this document.

## Environment boundaries

| Resource | Local | Staging | Production |
| --- | --- | --- | --- |
| API Worker | Wrangler local | `sparaton-api-staging` | `sparaton-api` |
| D1 | local/test D1 | `sparaton-staging` | `sparaton-production` |
| Ticket R2 | local/unconfigured | `sparaton-staging-private-attachments` | `sparaton-private-attachments` |
| CMS media R2 | local/unconfigured | `sparaton-staging-public-media` | `sparaton-public-media` |
| Email | provider optional | disabled by default | enabled only when verified/configured |
| Search indexing | local irrelevant | noindex on non-canonical hostnames | canonical public hosts only |
| Access | development assumptions only | separate Access app/policy | production Access app/policy |

Staging resources must be created separately in Cloudflare. Do not point staging bindings at production D1 or R2 simply to make a preview work.

## Required owner configuration

Before a staging deploy, replace staging placeholders and configure Wrangler secrets/environment values for:

- staging D1 database ID
- staging Studios/Admin origins
- `TICKET_TOKEN_PEPPER`
- `SESSION_SIGNING_SECRET`
- Cloudflare Access team domain and audience
- allowed owner/staff identities

Optional integrations remain optional:

- Resend API key: staging intentionally defaults to `EMAIL_DELIVERY_MODE=disabled`
- Cloudflare Analytics credentials: Admin reports unconfigured when absent
- GitHub token: public GitHub sync can degrade to unauthenticated/lower-quota behavior

CMS media requires the separate `CMS_MEDIA` R2 binding. Ticket attachments remain on `ATTACHMENTS`; the buckets must not be merged.

## Validation

```sh
node scripts/validate-deployment-config.mjs --environment staging --require-secrets
node scripts/validate-deployment-config.mjs --environment production --require-secrets
```

The validator checks resource separation and required names without printing secret values. Placeholder configuration fails validation.

## Deployment sequence

1. `npm ci`
2. `npm run check`
3. `npm test`
4. isolated migration validation
5. `npm run build`
6. backup the target D1 before remote schema changes
7. explicitly apply target-environment migrations
8. run `node scripts/deploy.mjs staging` or the explicitly confirmed production equivalent
9. smoke-test the assigned HTTPS hostname
10. verify Admin remains Access-protected/noindex/no-store

The deploy script does not silently migrate production D1. Schema change and application deployment remain separate controlled actions.

## Indexing and email safeguards

Public middleware marks non-canonical hostnames with `X-Robots-Tag: noindex, nofollow, noarchive`. Staging must also use page-level robots protections at the platform/site layer where available. Admin is always `noindex, nofollow, noarchive` and `no-store` regardless of hostname.

Staging email delivery is disabled in configuration and application notification code respects that mode even if a Resend secret happens to be present. This prevents preview tickets from accidentally becoming production correspondence.

## Production cutover is intentionally out of scope

A later authorized deployment pass must provision/verify Cloudflare zones, D1/R2/DO bindings, Access, Resend sender verification, secrets, domain routes, and assigned nameservers. Only after those are verified should GoDaddy DNS/nameservers or the real Sparaton hostnames be changed.
