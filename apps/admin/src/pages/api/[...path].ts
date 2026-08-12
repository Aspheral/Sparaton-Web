import type { APIRoute } from 'astro';

const API_ORIGIN = 'https://api.sparaton.com';

export const ALL: APIRoute = async ({ request, params }) => {
  const isWebSocket = request.headers.get('upgrade')?.toLowerCase() === 'websocket';
  if (!isWebSocket && request.headers.get('x-requested-with') !== 'sparaton-admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const assertion = request.headers.get('cf-access-jwt-assertion');
  if (!assertion) return new Response('Cloudflare Access authentication required', { status: 401 });

  const target = new URL(`/v1/admin/${params.path ?? ''}`, API_ORIGIN);
  target.search = new URL(request.url).search;

  const headers = new Headers({
    'cf-access-jwt-assertion': assertion,
    'x-requested-with': 'sparaton-admin'
  });
  for (const name of ['content-type','upgrade','connection','sec-websocket-key','sec-websocket-version','sec-websocket-protocol','sec-websocket-extensions']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD') init.body = await request.arrayBuffer();

  const response = await fetch(target, init);
  if (response.status === 101) return response;
  const outHeaders = new Headers(response.headers);
  outHeaders.set('cache-control', 'no-store');
  outHeaders.delete('set-cookie');
  return new Response(response.body, { status: response.status, headers: outHeaders });
};
