import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hashToken, randomToken } from '../workers/api/src/security';

describe('ticket token primitives',()=>{
  it('creates nontrivial random tokens',()=>{const a=randomToken(),b=randomToken();expect(a.length).toBeGreaterThan(30);expect(a).not.toBe(b)});
  it('hashes deterministically with a pepper without returning the raw token',async()=>{const raw='secret-ticket-token',pepper='test-pepper-that-is-not-production';const a=await hashToken(raw,pepper),b=await hashToken(raw,pepper);expect(a).toBe(b);expect(a).not.toContain(raw);expect(await hashToken(raw,pepper+'2')).not.toBe(a)});
});

describe('production security header policy',()=>{
  for(const path of ['apps/studios/src/middleware.ts','apps/aspheral/src/middleware.ts','apps/ilmp/src/middleware.ts','apps/admin/src/middleware.ts']){
    it(`${path} keeps a restrictive CSP without unsafe-eval`,()=>{
      const source=readFileSync(path,'utf8');
      expect(source).toContain('Content-Security-Policy');
      expect(source).toContain("object-src 'none'");
      expect(source).toContain("frame-ancestors 'none'");
      expect(source).not.toContain('unsafe-eval');
      expect(source).toContain('X-Content-Type-Options');
      expect(source).toContain('Permissions-Policy');
      expect(source).toContain('Strict-Transport-Security');
    });
  }
  it('keeps Admin non-indexable and non-cacheable',()=>{
    const source=readFileSync('apps/admin/src/middleware.ts','utf8');
    expect(source).toContain('X-Robots-Tag');
    expect(source).toContain('noindex');
    expect(source).toContain("Cache-Control','no-store");
  });
});
