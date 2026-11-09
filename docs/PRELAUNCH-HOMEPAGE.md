# Sparaton prelaunch homepage

This is the public **Under Construction** landing page for Sparaton, an independent manga production company. The live GoDaddy site remains unchanged until DNS/hosting cutover.

## Edit the team cards

Open `apps/studios/src/data/creators.json`. Each entry defines:

- `name`, `slug`, `initials`, `number`
- `role` and a short `bio`
- `avatar`: use `null` for the styled initial monogram, or a published file path such as `/creators/aspheral.webp`
- `socials`: an array of `{ "label": "GitHub", "url": "https://..." }` links, including `mailto:` links if explicitly approved

When adding images, commit them to `apps/studios/public/creators/`. Use a square portrait (ideally 512x512 or larger) with permission from the person depicted. Avoid unapproved personal details, speculative titles, or placeholder social URLs. Leave `socials: []` when no approved destinations exist.

The homepage is in `apps/studios/src/pages/index.astro`. The social preview graphic is a hand-coded SVG at `apps/studios/public/og/under-construction.svg`. Note: some social services require PNG or JPEG for link previews; export a 1200x630 raster fallback when publishing beyond initial staging.

## Local checks

From the repository root:

```sh
npm ci
npm run check
npm test
npm run build
npm run test:e2e
```

Run the Studio locally with `npm run dev:studios`. The homepage does not require CMS, D1, or API access to render.

## Launch without breaking Zoho Mail

**Do not delete, override, or accidentally omit Zoho DNS records.** The domain was registered through GoDaddy, and Zoho Mail has already been tested for both sending and receiving.

Before changing the web host or nameservers:

1. Export or manually record the full, current authoritative GoDaddy DNS zone and TTLs.
2. Back up the existing website and confirm the new site builds and works at a staging/preview hostname.
3. If switching nameservers to Cloudflare, populate the Cloudflare zone **before** switching authority. Reproduce all verified mail records exactly from GoDaddy.
4. Preserve these known MX records for `@`: `mx.zoho.com` (priority 10), `mx2.zoho.com` (20), `mx3.zoho.com` (50).
5. Preserve the single existing SPF TXT record, Zoho domain verification TXT, DKIM `zmail._domainkey` public key, and `_dmarc` TXT record. DMARC's current policy is monitoring (`p=none`).
6. Do not introduce a second SPF TXT policy. Any additional outbound mail service, such as the repo's prospective Resend integration, requires review and correct domain authorization.
7. Keep website A/AAAA/CNAME changes separate from mail MX and TXT records. Check the root and `www` hosts after cutover.
8. Test externally: website via HTTPS, navigation and mobile, `aspheral@sparaton.com` ↔ Gmail, and `support@sparaton.com` alias replies.
9. Only after verification, consider enabling stronger DMARC enforcement and production ticket features.

An official deployment must also follow `docs/DEPLOYMENT.md` and `docs/LAUNCH-CHECKLIST.md`. The staged homepage does **not** activate the D1/API/ticket platform and does not promise a launch date.

## Remaining editorial approvals

- Approved portraits/logo and profile biographies for all creators.
- Exact public social profiles for each creator; do not invent addresses.
- Any manga titles, cover art, releases, or project dates before advertising them.
- Whether the full site will replace the under-construction page or coexist with it.
