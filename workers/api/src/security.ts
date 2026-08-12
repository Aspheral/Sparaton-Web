const encoder = new TextEncoder();

export function randomToken(bytes = 32): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

export async function hashToken(token: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
  return base64Url(new Uint8Array(digest));
}

export async function sha256(value:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary='';
  for (const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
