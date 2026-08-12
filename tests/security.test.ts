import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '../packages/ui/src/security';
import { hashToken, randomToken } from '../workers/api/src/security';

describe('ticket token primitives', () => {
  it('creates nontrivial random tokens', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a.length).toBeGreaterThan(30);
    expect(a).not.toBe(b);
  });

  it('hashes deterministically with a pepper without returning the raw token', async () => {
    const raw = 'secret-ticket-token';
    const pepper = 'test-pepper-that-is-not-production';
    const a = await hashToken(raw, pepper);
    const b = await hashToken(raw, pepper);
    expect(a).toBe(b);
    expect(a).not.toContain(raw);
    expect(await hashToken(raw, `${pepper}2`)).not.toBe(a);
  });
});

describe('production security header policy', () => {
  it('keeps a restrictive CSP without unsafe-eval', () => {
    const headers = buildSecurityHeaders({
      url: 'https://sparaton.com/',
      production: true,
      nonce: 'testnonce',
      formAction: ['https://api.sparaton.com'],
      connectSrc: ['https://api.sparaton.com', 'wss://api.sparaton.com']
    });
    const csp = headers['Content-Security-Policy'];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self' 'nonce-testnonce'");
    expect(csp).not.toContain('unsafe-eval');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('keeps Admin non-indexable and non-cacheable', () => {
    const headers = buildSecurityHeaders({
      url: 'https://admin.sparaton.com/',
      production: true,
      admin: true,
      allowInlineScripts: true
    });
    expect(headers['X-Robots-Tag']).toBe('noindex, nofollow, noarchive');
    expect(headers['Cache-Control']).toBe('no-store');
  });
});
