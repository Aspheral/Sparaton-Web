# Sparaton first production launch checklist

## Human confirmation required

- [ ] Confirm Sparaton's legal structure and the exact legal entity/name, if any, that should appear in Terms/Privacy.
- [ ] Confirm whether an exact founding year/date should be published. The current site avoids inventing one.
- [ ] Confirm public titles for founders, Aspheral, and future staff. The site does not invent C-suite titles.
- [ ] Confirm the public staff/creator roster.
- [ ] Confirm the official business contact route and any public mailing/business address only if one should lawfully be published.
- [ ] Have Privacy and Terms reviewed for the intended jurisdiction and actual business practices.
- [ ] Confirm service pricing if public pricing is desired. Current services use request-a-quote language.
- [ ] Confirm Cloudflare account access and copy the assigned nameservers/D1 IDs/Access values.
- [ ] Perform the GoDaddy nameserver change.
- [ ] Verify the Resend sending domain and its exact SPF/DKIM records.
- [ ] Decide the initial admin identity allowlist and seed staff roles.
- [ ] Review every Kay and ILMP claim immediately before launch against current project source data.

## Engineering

- [ ] `npm install` completes from a clean checkout.
- [ ] `npm run check` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Playwright Chromium passes.
- [ ] Playwright Firefox passes.
- [ ] Playwright WebKit passes.
- [ ] Keyboard-only navigation checked.
- [ ] Reduced-motion checked.
- [ ] Light/dark initial system preference and persistence checked.
- [ ] Mobile widths checked, including narrow phone.
- [ ] D1 migration tested locally and remotely.
- [ ] Verification-token expiry/one-time behavior tested.
- [ ] Session revocation tested.
- [ ] Ticket CSRF rejection tested.
- [ ] Admin role rejection tested.
- [ ] Internal-note non-disclosure tested.
- [ ] Realtime reconnect tested.
- [ ] Offline email fallback tested with a real verified Resend domain.
- [ ] Rate limiting tested.
- [ ] Attachment UI remains disabled until secure upload handling is complete.

## DNS / edge

- [ ] Cloudflare zone active.
- [ ] `sparaton.com` bound to Studios deployment.
- [ ] `aspheral.sparaton.com` bound.
- [ ] `ilmp.sparaton.com` bound.
- [ ] `admin.sparaton.com` bound and Access protected.
- [ ] `api.sparaton.com` bound.
- [ ] `www.sparaton.com` 301 redirect preserves path/query.
- [ ] HTTPS only.
- [ ] Certificates valid for every host.
- [ ] No mixed content.
- [ ] Admin blocked from indexing both by edge/access and `noindex` metadata.

## Search / trust

- [ ] robots.txt verified.
- [ ] sitemap.xml verified.
- [ ] RSS feed verified.
- [ ] canonical URLs verified on production host.
- [ ] Open Graph previews checked.
- [ ] structured data checked with current validation tools.
- [ ] Search Console configured.
- [ ] Bing Webmaster Tools configured.
- [ ] Responsible Disclosure route monitored.

## Operations

- [ ] D1 backup/export procedure rehearsed.
- [ ] Staff know how to transfer/resolve tickets.
- [ ] Email quota/usage monitoring established.
- [ ] Cloudflare usage/limit monitoring established.
- [ ] Analytics either connected or visibly reports unconfigured.
- [ ] Production error logs do not expose ticket content or secrets.
