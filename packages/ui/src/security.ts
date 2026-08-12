export type SecurityHeaderOptions = {
  url: URL | string;
  production: boolean;
  nonce?: string;
  formAction?: string[];
  connectSrc?: string[];
  imageSrc?: string[];
  referrerPolicy?: string;
  admin?: boolean;
  allowInlineScripts?: boolean;
};

export function createCspNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

const directive = (name: string, values: string[]) => `${name} ${values.join(' ')}`;

export function buildSecurityHeaders(options: SecurityHeaderOptions): Record<string, string> {
  const url = typeof options.url === 'string' ? new URL(options.url) : options.url;
  const secureProduction = options.production && url.protocol === 'https:';
  const scriptSources = ["'self'"];
  if (options.nonce) scriptSources.push(`'nonce-${options.nonce}'`);
  if (options.allowInlineScripts) scriptSources.push("'unsafe-inline'");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    directive('form-action', ["'self'", ...(options.formAction ?? [])]),
    directive('script-src', scriptSources),
    "style-src 'self' 'unsafe-inline'",
    directive('img-src', ["'self'", 'data:', ...(options.imageSrc ?? ['https:'])]),
    "font-src 'self' data:",
    directive('connect-src', ["'self'", ...(options.connectSrc ?? [])])
  ];

  if (secureProduction) csp.push('upgrade-insecure-requests');

  const headers: Record<string, string> = {
    'Content-Security-Policy': csp.join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': options.referrerPolicy ?? 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Frame-Options': 'DENY'
  };

  if (secureProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  if (options.admin) {
    headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
    headers['Cache-Control'] = 'no-store';
  }

  return headers;
}

export function applySecurityHeaders(response: Response, headers: Record<string, string>): Response {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}
