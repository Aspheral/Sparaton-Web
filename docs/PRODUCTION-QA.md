# Production QA Notes

## Accessibility

The automated browser suite covers keyboard-reachable skip links, form labeling, heading structure, responsive overflow, Admin robots/cache policy, and representative public pages. This is an engineering accessibility gate, not a claim of completed human assistive-technology certification.

Manual pre-launch review still required:

- VoiceOver/NVDA or equivalent screen-reader navigation on public contact/ticket and Admin ticket/CMS flows
- contrast verification against final production imagery/content
- focus behavior during real WebSocket reconnects and validation errors
- reduced-motion review on final production CSS/third-party additions

## Performance targets

Public Sparaton pages remain server-rendered/static-friendly and should not become a SPA. Practical p75 production goals are:

- LCP <= 2.5 s
- CLS <= 0.10
- INP <= 200 ms
- avoid public hydration unless interaction genuinely requires it
- keep route-specific first-party JavaScript small; theme bootstrap is intentionally tiny
- cache immutable/public media and avoid repeated API waterfalls

Representative performance routes: homepage, project, article/news, service, Aspheral homepage, ILMP homepage. These are targets, not fabricated Lighthouse measurements. Real production Core Web Vitals must be measured after staging/production infrastructure and content are available.

## CSP boundary

Public Studios, Aspheral, and ILMP inline scripts use per-request CSP nonces. `unsafe-eval` is not permitted. Local HTTP does not receive production HSTS or `upgrade-insecure-requests`, which prevents WebKit from attempting TLS against the HTTP development server. Production HTTPS retains both protections.

`style-src 'unsafe-inline'` remains because the current Astro templates intentionally contain inline style blocks/attributes throughout the established visual system. Removing it safely requires migrating those style attributes/classes without changing the design. Admin also retains a narrowly documented inline-script allowance for its no-flash theme bootstrap until all Admin templates consume the request nonce. This remaining limitation must stay `PARTIAL` in the implementation ledger rather than being relabeled as complete.

## Responsive QA

Browser coverage includes desktop Chromium, Firefox, WebKit, and mobile Chromium. Automated overflow checks are supplemented by manual viewport checks recommended around 320, 375, 768, 1024, 1280, and 1440 CSS pixels, especially for long titles, ticket threads, CMS relationship rows, tables, dialogs, analytics panels, and footers.
