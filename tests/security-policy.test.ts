import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '../packages/ui/src/security';

describe('security header policy', () => {
  it('does not upgrade or pin local HTTP development to HTTPS', () => {
    const headers = buildSecurityHeaders({
      url: 'http://127.0.0.1:4321/services',
      production: false,
      nonce: 'devnonce',
      connectSrc: ['https://api.sparaton.com', 'wss://api.sparaton.com']
    });

    expect(headers['Content-Security-Policy']).not.toContain('upgrade-insecure-requests');
    expect(headers['Strict-Transport-Security']).toBeUndefined();
    expect(headers['Content-Security-Policy']).toContain("script-src 'self' 'nonce-devnonce'");
    expect(headers['Content-Security-Policy']).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('keeps transport hardening for production HTTPS', () => {
    const headers = buildSecurityHeaders({
      url: 'https://sparaton.com/services',
      production: true,
      nonce: 'prodnonce'
    });

    expect(headers['Content-Security-Policy']).toContain('upgrade-insecure-requests');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('keeps Admin private and non-cacheable', () => {
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
