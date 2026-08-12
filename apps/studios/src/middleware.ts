import { defineMiddleware } from 'astro:middleware';
import { applySecurityHeaders, buildSecurityHeaders, createCspNonce } from '@sparaton/ui/security';

export const onRequest = defineMiddleware(async (context, next) => {
  const nonce = createCspNonce();
  (context.locals as { cspNonce?: string }).cspNonce = nonce;
  const response = await next();
  return applySecurityHeaders(response, buildSecurityHeaders({
    url: context.url,
    production: import.meta.env.PROD,
    nonce,
    canonicalOrigin: 'https://sparaton.com',
    formAction: ['https://api.sparaton.com'],
    connectSrc: ['https://api.sparaton.com', 'wss://api.sparaton.com']
  }));
});
