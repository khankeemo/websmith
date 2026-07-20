export function generateTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function generateNonce(): string {
  return crypto.randomUUID();
}

async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: string, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function signRequest(
  payload: Record<string, unknown>,
  secret: string,
  timestamp: string,
  nonce: string,
  method = 'POST',
  path = '',
  query = '',
): Promise<string> {
  const bodyHash = await sha256(JSON.stringify(payload));
  const message = [method, path, query, bodyHash, timestamp, nonce].join('\n');
  return arrayBufferToBase64(await hmacSha256(secret, message));
}
